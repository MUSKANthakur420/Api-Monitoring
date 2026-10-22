<<<<<<< HEAD
import pool from "../config/db.js";

const createMonitor = async (userId, name, url, intervalSeconds = 60) => {
    const result = await pool.query(
        `INSERT INTO monitors (user_id, name, url, interval_seconds, last_status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id, user_id, name, url, interval_seconds, is_active, last_status, created_at, updated_at`,
        [userId, name, url, intervalSeconds]
    );
    return result.rows[0];
};

const getMonitorsByUserId = async (userId) => {
    const result = await pool.query(
        `SELECT 
            m.id, 
            m.user_id, 
            m.name, 
            m.url, 
            m.interval_seconds,
            m.is_active, 
            m.last_status,
            m.last_status_code,
            m.last_response_time,
            m.last_checked_at,
            m.consecutive_failures,
            m.created_at,
            COALESCE(
                ROUND(
                    (COUNT(CASE WHEN mc.is_up = TRUE THEN 1 END)::numeric / NULLIF(COUNT(mc.id), 0)) * 100, 
                    2
                ), 
                100.00
            ) AS uptime_percentage,
            COUNT(mc.id) AS total_checks_24h
         FROM monitors m
         LEFT JOIN monitor_checks mc ON mc.monitor_id = m.id AND mc.checked_at >= NOW() - INTERVAL '24 hours'
         WHERE m.user_id = $1
         GROUP BY m.id
         ORDER BY m.created_at DESC`,
=======
import pool from '../config/db.js';
const createMonitor=async(userId,name,url)=>{
    const result=await pool.query(
        `INSERT INTO monitors (user_id, name, url)
        VALUES
        ($1, $2, $3)
        RETURNING id, user_id, name, url,is_active, created_at, updated_at`,
        [userId,name,url]
    );
    return result.rows[0];
};
const getMonitorsByUserId = async (userId) => {
    const result = await pool.query(
        `SELECT id, name, url, is_active, created_at
         FROM monitors
         WHERE user_id = $1
         ORDER BY created_at DESC`,
>>>>>>> 5f82509b85e6ab2ec0944536589a9d435b5aab48
        [userId]
    );

    return result.rows;
};
<<<<<<< HEAD

const findMonitorById = async (id, userId) => {
    let query = `SELECT * FROM monitors WHERE id = $1`;
    const params = [id];
    if (userId) {
        query += ` AND user_id = $2`;
        params.push(userId);
    }
    const result = await pool.query(query, params);
    return result.rows[0];
};

const updateMonitorById = async (id, userId, name, url, intervalSeconds) => {
    const result = await pool.query(
        `UPDATE monitors 
         SET name = COALESCE($1, name),
             url = COALESCE($2, url),
             interval_seconds = COALESCE($3, interval_seconds),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND user_id = $5 
         RETURNING id, name, url, interval_seconds, is_active, last_status, created_at, updated_at`,
        [name, url, intervalSeconds, id, userId]
    );
    return result.rows[0];
};

const toggleMonitorActive = async (id, userId) => {
    const result = await pool.query(
        `UPDATE monitors 
         SET is_active = NOT is_active,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2
         RETURNING id, name, url, is_active, last_status, updated_at`,
        [id, userId]
    );
    return result.rows[0];
};

const deleteMonitorById = async (id, userId) => {
    const result = await pool.query(
        `DELETE FROM monitors 
         WHERE id = $1 AND user_id = $2 
         RETURNING id, name, url`,
        [id, userId]
    );
    return result.rows[0];
};

const getAllActiveMonitors = async (onlyDue = false) => {
    let query = `
        SELECT m.id, m.user_id, m.name, m.url, m.interval_seconds, m.last_status, m.last_checked_at, m.consecutive_failures, u.email as user_email, u.name as user_name
        FROM monitors m
        JOIN users u ON u.id = m.user_id
        WHERE m.is_active = TRUE
    `;
    if (onlyDue) {
        query += ` AND (m.last_checked_at IS NULL OR m.last_checked_at <= NOW() - (COALESCE(m.interval_seconds, 60) || ' seconds')::interval)`;
    }
    const result = await pool.query(query);
    return result.rows;
};

const updateMonitorStatus = async (id, { lastStatus, lastStatusCode, lastResponseTime, isUp }) => {
    const consecutiveFailuresClause = isUp ? "0" : "consecutive_failures + 1";
    const result = await pool.query(
        `UPDATE monitors
         SET last_status = $1,
             last_status_code = $2,
             last_response_time = $3,
             last_checked_at = CURRENT_TIMESTAMP,
             consecutive_failures = ${consecutiveFailuresClause},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [lastStatus, lastStatusCode, lastResponseTime, id]
    );
    return result.rows[0];
};

const getGlobalDashboardSummary = async (userId) => {
    const result = await pool.query(
        `SELECT 
            COUNT(m.id) as total_monitors,
            COUNT(CASE WHEN m.is_active = TRUE AND m.last_status = 'up' THEN 1 END) as up_monitors,
            COUNT(CASE WHEN m.is_active = TRUE AND m.last_status = 'down' THEN 1 END) as down_monitors,
            COUNT(CASE WHEN m.is_active = FALSE THEN 1 END) as paused_monitors,
            ROUND(AVG(CASE WHEN m.last_response_time IS NOT NULL THEN m.last_response_time END), 0) as avg_latency,
            COALESCE(
                ROUND(
                    (COUNT(CASE WHEN mc.is_up = TRUE THEN 1 END)::numeric / NULLIF(COUNT(mc.id), 0)) * 100, 
                    2
                ), 
                100.00
            ) as overall_uptime
         FROM monitors m
         LEFT JOIN monitor_checks mc ON mc.monitor_id = m.id AND mc.checked_at >= NOW() - INTERVAL '24 hours'
         WHERE m.user_id = $1`,
        [userId]
    );
    return result.rows[0];
};

const Monitor = {
    createMonitor,
    getMonitorsByUserId,
    findMonitorById,
    updateMonitorById,
    toggleMonitorActive,
    deleteMonitorById,
    getAllActiveMonitors,
    updateMonitorStatus,
    getGlobalDashboardSummary,
};

=======
const findMonitorById=async(id,userId)=>{
    const result=await pool.query(
        `SELECT * FROM monitors WHERE id=$1 AND user_id = $2`,[id,userId]
    );
    return result.rows[0];
}
const updateMonitorById=async(id,userId,name,url)=>{
    const result=await pool.query(
        `UPDATE monitors SET name=$1,url=$2 WHERE id=$3 AND user_id = $4 RETURNING id, name, url, is_active, created_at, updated_at`,
        [name,url,id,userId]
    );
    return result.rows[0];
}
const deleteMonitorById=async(id,userId)=>{
    const result=await pool.query(
        `DELETE FROM monitors WHERE id=$1 AND user_id = $2 RETURNING id, name, url, is_active, created_at, updated_at`,
        [id,userId]
    );
    return result.rows[0];
}
const Monitor= {createMonitor,getMonitorsByUserId,findMonitorById,updateMonitorById,deleteMonitorById};
>>>>>>> 5f82509b85e6ab2ec0944536589a9d435b5aab48
export default Monitor;