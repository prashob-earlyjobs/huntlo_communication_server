import {Schema,model} from "mongoose";

const communicationSchema = new Schema( {
    type: {
      type: String,
      enum: ["email", "whatsapp", "call"],
      required: true
    },

    vendor: {
      type: String,
      required: true
    },

    receiver: {
      type: String,
      required: true
    },

    message: {
      type: String
    },

    details: {
      type: Schema.Types.Mixed
    },

    metadata: {
      type: Schema.Types.Mixed
    },

    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true
    },

    status: {
      type: String,
      enum: [
        "queued",
        "processing",
        "sent",
        "failed"
      ],
      default: "queued"
    },

    attempts: {
      type: Number,
      default: 0
    },

    providerMessageId: {
      type: String
    },

    error: {
      type: String
    }
  },
  {
    timestamps: true
  })

  
  module.exports = model("Communication", communicationSchema, "hcg_communications");