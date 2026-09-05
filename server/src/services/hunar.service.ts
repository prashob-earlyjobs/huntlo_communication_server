export const makeHunarCall = async (input: {
  agentId: string;
  data:[object],
  campignId: string
}) => {
  const apiKey = process.env.HUNAR_API_KEY;
  const callbackBaseUrl = process.env.HUNAR_CALLBACK_BASE_URL;

  if (!apiKey) {
    throw new Error("HUNAR_API_KEY is required");
  }

  if(!callbackBaseUrl){
    throw new Error("HUNAR_CALLBACK_BASE_URL is required");
  }

  console.log("callbackurl is :",callbackBaseUrl)

  const campaignId = encodeURIComponent(String(input.campignId || ""));
  const screeningQuery = campaignId
    ? `?campignId=${campaignId}&campaign_id=${campaignId}`
    : "";
  const res = await fetch("https://api.voice.hunar.ai/external/v1/calls/bulk/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      agent_id: input.agentId,
      data:input?.data,
      retry_config: {
        max_retry_count: 2,
        retry_interval_hours: 6,
      },
      callback_config: callbackBaseUrl
        ? {
            call_status_callback_url: `${callbackBaseUrl}/api/v1/webhooks/hunar/call-status${screeningQuery}`,
            call_recording_callback_url: `${callbackBaseUrl}/api/v1/webhooks/hunar/call-recording${screeningQuery}`,
            call_result_callback_url: `${callbackBaseUrl}/api/v1/webhooks/hunar/call-result${screeningQuery}`,
            call_summary_callback_url: `${callbackBaseUrl}/api/v1/webhooks/hunar/call-summary${screeningQuery}`,
          }
        : undefined,
      remove_invalid_rows: true,
      remove_duplicate_phone_numbers: true,
    }),
  });

  const data: any = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Failed to make Hunar call");
  }

  return data;
};

function splitCalleeName(fullName: string) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "there",
    lastName: parts.slice(1).join(" "),
  };
}

function zyvkaAnalysisVariables(questions: unknown) {
  let items = questions;
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  if (Array.isArray(items)) {
    const ids = items
      .map((item: any) => String(item?.id || "").trim())
      .filter(Boolean);
    if (ids.length) return ids;
  }
  return ["summary", "interest_level", "notice_period"];
}

export const makeZyvkayCall = async (input: {
  campaignId: string;
  prompt?: string;
  data: Array<{
    callee_name: string;
    mobile_number: string;
    custom_data?: Record<string, string>;
  }>;
  metadata?: Record<string, unknown>;
  questions?: unknown;
}) => {
  const apiKey = process.env.ZYVKA_API_KEY || process.env.ZYASTRA_API_KEY;
  const apiSecret = process.env.ZYVKA_API_SECRET || process.env.ZYASTRA_API_SECRET;
  const webhookSecret =
    process.env.ZYVKA_WEBHOOK_SECRET || process.env.ZYASTRA_WEBHOOK_SECRET;
  const callbackBaseUrl = String(
    process.env.ZYVKA_CALLBACK_BASE_URL ||
      process.env.HUNAR_CALLBACK_BASE_URL ||
      ""
  ).replace(/\/$/, "");

  if (!apiKey) {
    throw new Error("ZYVKA_API_KEY is required");
  }
  if (!apiSecret) {
    throw new Error("ZYVKA_API_SECRET is required");
  }
  if (!callbackBaseUrl) {
    throw new Error("ZYVKA_CALLBACK_BASE_URL or HUNAR_CALLBACK_BASE_URL is required");
  }

  const prompt = String(input.prompt || "").trim();
  if (!prompt) {
    throw new Error("prompt is required for zyvkay");
  }

  const callees = Array.isArray(input.data) ? input.data : [];
  if (!callees.length) {
    throw new Error("data must include at least one callee");
  }

  const analysisVariables = zyvkaAnalysisVariables(input.questions);
  const results: Array<{
    id: string;
    call_id: string;
    mobile_number: string;
    requestId: string;
    status: string;
  }> = [];

  for (const callee of callees) {
    const phone = String(callee.mobile_number || "").trim();
    const { firstName, lastName } = splitCalleeName(callee.callee_name);
    const firstMessage =
      callee.custom_data?.firstMessage ||
      `Hello, am I speaking with ${callee.callee_name || firstName}?`;

    const payload = {
      candidate: {
        phoneNumber: phone,
        firstName,
        ...(lastName ? { lastName } : {}),
      },
      agent: {
        prompt,
        firstMessage,
        preferredLanguage: callee.custom_data?.preferredLanguage || "en-US",
      },
      voiceConfiguration: {
        engine: "global-std",
        speed: 1.0,
      },
      webhook: {
        url: `${callbackBaseUrl}/api/v1/webhooks/zyvkay`,
        ...(webhookSecret ? { secret: webhookSecret } : {}),
      },
      analysisVariables,
      metadata: {
        source: "outreach",
        campaignId: String(input.campaignId || ""),
        ...(input.metadata || {}),
      },
    };

    const res = await fetch(
      "https://astraapi.zyvka.com/api/v1/external/voice/trigger",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": apiKey,
          "x-api-secret": apiSecret,
        },
        body: JSON.stringify(payload),
      }
    );

    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        body?.message || body?.error || "Failed to make Zyvka call"
      );
    }

    const data = body?.data && typeof body.data === "object" ? body.data : body;
    const callId = String(data.callId || data.call_id || body.callId || "");
    if (!callId) {
      throw new Error("Zyvka did not return a call id");
    }

    results.push({
      id: callId,
      call_id: callId,
      mobile_number: phone,
      requestId: String(data.requestId || ""),
      status: String(data.status || "queued"),
    });
  }

  return results;
};