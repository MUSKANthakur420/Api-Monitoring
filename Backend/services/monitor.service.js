import Monitor from "../model/monitor.model.js";
import MonitorCheck from "../model/monitorCheck.model.js";
import User from "../model/user.model.js";
import AlertService from "./alert.service.js";
import validateMonitorUrl from "../utils/urlValidator.js";
import { apierror } from "../utils/apierror.js";

const checkUrl = async (url) => {
    const startTime = Date.now();
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": "APIMonitoring-Sentinel/1.0",
                "Accept": "*/*",
            },
            signal: AbortSignal.timeout(10000), // 10s timeout
            redirect: "follow",
        });

        const responseTime = Date.now() - startTime;
        const statusCode = response.status;
        const isUp = statusCode >= 200 && statusCode < 400;
        const errorMessage = isUp ? null : `HTTP Status: ${statusCode} ${response.statusText || ""}`.trim();

        return {
            statusCode,
            responseTime,
            isUp,
            errorMessage,
        };
    } catch (error) {
        const responseTime = Date.now() - startTime;
        let errorMessage = error.message;

        if (error.name === "TimeoutError" || error.name === "AbortError") {
            errorMessage = "Connection Timed Out (exceeded 10,000ms)";
        }

        return {
            statusCode: null,
            responseTime,
            isUp: false,
            errorMessage,
        };
    }
};

const performCheck = async (monitorId, requestedUserId = null) => {
    const monitor = await Monitor.findMonitorById(monitorId, requestedUserId);
    if (!monitor) {
        throw new apierror(404, "Monitor not found");
    }

    const checkResult = await checkUrl(monitor.url);

    // Save check in monitor_checks table
    const checkRecord = await MonitorCheck.createMonitorCheck(
        monitor.id,
        checkResult.statusCode,
        checkResult.responseTime,
        checkResult.isUp,
        checkResult.errorMessage
    );

    const newStatus = checkResult.isUp ? "up" : "down";
    const previousStatus = monitor.last_status || "pending";

    // Failure & Recovery Detection logic
    let alertSent = false;
    try {
        const user = await User.findUserById(monitor.user_id);
        const userEmail = user?.email;
        const userName = user?.name || "Developer";

        if (userEmail) {
            // Condition 1: Failed check and previously was UP or PENDING
            if (!checkResult.isUp && previousStatus !== "down") {
                const alertResult = await AlertService.sendDowntimeAlert({
                    monitor,
                    userEmail,
                    userName,
                    statusCode: checkResult.statusCode,
                    responseTime: checkResult.responseTime,
                    errorMessage: checkResult.errorMessage,
                });
                alertSent = alertResult?.success === true;
            }
            // Condition 2: Recovered check and previously was DOWN
            else if (checkResult.isUp && previousStatus === "down") {
                const alertResult = await AlertService.sendRecoveryAlert({
                    monitor,
                    userEmail,
                    userName,
                    statusCode: checkResult.statusCode,
                    responseTime: checkResult.responseTime,
                });
                alertSent = alertResult?.success === true;
            }
        }
    } catch (alertErr) {
        console.warn("⚠️ Alert notification warning:", alertErr.message);
    }

    // Update cached status in monitors table
    try {
        await Monitor.updateMonitorStatus(monitor.id, {
            lastStatus: newStatus,
            lastStatusCode: checkResult.statusCode,
            lastResponseTime: checkResult.responseTime,
            isUp: checkResult.isUp,
        });
    } catch (statusErr) {
        console.warn("⚠️ Could not update monitor cached status:", statusErr.message);
    }

    return {
        check: checkRecord,
        status: newStatus,
        previousStatus,
        alertSent,
    };
};

const getMonitorHistory = async (monitorId, userId, limit = 50) => {
    const monitor = await Monitor.findMonitorById(monitorId, userId);
    if (!monitor) throw new apierror(404, "Monitor not found");

    return await MonitorCheck.getMonitorChecks(monitorId, limit);
};

const getMonitorMetrics = async (monitorId, userId, hours = 24) => {
    const monitor = await Monitor.findMonitorById(monitorId, userId);
    if (!monitor) throw new apierror(404, "Monitor not found");

    const metrics = await MonitorCheck.getMonitorMetrics(monitorId, hours);
    const timeline = await MonitorCheck.getLatencyTimeline(monitorId, 50);
    const incidents = await MonitorCheck.getIncidentAlerts(monitorId, 10);

    return {
        monitor,
        metrics,
        timeline,
        incidents,
    };
};

const MonitorService = {
    checkUrl,
    performCheck,
    monitorCheck: performCheck, // alias for backwards compatibility
    getMonitorHistory,
    getMonitorMetrics,
};

export default MonitorService;
export { checkUrl, performCheck, getMonitorHistory, getMonitorMetrics };