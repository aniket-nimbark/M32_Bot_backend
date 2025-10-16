import { Router } from "express";
import { HealthController } from "../controllers/health.controller.js";

const router = Router();
const healthController = new HealthController();

router.post("/chat", healthController.chat);

router.post("/health/consult", healthController.healthcareConsult);
router.get("/health/news", healthController.getHealthNews);

router.post("/personal/chat", healthController.personalChat);
router.get("/personal/context", healthController.getUserContext);

router.post("/clear", healthController.clearHistory);
router.get("/system", healthController.getSystemInfo);

export default router;
