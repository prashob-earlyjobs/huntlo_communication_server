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

  const screeningQuery = `?campignId=${input.campignId}`
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
