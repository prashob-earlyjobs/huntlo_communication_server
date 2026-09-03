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

export const sendWhatsappMessageTextHuntlo = async (input: {
  to: string;
  body: string;
}) => {
  const phoneNumberId = process.env.HUNTLO_WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.HUNTLO_WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp credentials required: HUNTLO_WHATSAPP_PHONE_NUMBER_ID and HUNTLO_WHATSAPP_ACCESS_TOKEN");
  }

  if (!input.body?.trim()) {
    throw new Error("body is required for WhatsApp text messages");
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
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: {
          preview_url: false,
          body: input.body,
        },
      }),
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
