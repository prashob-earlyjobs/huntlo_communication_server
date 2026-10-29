import { createDecipheriv } from "crypto";
import mongoose from "mongoose";

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;

type EncryptedPayload = {
  ciphertext?: string;
  iv?: string;
  authTag?: string;
};

export type WhatsappSender = {
  phoneNumberId: string;
  accessToken: string;
  wabaId: string;
};

function encryptionKeys() {
  return [process.env.SMTP_ENCRYPTION_KEY, process.env.ENCRYPTION_KEY]
    .map((value) => String(value || "").trim())
    .filter((value, index, all) => /^[0-9a-fA-F]{64}$/.test(value) && all.indexOf(value) === index)
    .map((value) => Buffer.from(value, "hex"));
}

function decryptSecret(payload?: EncryptedPayload | null) {
  if (!payload?.ciphertext || !payload.iv || !payload.authTag) return "";
  const iv = Buffer.from(payload.iv, "base64url");
  const authTag = Buffer.from(payload.authTag, "base64url");
  const ciphertext = Buffer.from(payload.ciphertext, "base64url");
  for (const key of encryptionKeys()) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      // Client tokens are encrypted with the Huntlo key. Try the next key.
    }
  }
  return "";
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function envSender(): WhatsappSender {
  return {
    phoneNumberId: String(process.env.HUNTLO_WHATSAPP_PHONE_NUMBER_ID || "").trim(),
    accessToken: String(process.env.HUNTLO_WHATSAPP_ACCESS_TOKEN || "").trim(),
    wabaId: String(process.env.HUNTLO_WHATSAPP_WABA_ID || "").trim(),
  };
}

export async function getWhatsappSender(from?: string | null): Promise<WhatsappSender> {
  const raw = String(from || "").trim();
  if (!raw) return envSender();

  const needle = digits(raw);
  if (needle.length < 8) {
    throw new Error(`WhatsApp from must be a phone number or phone number ID`);
  }
  const last10 = needle.slice(-10);
  const integrations = mongoose.connection.collection("userintegrations");
  const rows = await integrations
    .find({
      provider: { $in: ["meta-whatsapp", "huntlo-whatsapp"] },
      status: { $in: ["connected", "needs_attention", "testing"] },
    })
    .sort({ isDefault: -1, updatedAt: -1 })
    .limit(100)
    .toArray();

  const matches = rows.filter((row) => {
    const values = [
      row.providerAccountId,
      row.config?.metaPhoneNumberId,
      row.phone,
      row.email,
    ];
    return values.some((value) => {
      const current = digits(value);
      return current === needle || (current.length >= 10 && current.endsWith(last10));
    });
  });
  const row = matches.sort((a, b) => {
    if (a.provider === b.provider) return 0;
    return a.provider === "meta-whatsapp" ? -1 : 1;
  })[0];

  if (!row) {
    throw new Error(`No WhatsApp integration in userintegrations for ${raw}`);
  }

  const phoneNumberId = String(
    row.config?.metaPhoneNumberId || row.providerAccountId || ""
  ).trim();
  const wabaId = String(row.config?.metaWabaId || "").trim();
  const storedToken = decryptSecret(row.encryptedAccessToken);
  const fallback = envSender();
  const accessToken =
    storedToken ||
    (row.provider === "huntlo-whatsapp" && phoneNumberId === fallback.phoneNumberId
      ? fallback.accessToken
      : "");

  if (!phoneNumberId || !accessToken) {
    throw new Error(`WhatsApp integration for ${raw} is missing a phone number ID or access token`);
  }

  return {
    phoneNumberId,
    accessToken,
    wabaId: wabaId || (row.provider === "huntlo-whatsapp" ? fallback.wabaId : ""),
  };
}
