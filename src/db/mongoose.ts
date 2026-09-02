import dns from "dns";
import mongoose from "mongoose";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

export async function connectDb() {
  const uri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/humtlo-communication-gateway";

  await mongoose.connect(uri, {
    family: 4,
    serverSelectionTimeoutMS: 15000,
  });

  console.log("\x1b[32m✔\x1b[0m MongoDB connected");
}
