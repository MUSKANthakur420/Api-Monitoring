-- Schema for API Monitoring System

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    interval_seconds INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    last_status VARCHAR(50) DEFAULT 'pending', -- 'up', 'down', 'pending'
    last_status_code INTEGER,
    last_response_time INTEGER,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitor_checks (
    id SERIAL PRIMARY KEY,
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status_code INTEGER,
    response_time INTEGER,
    is_up BOOLEAN NOT NULL,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_alerts (
    id SERIAL PRIMARY KEY,
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'down', 'recovery'
    status_code INTEGER,
    response_time INTEGER,
    details TEXT,
    notified_to VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migrations: Ensure all columns exist for existing tables
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS interval_seconds INTEGER DEFAULT 60;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_status_code INTEGER;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_response_time INTEGER;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;

ALTER TABLE monitor_checks ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_is_active ON monitors(is_active);
CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_id ON monitor_checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_checked ON monitor_checks(monitor_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_alerts_monitor_id ON incident_alerts(monitor_id, created_at DESC);
