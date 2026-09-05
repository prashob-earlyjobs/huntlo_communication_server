import { Schema, model } from "mongoose";

const zyvkaCommunicationSchema = new Schema(
  {
    campaignId: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    calleeName: String,
    callId: String,
    prompt: String,
    metadata: Schema.Types.Mixed,
    call_status: Schema.Types.Mixed,
    call_recording: Schema.Types.Mixed,
    call_result: Schema.Types.Mixed,
    call_summary: Schema.Types.Mixed,
    questions: {
      type: [
        {
          id: String,
          question: String,
          required: { type: Boolean, default: false },
          pass_condition: String,
          asked: { type: Boolean, default: false },
          answer: String,
          status: {
            type: String,
            enum: ["unanswered", "passed", "failed"],
            default: "unanswered",
          },
          description: String,
        },
      ],
      default: [],
    },
    overallAIStatus: {
      type: String,
      enum: [
        "awaiting_reply",
        "interested",
        "not_interested",
        "in_qualification",
        "qualified",
        "not_qualified",
        "in_screening",
        "shortlisted",
        "rejected",
      ],
    },
    overallAIDescription: String,
  },
  { timestamps: true }
);

zyvkaCommunicationSchema.index(
  { campaignId: 1, mobileNumber: 1 },
  { unique: true }
);

zyvkaCommunicationSchema.index({ callId: 1 }, { sparse: true });

export const ZyvkaCommunication = model(
  "ZyvkaCommunication",
  zyvkaCommunicationSchema,
  "hcg_zyvkay_communications"
);
