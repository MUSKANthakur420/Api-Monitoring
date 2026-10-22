import QueueService from "../services/queue.service.js";
import dotenv from "dotenv";

dotenv.config();

let schedulerTimer = null;

export const startMonitorScheduler = () => {
    if (schedulerTimer) {
        console.log("⚠️ Scheduler is already running");
        return;
    }

    const intervalSeconds = Number(process.env.CHECK_INTERVAL_SECONDS) || 60;
    const intervalMs = intervalSeconds * 1000;

    console.log(`⏰ Starting Health Check Scheduler (Trigger interval: every ${intervalSeconds}s)...`);

    // Run first batch immediately after a small 3-second grace period
    setTimeout(() => {
        QueueService.dispatchAllActiveChecks();
    }, 3000);

    // Schedule subsequent batches
    schedulerTimer = setInterval(async () => {
        await QueueService.dispatchAllActiveChecks();
    }, intervalMs);

    return schedulerTimer;
};

export const stopMonitorScheduler = () => {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
        console.log("🛑 Health Check Scheduler stopped");
    }
};

export default {
    startMonitorScheduler,
    stopMonitorScheduler,
};
