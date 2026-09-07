import { Request, Response } from "express";
import { sendError, sendSuccess } from "../helpers/requestHandler";
import { sendMessageSchema } from "../helpers/sendMessage.schema";
import { enqueueMessage } from "../queue/message.queue";

export async function sendMessage(req: Request, res: Response) {
  try {
    const { error, value } = sendMessageSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      console.error(
        "POST /send validation failed:",
        error.details.map((detail) => detail.message).join("; ")
      );
      return sendError(
        res,
        400,
        error.details.map((detail) => detail.message)
      );
    }

    let result = value;
    const autoReply =
      String(req.query.autoReply).toLowerCase() === "true";

    if (autoReply && !String(value.prompt || "").trim()) {
      return sendError(res, 400, "prompt is required when autoReply is true");
    }

    const campaignId = value.campaignId || value.campaign_id;
    if (autoReply && !String(campaignId || "").trim()) {
      return sendError(res, 400, "campaignId is required when autoReply is true");
    }

    switch (value.type) {
      case "email":
      case "whatsapp":
      case "call":  
        result = await enqueueMessage({ ...value, autoReply });
        console.log(
          "POST /send queued",
          value.type,
          value.vendor,
          "jobId=",
          result?.jobId,
          "to=",
          value.to || value.data?.[0]?.mobile_number,
          autoReply ? "autoReply" : ""
        );
        break;
      default:
        return sendError(res, 400, "This message type is not implemented yet");
    }

    return sendSuccess(res, 200, result);
  } catch (error) {
    console.error("POST /send failed:", error.message || error);
    return sendError(res, 500, error.message || "Internal server error");
  }
}
