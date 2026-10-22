import dns from "node:dns/promises";
import net from "node:net";

const isPrivateIPv4 = (ip) => {
    const parts = ip.split(".").map(Number);

    return (
        parts[0] === 10 ||
        parts[0] === 127 ||
        parts[0] === 0 ||
        (parts[0] === 169 && parts[1] === 254) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    );
};

const isPrivateIP = (ip) => {
    if (net.isIPv4(ip)) return isPrivateIPv4(ip);

    if (net.isIPv6(ip)) {
        const normalized = ip.toLowerCase();

        return (
            normalized === "::" ||
            normalized === "::1" ||
            normalized.startsWith("fc") ||
            normalized.startsWith("fd") ||
            /^fe[89ab]/.test(normalized) ||
            normalized.startsWith("::ffff:")
        );
    }

    return true;
};

const validateMonitorUrl = async (value) => {
    let trimmed = (value || "").trim();
    if (!trimmed) throw new Error("Invalid URL");

    let url;
    try {
        url = new URL(trimmed);
    } catch {
        // If user entered 'api.example.com' without protocol, auto-prepend https://
        if (!trimmed.includes("://") && trimmed.includes(".")) {
            try {
                url = new URL(`https://${trimmed}`);
            } catch {
                throw new Error("Invalid URL");
            }
        } else {
            throw new Error("Invalid URL");
        }
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Only HTTP and HTTPS URLs are allowed");
    }

    if (url.username || url.password) {
        throw new Error("URLs containing credentials are not allowed");
    }

    const hostname = url.hostname.toLowerCase();

    if (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal")
    ) {
        throw new Error("Private or local URLs are not allowed");
    }

    if (net.isIP(hostname)) {
        if (isPrivateIP(hostname)) {
            throw new Error("Private IP addresses are not allowed");
        }
    } else {
        let addresses;

        try {
            addresses = await dns.lookup(hostname, { all: true });
        } catch {
            throw new Error("Unable to resolve URL hostname");
        }

        if (
            addresses.length === 0 ||
            addresses.some(({ address }) => isPrivateIP(address))
        ) {
            throw new Error("URL resolves to a private IP address");
        }
    }

    return url;
};

export default validateMonitorUrl;
export { validateMonitorUrl };