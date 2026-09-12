export function getZohoDcConfig(dataCenter?: string) {
  const dc = String(dataCenter || "com").toLowerCase().trim();
  const hosts: Record<string, string> = {
    com: "mail.zoho.com",
    eu: "mail.zoho.eu",
    in: "mail.zoho.in",
    au: "mail.zoho.com.au",
    "com.au": "mail.zoho.com.au",
    jp: "mail.zoho.jp",
    ca: "mail.zohocloud.ca",
    sa: "mail.zoho.sa",
  };

  return {
    mailApiHost: hosts[dc] || hosts.com,
  };
}

async function parseZohoError(res: Response, data?: any) {
  const body =
    data ??
    (await res.json().catch(async () => ({
      message: await res.text().catch(() => ""),
    })));

  const message =
    body?.data?.errorCode ||
    body?.data?.moreInfo ||
    body?.message ||
    body?.error?.message ||
    (typeof body === "string" ? body : "") ||
    `Zoho Mail send failed (${res.status})`;

  throw new Error(String(message));
}

export async function sendZohoMessage(input: {
  accessToken: string;
  accountId: string;
  dataCenter?: string;
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  inReplyToMessageId?: string;
}): Promise<{ messageId?: string }> {
  if (!input.accessToken?.trim()) {
    throw new Error("Zoho accessToken is required");
  }
  if (!input.accountId?.trim()) {
    throw new Error("Zoho accountId is required");
  }
  if (!input.from?.trim()) {
    throw new Error("Zoho from is required");
  }
  if (!input.to?.trim()) {
    throw new Error("Zoho to is required");
  }

  const dc = getZohoDcConfig(input.dataCenter);
  const content = input.html || input.text || "";
  const replyTo = String(input.inReplyToMessageId || "").trim();
  const path = replyTo
    ? `/api/accounts/${encodeURIComponent(input.accountId)}/messages/${encodeURIComponent(replyTo)}`
    : `/api/accounts/${encodeURIComponent(input.accountId)}/messages`;
  const res = await fetch(`https://${dc.mailApiHost}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${input.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      fromAddress: input.from,
      toAddress: input.to,
      subject: input.subject || "(no subject)",
      content,
      mailFormat: input.html ? "html" : "plaintext",
      ...(replyTo ? { action: "reply" } : {}),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    data?: { messageId?: string; mailId?: string };
    message?: string;
  };


  if (!res.ok) {
    await parseZohoError(res, data);
  }

  return {
    messageId:
      (typeof data.data?.messageId === "string" && data.data.messageId) ||
      (typeof data.data?.mailId === "string" && data.data.mailId) ||
      undefined,
  };
}
