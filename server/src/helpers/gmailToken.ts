import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import mongoose from "mongoose";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
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
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
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

export async function refreshGmailAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required to refresh Gmail tokens");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || "Gmail token refresh failed");
  }
  return data;
}

export async function getGmailAccessToken(
  emailAddress?: string,
  forceRefresh = false
) {
  try {
    const email = String(emailAddress || "").trim().toLowerCase();
    const integrations = mongoose.connection.collection("userintegrations");
    const query: Record<string, unknown> = {
      provider: "gmail",
      status: { $in: ["connected", "needs_attention", "testing"] },
    };
    if (email) query.email = email;

    const row = await integrations
      .find(query)
      .sort({ isDefault: -1, updatedAt: -1 })
      .limit(1)
      .next();

    if (!row) {
      console.error("No Gmail integration in userintegrations for", email || "(no email)");
      return null;
    }

    const current = decryptSecret(row.encryptedAccessToken);
    const expiresAt = row.tokenExpiresAt ? new Date(row.tokenExpiresAt).getTime() : 0;
    if (!forceRefresh && current && expiresAt > Date.now() + SKEW_MS) {
      return current;
    }

    const refreshToken = decryptSecret(row.encryptedRefreshToken);
    if (!refreshToken) {
      console.error("Gmail refresh token missing for", email || row.email);
      return current;
    }

    const tokens = await refreshGmailAccessToken(refreshToken);
    const accessToken = String(tokens.access_token || "");
    if (!accessToken) {
      console.error("Gmail refresh returned no access token for", email || row.email);
      return current;
    }

    const expiresIn = Number(tokens.expires_in || 3600);
    const $set: Record<string, unknown> = {
      encryptedAccessToken: encryptSecret(accessToken),
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      status: "connected",
      errorCode: null,
      errorMessage: null,
    };
    if (tokens.refresh_token) {
      $set.encryptedRefreshToken = encryptSecret(String(tokens.refresh_token));
    }

    await integrations.updateOne({ _id: row._id }, { $set });
    return accessToken;
  } catch (error) {
    console.error("Gmail token helper failed:", (error as Error).message);
    return null;
  }
}
