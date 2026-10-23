import nodemailer from "nodemailer";
import { Resend } from "resend";
import dotenv from "dotenv";
import MonitorCheck from "../model/monitorCheck.model.js";

dotenv.config();

let transporter = null;
let transporterType = null; // 'resend' | 'smtp' | 'simulated'
let resendClient = null;

const isConfigured = (val) => {
    if (!val || typeof val !== "string") return false;
    const trimmed = val.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    return !(
        lower === "your_email@gmail.com" ||
        lower === "your_app_password" ||
        lower === "your url" ||
        lower.startsWith("your_") ||
        lower.includes("example.com")
    );
};

const getSmtpConfig = () => {
    let host = (process.env.SMTP_HOST || "").trim();
    let port = Number(process.env.SMTP_PORT) || 0;
    let user = (process.env.SMTP_USER || "").trim();
    let pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "").trim();

    const isGmail =
        (user && (user.toLowerCase().endsWith("@gmail.com") || user.toLowerCase().endsWith("@googlemail.com"))) ||
        (host && host.toLowerCase().includes("gmail")) ||
        process.env.SMTP_SERVICE?.toLowerCase() === "gmail";

    // For Gmail, port 465 (SMTPS direct SSL) avoids ISP port 587 submission blocks
    if (isGmail) {
        if (!host) host = "smtp.gmail.com";
        if (!port) port = 465;
    } else {
        if (!port) port = 587;
    }

    let secure = process.env.SMTP_SECURE === "true" || port === 465;

    const configured = isConfigured(host) && isConfigured(user) && isConfigured(pass);

    return {
        configured,
        host,
        port,
        user,
        pass,
        secure,
        isGmail,
    };
};

