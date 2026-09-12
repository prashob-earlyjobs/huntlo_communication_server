import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import mongoose from "mongoose";

const SKEW_MS = 60_000;
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
  version?: number;
};

function encryptionKey() {
  const hex = String(process.env.ENCRYPTION_KEY || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string");
  }
  return Buffer.from(hex, "hex");
}

function decryptSecret(payload?: EncryptedPayload | null) {
  if (!payload?.ciphertext || !payload.iv || !payload.authTag) return null;
  const key = encryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, "base64url"), {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptSecret(value: string): EncryptedPayload {
  const key = encryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: encrypted.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    version: 1,
  };
}

function zohoAccountsHost(dataCenter?: string) {
  const dc = String(dataCenter || "com").toLowerCase().trim();
  const hosts: Record<string, string> = {
    com: "accounts.zoho.com",
    eu: "accounts.zoho.eu",
    in: "accounts.zoho.in",
    au: "accounts.zoho.com.au",
    "com.au": "accounts.zoho.com.au",
    jp: "accounts.zoho.jp",
    ca: "accounts.zohocloud.ca",
    sa: "accounts.zoho.sa",
  };
  return hosts[dc] || hosts.com;
}

async function refreshZohoAccessToken(refreshToken: string, dataCenter?: string) {
  const clientId = process.env.ZOHO_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET are required to refresh Zoho tokens");
  }

  const res = await fetch(`https://${zohoAccountsHost(dataCenter)}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });

  const data: any = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error || "Zoho token refresh failed");
  }
  return data;
}

export async function getZohoAccessToken(
  emailAddress?: string,
  forceRefresh = false
) {
  try {
    const email = String(emailAddress || "").trim().toLowerCase();
    if (!email) return null;

    const integrations = mongoose.connection.collection("userintegrations");
    const row = await integrations
      .find({
        provider: "zoho-mail",
        email,
        status: { $in: ["connected", "needs_attention", "testing"] },
      })
      .sort({ isDefault: -1, updatedAt: -1 })
      .limit(1)
      .next();

    if (!row) {
      console.error("No Zoho integration in userintegrations for", email);
      return null;
    }

    const current = decryptSecret(row.encryptedAccessToken);
    const expiresAt = row.tokenExpiresAt ? new Date(row.tokenExpiresAt).getTime() : 0;
    if (!forceRefresh && current && expiresAt > Date.now() + SKEW_MS) {
      return current;
    }

    const refreshToken = decryptSecret(row.encryptedRefreshToken);
    if (!refreshToken) {
      console.error("Zoho refresh token missing for", email);
      return current;
    }

    const dataCenter = String(
      row.config?.zohoDataCenter || row.config?.dataCenter || "com"
    );
    const tokens = await refreshZohoAccessToken(refreshToken, dataCenter);
    const accessToken = String(tokens.access_token || "");
    if (!accessToken) return current;

    const expiresIn = Number(tokens.expires_in || 3600);
    await integrations.updateOne(
      { _id: row._id },
      {
        $set: {
          encryptedAccessToken: encryptSecret(accessToken),
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          status: "connected",
          errorCode: null,
          errorMessage: null,
        },
      }
    );

    return accessToken;
  } catch (error) {
    console.error("Zoho token helper failed:", (error as Error).message);
    return null;
  }
}
