import { Router } from "express";
import monitorController from "../controller/monitor.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// All monitor routes require authentication
router.use(verifyJWT);

// Dashboard summary metrics
router.get("/summary", monitorController.getDashboardSummary);

// CRUD
router.post("/", monitorController.createMonitor);
router.get("/", monitorController.getMonitors);
router.get("/:id", monitorController.getMonitorById);
router.put("/:id", monitorController.updateMonitor);
router.patch("/:id/toggle", monitorController.toggleMonitor);
router.delete("/:id", monitorController.deleteMonitor);

// Health check actions & historical metrics
router.post("/:id/check", monitorController.manualMonitorCheck);
router.get("/:id/history", monitorController.getMonitorHistory);
router.get("/:id/metrics", monitorController.getMonitorMetrics);

// Alert test & diagnostics
router.post("/test-alert", monitorController.testAlert);
router.get("/alert-config", monitorController.getAlertConfig);

export default router;