const sendMailWithTimeout = async (client, options, timeoutMs = 10000) => {
    return Promise.race([
        client.sendMail(options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Email transport timed out after ${timeoutMs}ms. Hosting network may be blocking SMTP port.`)), timeoutMs)
        ),
    ]);
};

const getResendClient = () => {
    const apiKey = (process.env.RESEND_API_KEY || "").trim();
    if (!apiKey || apiKey === "re_your_api_key_here" || !apiKey.startsWith("re_")) return null;
    if (!resendClient) resendClient = new Resend(apiKey);
    return resendClient;
};

const getTransporter = async ({ forceRefresh = false, preferEthereal = false } = {}) => {
    const smtpConfig = getSmtpConfig();

    if (transporter && !forceRefresh) {
        if (transporterType === "resend") return { transporter, type: transporterType, config: smtpConfig };
        if (preferEthereal && transporterType === "ethereal") return { transporter, type: transporterType, config: smtpConfig };
        if (!preferEthereal && smtpConfig.configured && transporterType === "smtp") return { transporter, type: transporterType, config: smtpConfig };
        if (!preferEthereal && !smtpConfig.configured && transporterType === "simulated") {
            return { transporter, type: transporterType, config: smtpConfig };
        }
    }

    // 1. Resend HTTP API — works on Render (no SMTP port needed)
    if (!preferEthereal) {
        const resend = getResendClient();
        if (resend) {
            // Wrap Resend in a sendMail-compatible interface
            transporter = {
                sendMail: async (options) => {
                    const fromAddress = process.env.RESEND_FROM || "API Sentinel <onboarding@resend.dev>";
                    const result = await resend.emails.send({
                        from: fromAddress,
                        to: Array.isArray(options.to) ? options.to : [options.to],
                        subject: options.subject,
                        html: options.html,
                        text: options.text,
                    });
                    if (result.error) throw new Error(result.error.message || "Resend API error");
                    return { messageId: result.data?.id || "resend-" + Date.now() };
                },
            };
            transporterType = "resend";
            console.log(`📧 Resend HTTP transporter initialized for ${smtpConfig.user || "configured account"}`);
            return { transporter, type: transporterType, config: smtpConfig };
        }
    }

    // 2. Real SMTP when credentials are valid and Ethereal is not explicitly requested
    if (!preferEthereal && smtpConfig.configured) {
        try {
            // For Gmail, service: "gmail" uses direct SSL port 465 natively without port 587 timeouts
            const transportOptions = smtpConfig.isGmail
                ? {
                      service: "gmail",
                      auth: {
                          user: smtpConfig.user,
                          pass: smtpConfig.pass,
                      },
                      connectionTimeout: 10000,
                      greetingTimeout: 8000,
                      socketTimeout: 15000,
                  }
                : {
                      host: smtpConfig.host,
                      port: smtpConfig.port,
                      secure: smtpConfig.secure,
                      auth: {
                          user: smtpConfig.user,
                          pass: smtpConfig.pass,
                      },
                      connectionTimeout: 10000,
                      greetingTimeout: 8000,
                      socketTimeout: 15000,
                      tls: {
                          rejectUnauthorized: false,
                      },
                  };

            transporter = nodemailer.createTransport(transportOptions);
            transporterType = "smtp";
            console.log(`📧 Real SMTP transporter initialized (${smtpConfig.isGmail ? "Gmail SSL" : `${smtpConfig.host}:${smtpConfig.port}`}) for ${smtpConfig.user}`);
            return { transporter, type: transporterType, config: smtpConfig };
        } catch (smtpErr) {
            console.warn("⚠️ Real SMTP setup failed, checking fallback:", smtpErr.message);
        }
    }

    // 3. Ethereal Test Transporter (ONLY if explicitly preferred or USE_ETHEREAL=true)
    const allowEthereal = preferEthereal || process.env.USE_ETHEREAL === "true";
    if (allowEthereal) {
        try {
            const testAccount = await Promise.race([
                nodemailer.createTestAccount(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Ethereal test account setup timed out (4s)")), 4000)
                ),
            ]);
            transporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
                connectionTimeout: 8000,
                greetingTimeout: 6000,
                socketTimeout: 10000,
            });
            transporterType = "ethereal";
            console.log(`🧪 Ethereal test SMTP transporter initialized (${testAccount.user})`);
            return { transporter, type: transporterType, config: smtpConfig, etherealUser: testAccount.user };
        } catch (etherealErr) {
            console.warn("⚠️ Could not initialize Ethereal test account:", etherealErr.message);
        }
    }

    // 4. Fallback: Instant Simulated transporter (zero lag, prints to console)
    transporter = {
        sendMail: async (options) => {
            console.log("\n================ [EMAIL ALERT DISPATCHED (SIMULATED)] ================");
            console.log(`To:      ${options.to}`);
            console.log(`Subject: ${options.subject}`);
            console.log(`From:    ${options.from || "alerts@apimonitor.dev"}`);
            console.log(`Content:\n${options.text}`);
            console.log("====================================================================\n");
            return { messageId: "simulated-" + Date.now() };
        },
    };
    transporterType = "simulated";
    console.log("ℹ️ Using instant simulated email logger (printed to console)");

    return { transporter, type: transporterType, config: smtpConfig };
};

const verifyTransporter = async () => {
    const smtpConfig = getSmtpConfig();
    const resend = getResendClient();

    if (resend) {
        return {
            configured: true,
            provider: "Resend HTTP API",
            user: smtpConfig.user || "via Resend",
            status: "ready",
            message: "Resend HTTP API configured — emails will work on Render (no SMTP ports needed).",
        };
    }

    if (!smtpConfig.configured) {
        return {
            configured: false,
            provider: "ethereal/simulated",
            message: "No RESEND_API_KEY or SMTP credentials configured. Add RESEND_API_KEY in Render env vars for real emails.",
        };
    }

    try {
        const { transporter: client } = await getTransporter({ forceRefresh: true });
        if (client && typeof client.verify === "function") {
            await client.verify();
            return {
                configured: true,
                provider: smtpConfig.host,
                user: smtpConfig.user,
                status: "connected",
                message: `SMTP connection verified successfully with ${smtpConfig.host}`,
            };
        }
        return {
            configured: true,
            provider: smtpConfig.host,
            user: smtpConfig.user,
            status: "ready",
            message: "Transporter ready.",
        };
    } catch (err) {
        return {
            configured: true,
            provider: smtpConfig.host,
            user: smtpConfig.user,
            status: "error",
            error: err.message,
            message: `SMTP connection failed: ${err.message}. Add RESEND_API_KEY in Render env vars to fix this.`,
        };
    }
};

const sendDowntimeAlert = async ({
    monitor,
    userEmail,
    userName = "Developer",
    statusCode,
    responseTime,
    errorMessage,
    preferEthereal = false,
}) => {
    // Record incident in database immediately if this is a registered monitor
    if (monitor?.id) {
        try {
            await MonitorCheck.recordIncidentAlert(
                monitor.id,
                "down",
                statusCode,
                responseTime,
                errorMessage || "API DOWN",
                userEmail
            );
        } catch (dbErr) {
            console.warn("⚠️ Could not record incident alert in DB:", dbErr.message);
        }
    }

    let text = "";
    let html = "";
    try {
        const { transporter: mailClient, type, config } = await getTransporter({ preferEthereal });
        const defaultFrom = config?.configured && config?.user
            ? `"API Sentinel" <${config.user}>`
            : '"API Sentinel" <alerts@apimonitor.dev>';
        const fromAddress = process.env.ALERT_EMAIL_FROM || defaultFrom;
        const dashboardUrl = process.env.DASHBOARD_URL || process.env.CORS_ORIGIN || "https://apimonitoring-jacqp9q52-420royalrajput50806-5145s-projects.vercel.app";
        const subject = `🚨 CRITICAL: API Down Alert - "${monitor.name}"`;

        text = `
[CRITICAL ALERT] API Down: "${monitor.name}"
============================================================

Hello ${userName},

Your monitored API endpoint has failed automated health checks and is currently DOWN.

INCIDENT DETAILS:
------------------------------------------------------------
• Service Name   : ${monitor.name}
• Target Endpoint: ${monitor.url}
• HTTP Status    : ${statusCode ? `${statusCode} (Failed)` : "No Response / Timed Out"}
• Latency        : ${responseTime || 0} ms
• Error Details  : ${errorMessage || "Status code >= 400 or connection timeout"}
• Timestamp      : ${new Date().toUTCString()}

RECOMMENDED ACTIONS:
------------------------------------------------------------
1. Inspect server logs for recent 5xx exceptions or crashed processes.
2. Verify database connection pools and background workers.
3. Check hosting infrastructure health and domain DNS records.

Dashboard: ${dashboardUrl}

--
API Monitoring Platform Sentinel
`;

        html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Outage Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Top Status Accent Line -->
          <tr>
            <td style="height: 5px; background: linear-gradient(90deg, #ef4444, #dc2626); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          
          <!-- Card Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #dc2626; display: block; margin-bottom: 6px;">
                      ⚠️ Critical Outage Alert
                    </span>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.25;">
                      ${monitor.name} is DOWN
                    </h1>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; padding: 6px 14px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #b91c1c;">
                      ● OFFLINE
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Message -->
          <tr>
            <td style="padding: 24px 32px 16px 32px; font-size: 15px; line-height: 1.6; color: #334155;">
              Hello <strong>${userName}</strong>,<br>
              Automated health check verification failed for endpoint <strong>${monitor.name}</strong>. The service is currently unresponsive or returned an error status code.
            </td>
          </tr>

          <!-- Metric Breakdown Table -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b; width: 35%;">
                    Target URL
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #0f172a; word-break: break-all;">
                    ${monitor.url}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">
                    HTTP Status
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #dc2626;">
                    ${statusCode ? `${statusCode} (Failed)` : "No Response / Timed Out"}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">
                    Latency
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                    ${responseTime || 0} ms
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">
                    Error Details
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #b91c1c; font-weight: 500;">
                    ${errorMessage || "Response status >= 400 or network timeout"}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b;">
                    Detected At
                  </td>
                  <td style="padding: 12px 16px; font-size: 13px; color: #475569;">
                    ${new Date().toUTCString()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Actionable Troubleshooting Advice Box -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px;">
                <tr>
                  <td>
                    <div style="font-size: 13px; font-weight: 700; color: #92400e; margin-bottom: 8px;">
                      🛠️ Recommended Troubleshooting Steps:
                    </div>
                    <ul style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #78350f; line-height: 1.6;">
                      <li>Check your cloud provider logs (Render, AWS, Vercel, Railway) for crashes.</li>
                      <li>Verify your database and cache (Redis, Postgres) connection pools.</li>
                      <li>Check domain DNS settings and SSL certificate validity.</li>
                      <li>Inspect recent code deployments for unhandled exceptions or syntax errors.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Buttons -->
          <tr>
            <td style="padding: 0 32px 32px 32px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #0f172a;">
                    <a href="${dashboardUrl}" target="_blank" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 24px; display: inline-block; border-radius: 8px; letter-spacing: 0.02em;">
                      Open Monitoring Dashboard →
                    </a>
                  </td>
                  <td width="12"></td>
                  <td align="center" style="border-radius: 8px; background-color: #f1f5f9; border: 1px solid #cbd5e1;">
                    <a href="${monitor.url}" target="_blank" style="font-size: 14px; font-weight: 600; color: #334155; text-decoration: none; padding: 11px 20px; display: inline-block; border-radius: 8px;">
                      Test API URL ↗
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
              Automated alert sent by your <strong>API Monitoring Platform</strong><br>
              You received this because your email is registered as the incident contact for this monitor.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

        const info = await sendMailWithTimeout(mailClient, {
            from: fromAddress,
            to: userEmail,
            subject,
            text,
            html,
        }, 5000);

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`🔗 Email Preview URL: ${previewUrl}`);
        }

        return {
            success: true,
            messageId: info.messageId,
            previewUrl: previewUrl || null,
            type,
        };
    } catch (err) {
        console.error("❌ Failed to send downtime alert email:", err.message);
        return {
            success: false,
            error: err.message,
        };
    }
};

const sendRecoveryAlert = async ({
    monitor,
    userEmail,
    userName = "Developer",
    statusCode = 200,
    responseTime = 0,
    preferEthereal = false,
}) => {
    // Record incident in database immediately if this is a registered monitor
    if (monitor?.id) {
        try {
            await MonitorCheck.recordIncidentAlert(
                monitor.id,
                "recovery",
                statusCode,
                responseTime,
                "API Service Restored",
                userEmail
            );
        } catch (dbErr) {
            console.warn("⚠️ Could not record incident alert in DB:", dbErr.message);
        }
    }

    let text = "";
    let html = "";
    try {
        const { transporter: mailClient, type, config } = await getTransporter({ preferEthereal });
        const defaultFrom = config?.configured && config?.user
            ? `"API Sentinel" <${config.user}>`
            : '"API Sentinel" <alerts@apimonitor.dev>';
        const fromAddress = process.env.ALERT_EMAIL_FROM || defaultFrom;
        const dashboardUrl = process.env.DASHBOARD_URL || process.env.CORS_ORIGIN || "https://apimonitoring-jacqp9q52-420royalrajput50806-5145s-projects.vercel.app";
        const subject = `✅ RESOLVED: API Back Online - "${monitor.name}"`;

        text = `
[INCIDENT RESOLVED] API Restored: "${monitor.name}"
============================================================

Hello ${userName},

Great news! Your monitored API endpoint has passed health checks and is once again OPERATIONAL.

RECOVERY DETAILS:
------------------------------------------------------------
• Service Name   : ${monitor.name}
• Target Endpoint: ${monitor.url}
• HTTP Status    : ${statusCode} OK
• Response Time  : ${responseTime} ms
• Restored At    : ${new Date().toUTCString()}

Automated checks are now passing normally.

Dashboard: ${dashboardUrl}

--
API Monitoring Platform Sentinel
`;

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Restored Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Top Status Accent Line -->
          <tr>
            <td style="height: 5px; background: linear-gradient(90deg, #10b981, #059669); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          
          <!-- Card Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #059669; display: block; margin-bottom: 6px;">
                      ✅ Incident Resolved
                    </span>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.25;">
                      ${monitor.name} is BACK ONLINE
                    </h1>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; padding: 6px 14px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #047857;">
                      ● OPERATIONAL
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Message -->
          <tr>
            <td style="padding: 24px 32px 16px 32px; font-size: 15px; line-height: 1.6; color: #334155;">
              Hello <strong>${userName}</strong>,<br>
              Great news! Your API endpoint <strong>${monitor.name}</strong> has successfully recovered and health checks are passing normally.
            </td>
          </tr>

          <!-- Metric Breakdown Table -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b; width: 35%;">
                    Target URL
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #0f172a; word-break: break-all;">
                    ${monitor.url}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">
                    HTTP Status
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #059669;">
                    ${statusCode || 200} OK
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">
                    Response Latency
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                    ${responseTime || 0} ms
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b;">
                    Restored At
                  </td>
                  <td style="padding: 12px 16px; font-size: 13px; color: #475569;">
                    ${new Date().toUTCString()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td style="padding: 0 32px 32px 32px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #0f172a;">
                    <a href="${dashboardUrl}" target="_blank" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 24px; display: inline-block; border-radius: 8px; letter-spacing: 0.02em;">
                      View Live Metrics in Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
              Automated alert sent by your <strong>API Monitoring Platform</strong><br>
              Incident automatically closed.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

        const info = await sendMailWithTimeout(mailClient, {
            from: fromAddress,
            to: userEmail,
            subject,
            text,
            html,
        }, 5000);

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`🔗 Email Preview URL: ${previewUrl}`);
        }

        return {
            success: true,
            messageId: info.messageId,
            previewUrl: previewUrl || null,
            type,
        };
    } catch (err) {
        console.error("❌ Failed to send recovery alert email:", err.message);
        return {
            success: false,
            error: err.message,
        };
    }
};

const sendTestAlert = async ({
    userEmail,
    userName = "Developer",
    monitorName = "Production Auth & User API",
    monitorUrl = "https://api.example.com/v1/health",
    type = "down",
    preferEthereal = false,
}) => {
    const isDown = type === "down";
    const monitor = {
        id: null,
        name: monitorName,
        url: monitorUrl,
    };

    if (isDown) {
        return await sendDowntimeAlert({
            monitor,
            userEmail,
            userName,
            statusCode: 503,
            responseTime: 1420,
            errorMessage: "HTTP 503 Service Unavailable: Gateway upstream connection timed out",
            preferEthereal,
        });
    } else {
        return await sendRecoveryAlert({
            monitor,
            userEmail,
            userName,
            statusCode: 200,
            responseTime: 118,
            preferEthereal,
        });
    }
};

const AlertService = {
    sendDowntimeAlert,
    sendRecoveryAlert,
    sendTestAlert,
    verifyTransporter,
    getTransporter,
    getSmtpConfig,
};

export default AlertService;
export { sendDowntimeAlert, sendRecoveryAlert, sendTestAlert, verifyTransporter, getTransporter, getSmtpConfig };
