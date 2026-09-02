export async function sendGmailMessage(input: {
  accessToken?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string | null;
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
}) {
  const accessToken = input.accessToken || process.env.GOOGLE_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error(
      "Gmail credentials required: set GOOGLE_ACCESS_TOKEN in .env or pass details.accessToken"
    );
  }

  const raw = toGmailRawPayload(input);
  
  const body: Record<string, string> = { raw };
  if (input.threadId) body.threadId = input.threadId;

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to send Gmail message");
  }
  console.log("mail send")
  return { messageId: data.id, threadId: data.threadId };
}

function toGmailRawPayload(input) {
  const headers = [
    `To: ${input.to}`,
    input.from ? `From: ${input.from}` : null,
    `Subject: ${input.subject || "(no subject)"}`,
    input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : null,
    input.references ? `References: ${input.references}` : null,
    "MIME-Version: 1.0",
    input.html
      ? 'Content-Type: text/html; charset="UTF-8"'
      : 'Content-Type: text/plain; charset="UTF-8"',
  ].filter(Boolean);

  const rfc822 = [...headers, "", input.html || input.text || ""].join("\r\n");

  return Buffer.from(rfc822, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
