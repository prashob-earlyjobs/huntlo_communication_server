const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function extensionFromMime(mimeType: string) {
  const mime = String(mimeType || "").toLowerCase().split(";")[0].trim();
  const known: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/3gpp": ".3gp",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "audio/amr": ".amr",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  };
  if (known[mime]) return known[mime];
  const subtype = mime.split("/")[1]?.replace(/[^a-z0-9]/g, "");
  return subtype ? `.${subtype.slice(0, 8)}` : ".bin";
}

function safeFilename(name: string) {
  const cleaned = name.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(0, 120);
  return cleaned.replace(/^\.+/, "") || "file";
}

export async function downloadWhatsappInboundMedia(input: {
  mediaId: string;
  messageId: string;
  filename?: string;
}): Promise<{ buffer: Buffer; filename: string; mimeType: string } | null> {
  const accessToken = process.env.HUNTLO_WHATSAPP_ACCESS_TOKEN;
  const mediaId = String(input.mediaId || "").trim();
  const messageId = String(input.messageId || "").trim();
  if (!accessToken || !mediaId || !messageId) return null;

  const metaRes = await fetch(`${GRAPH_BASE}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const metaJson: any = await metaRes.json().catch(() => ({}));
  if (!metaRes.ok || !metaJson?.url) {
    console.error(
      "WhatsApp media resolve failed:",
      metaJson?.error?.message || metaRes.status
    );
    return null;
  }

  const fileRes = await fetch(String(metaJson.url), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) {
    console.error("WhatsApp media download failed:", fileRes.status);
    return null;
  }

  const mimeType =
    String(fileRes.headers.get("content-type") || metaJson.mime_type || "application/octet-stream")
      .split(";")[0]
      ?.trim() || "application/octet-stream";
  const originalName = safeFilename(String(input.filename || "").trim());
  const filename = originalName && originalName !== "file"
    ? `${messageId}-${originalName}`
    : `${messageId}${extensionFromMime(mimeType)}`;

  return {
    buffer: Buffer.from(await fileRes.arrayBuffer()),
    filename,
    mimeType,
  };
}
