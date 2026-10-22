import Monitor from "../model/monitor.model.js";
import { apierror } from "../utils/apierror.js";
import { apires } from "../utils/apires.js";
import asynchandler from "../utils/asynchandler.js";
import MonitorService from "../services/monitor.service.js";
import validateMonitorUrl from "../utils/urlValidator.js";
import QueueService from "../services/queue.service.js";
import AlertService from "../services/alert.service.js";

const createMonitor = asynchandler(async (req, res) => {
    const { name, url, intervalSeconds } = req.body;
    const userId = req.user.id;

    if (!name || !url) {
        throw new apierror(400, "Monitor name and URL are required");
    }

    // SSRF protection and URL validation
    let validatedUrl;
    try {
        validatedUrl = await validateMonitorUrl(url.trim());
    } catch (err) {
        throw new apierror(400, `Invalid target URL: ${err.message}`);
    }

    const interval = Number(intervalSeconds) || 60;
    const monitor = await Monitor.createMonitor(userId, name.trim(), validatedUrl.toString(), interval);

    // Run an initial check in background immediately so user gets instant status
    MonitorService.performCheck(monitor.id, userId).catch((err) => {
        console.error(`Initial check failed for monitor ${monitor.id}:`, err.message);
    });

    return res.status(201).json(
        new apires(201, "Monitor created successfully. Initial check started.", monitor)
    );
});

const getMonitors = asynchandler(async (req, res) => {
    const userId = req.user.id;
    const monitors = await Monitor.getMonitorsByUserId(userId);

    return res.status(200).json(
        new apires(200, "Monitors fetched successfully", monitors)
    );
});

const getMonitorById = asynchandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const monitor = await Monitor.findMonitorById(id, userId);
    if (!monitor) {
        throw new apierror(404, "Monitor not found");
    }

    return res.status(200).json(
        new apires(200, "Monitor fetched successfully", monitor)
    );
});

const updateMonitor = asynchandler(async (req, res) => {
    const { id } = req.params;
    const { name, url, intervalSeconds } = req.body;
    const userId = req.user.id;

    let validatedUrlString = undefined;
    if (url) {
        try {
            const parsed = await validateMonitorUrl(url.trim());
            validatedUrlString = parsed.toString();
        } catch (err) {
            throw new apierror(400, `Invalid URL: ${err.message}`);
        }
    }

    const monitor = await Monitor.updateMonitorById(
        id,
        userId,
        name ? name.trim() : undefined,
        validatedUrlString,
        intervalSeconds ? Number(intervalSeconds) : undefined
    );

    if (!monitor) {
        throw new apierror(404, "Monitor not found or unauthorized");
    }

    return res.status(200).json(
        new apires(200, "Monitor updated successfully", monitor)
    );
});

const toggleMonitor = asynchandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const monitor = await Monitor.toggleMonitorActive(id, userId);
    if (!monitor) {
        throw new apierror(404, "Monitor not found");
    }

    return res.status(200).json(
        new apires(200, `Monitor ${monitor.is_active ? "resumed" : "paused"} successfully`, monitor)
    );
});

const deleteMonitor = asynchandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const monitor = await Monitor.deleteMonitorById(id, userId);
    if (!monitor) {
        throw new apierror(404, "Monitor not found or unauthorized");
    }

    return res.status(200).json(
        new apires(200, "Monitor deleted successfully", monitor)
    );
});

const manualMonitorCheck = asynchandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await MonitorService.performCheck(id, userId);

    return res.status(200).json(
        new apires(200, "Health check completed successfully", result)
    );
});

const getMonitorHistory = asynchandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const limit = Number(req.query.limit) || 50;

    const history = await MonitorService.getMonitorHistory(id, userId, limit);

    return res.status(200).json(
        new apires(200, "Monitor check history fetched successfully", history)
    );
});

const getMonitorMetrics = asynchandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const hours = Number(req.query.hours) || 24;

    const data = await MonitorService.getMonitorMetrics(id, userId, hours);

    return res.status(200).json(
        new apires(200, "Monitor metrics and timeline fetched successfully", data)
    );
});

const getDashboardSummary = asynchandler(async (req, res) => {
    const userId = req.user.id;
    const summary = await Monitor.getGlobalDashboardSummary(userId);

    return res.status(200).json(
        new apires(200, "Dashboard summary fetched successfully", summary)
    );
});

const testAlert = asynchandler(async (req, res) => {
    const { email, type = "down", preferEthereal = false } = req.body;
    const targetEmail = email || req.user?.email;

    if (!targetEmail) {
        throw new apierror(400, "Recipient email is required");
    }

    const result = await AlertService.sendTestAlert({
        userEmail: targetEmail,
        userName: req.user?.name || "Developer",
        type,
        preferEthereal: Boolean(preferEthereal),
    });

    return res.status(result.success ? 200 : 500).json(
        new apires(
            result.success ? 200 : 500,
            result.success ? `Test alert sent to ${targetEmail}` : `Failed to send alert: ${result.error}`,
            result
        )
    );
});

const getAlertConfig = asynchandler(async (req, res) => {
    const status = await AlertService.verifyTransporter();
    return res.status(200).json(
        new apires(200, "Alert transporter status fetched", status)
    );
});

export default {
    createMonitor,
    getMonitors,
    getMonitorById,
    updateMonitor,
    toggleMonitor,
    deleteMonitor,
    manualMonitorCheck,
    getMonitorHistory,
    getMonitorMetrics,
    getDashboardSummary,
    testAlert,
    getAlertConfig,
};