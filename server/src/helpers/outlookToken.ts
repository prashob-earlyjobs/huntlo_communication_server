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

function encryptionKeys() {
  const keys = [process.env.SMTP_ENCRYPTION_KEY, process.env.ENCRYPTION_KEY]
    .map((value) => String(value || "").trim())
    .filter((value, index, all) => /^[0-9a-fA-F]{64}$/.test(value) && all.indexOf(value) === index)
    .map((value) => Buffer.from(value, "hex"));
  if (!keys.length) {
    throw new Error("SMTP_ENCRYPTION_KEY or ENCRYPTION_KEY must be a 64-character hex string");
  }
  return keys;
}

function openSecret(payload?: EncryptedPayload | null) {
  if (!payload?.ciphertext || !payload.iv || !payload.authTag) return null;
  const iv = Buffer.from(payload.iv, "base64url");
  const authTag = Buffer.from(payload.authTag, "base64url");
  const ciphertext = Buffer.from(payload.ciphertext, "base64url");

  for (const key of encryptionKeys()) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);
      return {
        value: Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"),
        key,
      };
    } catch {
      // Outlook rows are encrypted with the Huntlo key. Try the next key.
    }
  }
  throw new Error("Unsupported state or unable to authenticate data");
}

function encryptSecret(value: string, key = encryptionKeys()[0]): EncryptedPayload {
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

export async function refreshOutlookAccessToken(refreshToken: string, tenantId?: string) {
  const clientId = process.env.OUTLOOK_CLIENT_ID?.trim();
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET are required to refresh Outlook tokens");
  }

  const tenant = String(tenantId || process.env.OUTLOOK_TENANT_ID || "common").trim() || "common";
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    }
  );

  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || "Outlook token refresh failed");
  }
  return data;
}

export async function getOutlookAccessToken(
  emailAddress?: string | null,
  forceRefresh = false
) {
  try {
    const email = String(emailAddress || "").trim().toLowerCase();
    if (!email) {
      console.error("Outlook from address is required");
      return null;
    }
    const integrations = mongoose.connection.collection("userintegrations");
    const query: Record<string, unknown> = {
      provider: "outlook",
      email,
      status: { $in: ["connected", "needs_attention", "testing"] },
    };

    const row = await integrations
      .find(query)
      .sort({ isDefault: -1, updatedAt: -1 })
      .limit(1)
      .next();

    if (!row) {
      console.error("No Outlook integration in userintegrations for", email || "(no email)");
      return null;
    }

    const current = openSecret(row.encryptedAccessToken);
    const expiresAt = row.tokenExpiresAt ? new Date(row.tokenExpiresAt).getTime() : 0;
    if (!forceRefresh && current?.value && expiresAt > Date.now() + SKEW_MS) {
      return current.value;
    }

    const refreshToken = openSecret(row.encryptedRefreshToken);
    if (!refreshToken?.value) {
      console.error("Outlook refresh token missing for", email || row.email);
      return current?.value || null;
    }

    const tenantId = String(
      row.config?.tenantId || row.config?.microsoftTenantId || process.env.OUTLOOK_TENANT_ID || "common"
    );
    const tokens = await refreshOutlookAccessToken(refreshToken.value, tenantId);
    const accessToken = String(tokens.access_token || "");
    if (!accessToken) {
      console.error("Outlook refresh returned no access token for", email || row.email);
      return current?.value || null;
    }

    const key = refreshToken.key;
    const expiresIn = Number(tokens.expires_in || 3600);
    const $set: Record<string, unknown> = {
      encryptedAccessToken: encryptSecret(accessToken, key),
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      status: "connected",
      errorCode: null,
      errorMessage: null,
    };
    if (tokens.refresh_token) {
      $set.encryptedRefreshToken = encryptSecret(String(tokens.refresh_token), key);
    }

    await integrations.updateOne({ _id: row._id }, { $set });
    return accessToken;
  } catch (error) {
    console.error("Outlook token helper failed:", (error as Error).message);
    return null;
  }
}
