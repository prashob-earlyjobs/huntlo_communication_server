import { Router } from "express";
import { gmailWebhookController } from "../controllers/webhook.controller";

const router = Router();

router.post("/gmail", gmailWebhookController);

export default router;
