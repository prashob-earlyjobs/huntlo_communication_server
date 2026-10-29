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
      // Gmail rows may be encrypted with the Huntlo SMTP key or ENCRYPTION_KEY.
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
    // Never pick a random mailbox — without an explicit from, callers must pass accessToken.
    if (!email) {
      console.error("Gmail from address is required for token lookup");
      return null;
    }
    const integrations = mongoose.connection.collection("userintegrations");
    const query: Record<string, unknown> = {
      provider: "gmail",
      email,
      status: { $in: ["connected", "needs_attention", "testing"] },
    };

    const row = await integrations
      .find(query)
      .sort({ isDefault: -1, updatedAt: -1 })
      .limit(1)
      .next();

    if (!row) {
      console.error("No Gmail integration in userintegrations for", email);
      return null;
    }

    const current = openSecret(row.encryptedAccessToken);
    const expiresAt = row.tokenExpiresAt ? new Date(row.tokenExpiresAt).getTime() : 0;
    if (!forceRefresh && current?.value && expiresAt > Date.now() + SKEW_MS) {
      return current.value;
    }

    const refreshToken = openSecret(row.encryptedRefreshToken);
    if (!refreshToken?.value) {
      console.error("Gmail refresh token missing for", email || row.email);
      return current?.value || null;
    }

    const tokens = await refreshGmailAccessToken(refreshToken.value);
    const accessToken = String(tokens.access_token || "");
    if (!accessToken) {
      console.error("Gmail refresh returned no access token for", email || row.email);
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
    console.error("Gmail token helper failed:", (error as Error).message);
    return null;
  }
}
