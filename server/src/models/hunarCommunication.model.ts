import { Schema, model } from "mongoose";

const hunarCommunicationSchema = new Schema(
  {
    agentId: { type: String, required: true },
    campaignId: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    callId: String,
    call_status: Schema.Types.Mixed,
    call_recording: Schema.Types.Mixed,
    call_result: Schema.Types.Mixed,
    call_summary: Schema.Types.Mixed,
  },
  { timestamps: true }
);

hunarCommunicationSchema.index(
  { agentId: 1, campaignId: 1, mobileNumber: 1 },
  { unique: true }
);

export const HunarCommunication = model(
  "HunarCommunication",
  hunarCommunicationSchema,
  "hcg_hunar_communications"
);
