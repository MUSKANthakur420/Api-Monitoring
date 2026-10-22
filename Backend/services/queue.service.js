import { Queue } from "bullmq";
import { redisConnectionOptions } from "../config/redis.js";
import Monitor from "../model/monitor.model.js";
import MonitorService from "./monitor.service.js";

export const MONITOR_QUEUE_NAME = "monitor-health-checks";

let monitorQueue = null;

export const getMonitorQueue = () => {
    if (!monitorQueue) {
        monitorQueue = new Queue(MONITOR_QUEUE_NAME, {
            connection: redisConnectionOptions,
            defaultJobOptions: {
                attempts: 2,
                backoff: {
                    type: "exponential",
                    delay: 2000,
                },
                removeOnComplete: {
                    count: 200,
                    age: 3600, // 1 hour
                },
                removeOnFail: {
                    count: 500,
                    age: 86400, // 24 hours
                },
            },
        });

        let lastQueueErrorLog = 0;
        monitorQueue.on("error", (err) => {
            const now = Date.now();
            if (now - lastQueueErrorLog > 30000) {
                lastQueueErrorLog = now;
                if (!err.message.includes("ECONNREFUSED")) {
                    console.error("🔴 Monitor Queue error:", err.message);
                }
            }
        });
    }
    return monitorQueue;
};

export const addMonitorCheckJob = async (monitorId, options = {}) => {
    try {
        const queue = getMonitorQueue();
        const jobName = `check-monitor-${monitorId}`;
        const job = await queue.add(
            jobName,
            { monitorId },
            {
                jobId: `${monitorId}-${Date.now()}`,
                ...options,
            }
        );
        return job;
    } catch (err) {
        console.error(`❌ Failed to enqueue check job for monitor ${monitorId}:`, err.message);
        throw err;
    }
};

export const dispatchAllActiveChecks = async () => {
    let activeMonitors = [];
    try {
        activeMonitors = await Monitor.getAllActiveMonitors(true);
        if (!activeMonitors || activeMonitors.length === 0) {
            return { dispatched: 0 };
        }

        const queue = getMonitorQueue();
        const jobs = activeMonitors.map((m) => ({
            name: `scheduled-check-${m.id}`,
            data: { monitorId: m.id },
            opts: {
                jobId: `cron-${m.id}-${Date.now()}`,
            },
        }));

        await queue.addBulk(jobs);
        console.log(`📡 Dispatched ${jobs.length} scheduled health check jobs to BullMQ worker pool`);
        return { dispatched: jobs.length };
    } catch (err) {
        console.warn("⚠️ BullMQ queue dispatch warning:", err.message);

        // Fallback: If Redis / BullMQ queue is unavailable, run checks directly in background
        if (activeMonitors && activeMonitors.length > 0) {
            console.log(`⚡ Executing ${activeMonitors.length} health checks directly (fallback mode)...`);
            for (const m of activeMonitors) {
                MonitorService.performCheck(m.id).catch((e) =>
                    console.warn(`Direct check failed for monitor #${m.id}:`, e.message)
                );
            }
        }
        return { dispatched: activeMonitors ? activeMonitors.length : 0, fallback: true };
    }
};

const QueueService = {
    getMonitorQueue,
    addMonitorCheckJob,
    dispatchAllActiveChecks,
};

export default QueueService;
