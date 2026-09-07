const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function extensionFromMime(mimeType: string) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  return ".jpg";
}

export async function downloadWhatsappInboundImage(input: {
  mediaId: string;
  messageId: string;
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
      "WhatsApp image resolve failed:",
      metaJson?.error?.message || metaRes.status
    );
    return null;
  }

  const fileRes = await fetch(String(metaJson.url), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) {
    console.error("WhatsApp image download failed:", fileRes.status);
    return null;
  }

  const mimeType =
    String(fileRes.headers.get("content-type") || metaJson.mime_type || "image/jpeg")
      .split(";")[0]
      ?.trim() || "image/jpeg";
  const filename = `${messageId}${extensionFromMime(mimeType)}`;

  return {
    buffer: Buffer.from(await fileRes.arrayBuffer()),
    filename,
    mimeType,
  };
}
