export enum MessageType {
  EMAIL = "email",
  WHATSAPP = "whatsapp",
  CALL = "call",
}
  
export enum MessageVendor {
  GMAIL = "gmail",
  OUTLOOK = "outlook",
  HUNTLO = "huntlo",
  SMTP = "smtp",
  META = "meta",
  HUNAR = "hunar",
  ZYVKAY = "zyvkay",
  ZOHO = "zoho"
}

export type SmtpConfig = {
  from?: string;
  displayName?: string;
  username?: string;
  password?: string;
  smtpHost?: string;
  smtpPort?: number | string;
  security?: string;
  imapHost?: string;
  imapPort?: number | string;
};

export type WhatsappButton = {
  id: string;
  title: string;
};

export type SendMessageBody = {
  type: MessageType;
  vendor: MessageVendor;
  to: string;
  subject?: string;
  body?: string;
  html?: string;
  from?: string;
  smtp?: SmtpConfig;
  accessToken?: string;
  refreshToken?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  template?: string;
  variables?: string[];
  buttons?: WhatsappButton[];
  accountId?:string,
  dataCenter?:string,
  fromAddress?:string,
  text?:string
};
