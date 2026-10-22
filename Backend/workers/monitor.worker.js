import { Worker } from "bullmq";
import { redisConnectionOptions } from "../config/redis.js";
import { MONITOR_QUEUE_NAME } from "../services/queue.service.js";
import MonitorService from "../services/monitor.service.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

let worker = null;

export const startMonitorWorker = () => {
    if (worker) return worker;

    const concurrency = Number(process.env.WORKER_CONCURRENCY) || 10;

    worker = new Worker(
        MONITOR_QUEUE_NAME,
        async (job) => {
            const { monitorId } = job.data;
            const startTime = Date.now();

            try {
                const result = await MonitorService.performCheck(monitorId);
                const duration = Date.now() - startTime;

                return {
                    monitorId,
                    status: result.status,
                    statusCode: result.check?.status_code,
                    latency: result.check?.response_time,
                    alertSent: result.alertSent,
                    processedInMs: duration,
                };
            } catch (error) {
                console.error(`❌ Worker failed processing monitor ${monitorId}:`, error.message);
                throw error;
            }
        },
        {
            connection: redisConnectionOptions,
            concurrency,
        }
    );

    worker.on("ready", () => {
        console.log(`🚀 BullMQ Worker active and listening on queue "${MONITOR_QUEUE_NAME}" (Concurrency: ${concurrency})`);
    });

    worker.on("completed", (job, returnvalue) => {
        const icon = returnvalue.status === "up" ? "🟢" : "🔴";
        console.log(
            `${icon} [Check Done] Monitor #${returnvalue.monitorId} -> Status: ${returnvalue.status.toUpperCase()} (${returnvalue.statusCode || "N/A"}) | Latency: ${returnvalue.latency}ms | Alert: ${returnvalue.alertSent ? "SENT" : "NO"}`
        );
    });

    worker.on("failed", (job, err) => {
        console.error(`💥 Job #${job?.id} failed for monitor ${job?.data?.monitorId}:`, err.message);
    });

    let lastWorkerErrorLog = 0;
    worker.on("error", (err) => {
        const now = Date.now();
        if (now - lastWorkerErrorLog > 30000) {
            lastWorkerErrorLog = now;
            if (err.message.includes("ECONNREFUSED")) {
                console.warn("⚠️ BullMQ Worker: Redis is offline at 127.0.0.1:6379. Waiting for Redis to start (run 'docker compose up -d redis' or 'brew services start redis')...");
            } else {
                console.error("🔴 BullMQ Worker internal error:", err.message);
            }
        }
    });

    return worker;
};

// If run directly from terminal: `node workers/monitor.worker.js`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log("⚡ Starting standalone BullMQ Monitor Worker process...");
    startMonitorWorker();
}

export default startMonitorWorker;
