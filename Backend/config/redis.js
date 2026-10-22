import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const getRedisConnectionOptions = () => {
    const rawUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    try {
        const parsed = new URL(rawUrl);
        return {
            host: parsed.hostname || "127.0.0.1",
            port: Number(parsed.port) || 6379,
            username: parsed.username || undefined,
            password: parsed.password || undefined,
            tls: parsed.protocol === "rediss:" ? { rejectUnauthorized: false } : undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy(times) {
                // Wait 3s between retries when Redis is offline to prevent log spam
                return Math.min(times * 500, 3000);
            },
        };
    } catch {
        return {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy(times) {
                return Math.min(times * 500, 3000);
            },
        };
    }
};

export const redisConnectionOptions = getRedisConnectionOptions();

let redisClient = null;
let lastRedisErrorLog = 0;

export const getRedisClient = () => {
    if (!redisClient) {
        redisClient = new Redis(REDIS_URL, redisConnectionOptions);

        redisClient.on("connect", () => {
            console.log("🟢 Connected to Redis successfully");
        });

        redisClient.on("error", (err) => {
            const now = Date.now();
            if (now - lastRedisErrorLog > 30000) {
                lastRedisErrorLog = now;
                if (err.message.includes("ECONNREFUSED")) {
                    console.warn(`⚠️ Redis is offline at ${REDIS_URL}. Waiting for Redis to start (run 'docker compose up -d redis')...`);
                } else {
                    console.error("🔴 Redis connection error:", err.message);
                }
            }
        });
    }
    return redisClient;
};

export default getRedisClient;
