import mongoose from "mongoose";

const gmailMailboxCursorSchema = new mongoose.Schema(
  {
    emailAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    historyId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export const GmailMailboxCursor = mongoose.model(
  "GmailMailboxCursor",
  gmailMailboxCursorSchema,
  "communication_gmail_cursor"
);
