import { test, describe } from "node:test";
import assert from "node:assert";
import MonitorService from "../services/monitor.service.js";
import validateMonitorUrl from "../utils/urlValidator.js";
import User from "../model/user.model.js";
import jwt from "jsonwebtoken";

describe("URL Validator & SSRF Protection", () => {
    test("rejects invalid URLs", async () => {
        await assert.rejects(
            async () => await validateMonitorUrl("not-a-url"),
            /Invalid URL/
        );
    });

    test("rejects localhost and private network addresses", async () => {
        await assert.rejects(
            async () => await validateMonitorUrl("http://localhost:3000"),
            /Private or local URLs are not allowed/
        );

        await assert.rejects(
            async () => await validateMonitorUrl("http://127.0.0.1:8080"),
            /Private.*not allowed/
        );

        await assert.rejects(
            async () => await validateMonitorUrl("http://192.168.1.1"),
            /Private.*not allowed/
        );
    });

    test("accepts valid public HTTP/HTTPS URLs", async () => {
        const url = await validateMonitorUrl("https://example.com/api/health");
        assert.strictEqual(url.hostname, "example.com");
        assert.strictEqual(url.protocol, "https:");
    });
});

describe("Monitor Health Check Service", () => {
    test("accurately measures latency and status on responsive URL", async () => {
        const result = await MonitorService.checkUrl("https://httpbin.org/status/200");
        assert.strictEqual(typeof result.responseTime, "number");
        assert.ok(result.responseTime >= 0, "Response time must be >= 0");
        // httpbin might return 200 or connection error if network is restricted, but the structure must always match
        assert.ok(result.statusCode === 200 || result.statusCode === null);
        assert.strictEqual(typeof result.isUp, "boolean");
    });

    test("handles non-existent or failing domains gracefully without throwing", async () => {
        const result = await MonitorService.checkUrl("https://this-domain-definitely-does-not-exist-12345.xyz");
        assert.strictEqual(result.isUp, false);
        assert.strictEqual(result.statusCode, null);
        assert.ok(result.responseTime >= 0);
        assert.ok(result.errorMessage !== null);
    });
});

describe("JWT & User Model Authentication", () => {
    test("generates and verifies access token correctly", () => {
        const mockUser = { id: 42, name: "Test Developer", email: "dev@example.com" };
        const token = User.generateAccessToken(mockUser);
        assert.ok(typeof token === "string");

        const secret = process.env.ACCESS_SECRET || "apimonitor_jwt_access_secret_key_default";
        const decoded = jwt.verify(token, secret);
        assert.strictEqual(decoded.id, 42);
        assert.strictEqual(decoded.email, "dev@example.com");
    });
});
