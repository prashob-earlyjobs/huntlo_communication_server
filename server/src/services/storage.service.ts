import fs from "node:fs";
import path from "node:path";
import { Storage } from "@google-cloud/storage";

function extractBalancedJson(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return "";

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return "";
}

function readCredentialsFromEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return "";

  const text = fs.readFileSync(envPath, "utf8");
  const match = text.match(/^GCS_CREDENTIALS\s*=\s*/m);
  if (!match || match.index === undefined) return "";

  return extractBalancedJson(text.slice(match.index + match[0].length));
}

function parseCredentials(raw: string) {
  const json = extractBalancedJson(raw) || raw.trim();
  if (!json) return null;

  const credentials = JSON.parse(json.startsWith("{") ? json : Buffer.from(json, "base64").toString("utf8"));
  if (typeof credentials.private_key === "string") {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }
  return credentials;
}

function getInlineCredentials() {
  try {
    const fromEnv = parseCredentials(process.env.GCS_CREDENTIALS || "");
    if (fromEnv) return fromEnv;
  } catch {
    // dotenv only keeps the first line of a multiline JSON value
  }
  return parseCredentials(readCredentialsFromEnvFile());
}

function getStorage() {
  const credentials = getInlineCredentials();
  if (!credentials?.client_email || !credentials?.private_key?.includes("END PRIVATE KEY")) {
    throw new Error(
      "GCS_CREDENTIALS is incomplete. Paste the full service-account JSON, including -----END PRIVATE KEY-----"
    );
  }

  return new Storage({
    projectId: credentials.project_id || process.env.GCS_PROJECT_ID,
    credentials,
  });
}

export async function uploadImage(input: {
  campaignId: string;
  filename: string;
  buffer: Buffer;
  contentType?: string;
}) {
  const bucketName = process.env.GCS_BUCKET_NAME || "huntlo-whatsapp-media";
  const folder = String(input.campaignId || "unknown").trim() || "unknown";
  const destination = `${folder}/${input.filename}`;

  await getStorage()
    .bucket(bucketName)
    .file(destination)
    .save(input.buffer, {
      metadata: {
        contentType: input.contentType || "image/jpeg",
      },
    });

  const publicPath = destination
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://storage.googleapis.com/${bucketName}/${publicPath}`;
}
