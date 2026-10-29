export const sendWhatsappMessageHuntlo = async (input: {
    template?: string,
    to: string,
    body?: string,
    variables?: string[]
}) => {
    const phoneNumberId = process.env.HUNTLO_WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.HUNTLO_WHATSAPP_ACCESS_TOKEN;

    if (input.template) {
        const template: any = {
            name: input.template,
            language: { code: "en" },
        };

        if (input.variables?.length) {
            template.components = [
                {
                    type: "body",
                    parameters: input.variables.map((value) => ({
                        type: "text",
                        text: String(value),
                    })),
                },
            ];
        }

        const res = await fetch(
            `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: input.to,
                    type: "template",
                    template,
                }),
            }
        );

        const data: any = await res.json();

        if (!res.ok) {
            console.log("whatsapp error:",data)
            throw new Error(data?.error?.message || "Failed to send WhatsApp message");
        }

        return {
            messageId: data?.messages?.[0]?.id || data?.id,
        };
    }

    console.warn("this feature is not yet completed");
};

function normalizeWhatsappButtons(raw: unknown) {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  return value
    .map((button) => {
      const item = button?.reply || button || {};
      return {
        id: String(item.id || "").trim().slice(0, 256),
        title: String(item.title || item.text || "").trim().slice(0, 20),
      };
    })
    .filter((button) => button.id && button.title)
    .slice(0, 3);
}

export const sendWhatsappMessageTextHuntlo = async (input: {
  to: string;
  body: string;
  buttons?: { id: string; title: string }[];
}) => {
  const phoneNumberId = process.env.HUNTLO_WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.HUNTLO_WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp credentials required: HUNTLO_WHATSAPP_PHONE_NUMBER_ID and HUNTLO_WHATSAPP_ACCESS_TOKEN");
  }

  if (!input.body?.trim()) {
    throw new Error("body is required for WhatsApp text messages");
  }

  const buttons = normalizeWhatsappButtons(input.buttons);
  const payload = buttons.length
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: String(input.to).replace(/^\+/, ""),
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: input.body.slice(0, 1024),
          },
          action: {
            buttons: buttons.map((button) => ({
              type: "reply",
              reply: {
                id: button.id,
                title: button.title,
              },
            })),
          },
        },
      }
    : {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: {
          preview_url: false,
          body: input.body,
        },
      };

  console.log(
    "whatsapp send",
    payload.type,
    buttons.length ? `buttons=${buttons.map((b) => b.title).join(",")}` : "no-buttons"
  );

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data: any = await res.json();

  if (!res.ok) {
    console.log("whatsapp text error:", data);
    throw new Error(data?.error?.message || "Failed to send WhatsApp text message");
  }

  return {
    messageId: data?.messages?.[0]?.id || data?.id,
  };
};
