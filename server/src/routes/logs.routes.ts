import { Router } from "express";
import { getLogs } from "../controllers/logs.controller";

const router = Router();

router.get("/", getLogs);

export default router;
