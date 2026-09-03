import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { getQueueStatus } from "../controllers/queue.controller";

const ROOM = "queue:messages";
const EVENT = "queue:status";
const QUEUE_NAME = "messages";

export function attachQueueRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    transports: ["websocket", "polling"],
    pingInterval: 20000,
    pingTimeout: 25000,
    connectTimeout: 10000,
  });

  const connection = new IORedis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
  });

  connection.on("error", (err) => {
    console.error("Queue realtime Redis error:", err.message);
  });

  const events = new QueueEvents(QUEUE_NAME, { connection });

  events.waitUntilReady().then(() => {
    console.log("\x1b[32m✔\x1b[0m Queue realtime attached");
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pushing = false;

  async function push() {
    if (pushing) return;
    pushing = true;
    try {
      io.to(ROOM).emit(EVENT, await getQueueStatus());
    } catch (err) {
      console.error("Queue realtime push failed:", (err as Error).message);
    } finally {
      pushing = false;
    }
  }

  function schedulePush() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, 200);
  }

  events.on("waiting", schedulePush);
  events.on("active", schedulePush);
  events.on("completed", schedulePush);
  events.on("failed", schedulePush);
  events.on("delayed", schedulePush);
  events.on("stalled", schedulePush);
  events.on("removed", schedulePush);

  io.on("connection", async (socket) => {
    socket.join(ROOM);
    try {
      socket.emit(EVENT, await getQueueStatus());
    } catch (err) {
      socket.emit("queue:error", { message: (err as Error).message });
    }
  });

  return io;
}
