import { Router } from "express";
import healthRoutes from "./health.routes";
import messageRoutes from "./message.routes";
import webhookRoutes from "./webhook.route"

const router = Router();

router.use("/health", healthRoutes);

router.use("/messages", messageRoutes);

router.use("/webhooks",webhookRoutes)

export default router;
