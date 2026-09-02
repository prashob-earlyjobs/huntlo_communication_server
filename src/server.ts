import dotenv from "dotenv";
import app from "./app";
import { connectDb } from "./db/mongoose";
import { connectRedis, startMessageWorker } from "./queue/message.queue";

dotenv.config();

async function start() {
  const port = Number(process.env.PORT) || 5055;
  const env = process.env.NODE_ENV || "development";

  await connectDb();
  await connectRedis();
  startMessageWorker();

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    console.log("\x1b[32m✔\x1b[0m Google credentials loaded");
  } else {
    console.log("Google credentials missing (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
  }

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port} [${env}]`);
  });
}

start();
