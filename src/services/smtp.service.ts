import nodemailer from "nodemailer";
import { SmtpConfig } from "../types/message.types";

const SMTP_DEFAULTS = {
  smtpPort: 587,
  security: "STARTTLS",
  imapPort: 993,
};

export async function sendSmtpMessage(input: {
  to: string;
  subject?: string;
  body?: string;
  html?: string;
  smtp?: SmtpConfig;
}) {
  const smtp = { ...SMTP_DEFAULTS, ...input.smtp };
  const username = smtp.username || smtp.from;
  const fromAddress = smtp.from || username;

  if (!smtp.smtpHost || !username || !smtp.password) {
    throw new Error("smtp.smtpHost, smtp.username (or smtp.from), and smtp.password are required");
  }

  const port = Number(smtp.smtpPort) || SMTP_DEFAULTS.smtpPort;
  const security = String(smtp.security || SMTP_DEFAULTS.security).toUpperCase();
  const implicitSsl = security === "SSL" || port === 465;
  const useStartTls =
    !implicitSsl && security !== "NONE";

  const transporter = nodemailer.createTransport({
    host: smtp.smtpHost,
    port,
    secure: implicitSsl,
    requireTLS: useStartTls,
    auth: {
      user: username,
      pass: smtp.password,
    },
  });

  const from = smtp.displayName
    ? `"${smtp.displayName}" <${fromAddress}>`
    : fromAddress;

  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject || "(no subject)",
    text: input.body,
    html: input.html,
  });

  return { messageId: info.messageId };
}
