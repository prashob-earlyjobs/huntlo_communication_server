import { Router } from "express";
import { gmailWebhookController,hunerCallRecordingController,hunerCallResultController,hunerCallStatusController,hunerCallSummaryController,metaWebhookController, zyvkayWebhookController } from "../controllers/webhook.controller";

const router = Router();

router.post("/gmail", gmailWebhookController);

router.post("/meta-whatsapp", metaWebhookController);

router.post("/hunar/call-status",hunerCallStatusController)

router.post("/hunar/call-recording",hunerCallRecordingController)

router.post("/hunar/call-result",hunerCallResultController)

router.post("/hunar/call-summary",hunerCallSummaryController)

router.post("/zyvkay", zyvkayWebhookController)

export default router;
