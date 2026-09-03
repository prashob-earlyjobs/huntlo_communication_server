import { Router } from "express";
import healthRoutes from "./health.routes";
import messageRoutes from "./message.routes";
import webhookRoutes from "./webhook.route"
import logsRoutes from "./logs.routes";

const router = Router();

router.use("/health", healthRoutes);

router.use("/messages", messageRoutes);

router.use("/webhooks",webhookRoutes)

router.use("/logs", logsRoutes);

export default router;
