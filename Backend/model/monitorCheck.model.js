import pool from "../config/db.js";

const createMonitorCheck = async (
    monitorId,
    statusCode,
    responseTime,
    isUp,
    errorMessage = null
) => {
    const result = await pool.query(
        `INSERT INTO monitor_checks
         (monitor_id, status_code, response_time, is_up, error_message)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [monitorId, statusCode, responseTime, isUp, errorMessage]
    );

    return result.rows[0];
};

const getMonitorChecks = async (monitorId, limit = 50) => {
    const result = await pool.query(
        `SELECT id, monitor_id, status_code, response_time, is_up, error_message, checked_at
         FROM monitor_checks
         WHERE monitor_id = $1
         ORDER BY checked_at DESC
         LIMIT $2`,
        [monitorId, limit]
    );

    return result.rows;
};

const getMonitorMetrics = async (monitorId, hours = 24) => {
    const metricsResult = await pool.query(
        `SELECT 
            COUNT(*) as total_checks,
            COUNT(CASE WHEN is_up = TRUE THEN 1 END) as up_checks,
            COUNT(CASE WHEN is_up = FALSE THEN 1 END) as down_checks,
            COALESCE(
                ROUND(
                    (COUNT(CASE WHEN is_up = TRUE THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 
                    2
                ), 
                100.00
            ) as uptime_percentage,
            COALESCE(ROUND(AVG(response_time), 0), 0) as avg_response_time,
            COALESCE(MIN(response_time), 0) as min_response_time,
            COALESCE(MAX(response_time), 0) as max_response_time
         FROM monitor_checks
         WHERE monitor_id = $1 AND checked_at >= NOW() - ($2 || ' hours')::interval`,
        [monitorId, hours]
    );

    return metricsResult.rows[0];
};

const getLatencyTimeline = async (monitorId, limit = 50) => {
    // Fetch last N checks and order chronologically for charts
    const result = await pool.query(
        `SELECT 
            id,
            status_code,
            response_time,
            is_up,
            error_message,
            checked_at
         FROM (
             SELECT id, status_code, response_time, is_up, error_message, checked_at
             FROM monitor_checks
             WHERE monitor_id = $1
             ORDER BY checked_at DESC
             LIMIT $2
         ) sub
         ORDER BY checked_at ASC`,
        [monitorId, limit]
    );

    return result.rows;
};

const recordIncidentAlert = async (
    monitorId,
    type,
    statusCode,
    responseTime,
    details,
    notifiedTo
) => {
    const result = await pool.query(
        `INSERT INTO incident_alerts
         (monitor_id, type, status_code, response_time, details, notified_to)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [monitorId, type, statusCode, responseTime, details, notifiedTo]
    );
    return result.rows[0];
};

const getIncidentAlerts = async (monitorId, limit = 20) => {
    const result = await pool.query(
        `SELECT id, monitor_id, type, status_code, response_time, details, notified_to, created_at
         FROM incident_alerts
         WHERE monitor_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [monitorId, limit]
    );
    return result.rows;
};

const MonitorCheck = {
    createMonitorCheck,
    getMonitorChecks,
    getMonitorMetrics,
    getLatencyTimeline,
    recordIncidentAlert,
    getIncidentAlerts,
};

export default MonitorCheck;
