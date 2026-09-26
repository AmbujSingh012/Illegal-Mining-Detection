-- ============================================================
-- AI-BASED ILLEGAL MINING & ENVIRONMENTAL DAMAGE DETECTION
-- Database Initialization
-- PostgreSQL + PostGIS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUM TYPES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'user_role'
    ) THEN
        CREATE TYPE user_role AS ENUM (
            'ADMIN',
            'OFFICER',
            'ANALYST'
        );
    END IF;
END
$$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'case_status'
    ) THEN
        CREATE TYPE case_status AS ENUM (
            'NEW',
            'UNDER_VERIFICATION',
            'CONFIRMED_VIOLATION',
            'NO_VIOLATION',
            'FALSE_ALARM',
            'ACTION_TAKEN'
        );
    END IF;
END
$$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'alert_status'
    ) THEN
        CREATE TYPE alert_status AS ENUM (
            'OPEN',
            'REVIEWING',
            'CONVERTED_TO_CASE',
            'DISMISSED',
            'RESOLVED'
        );
    END IF;
END
$$;


-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,

    email VARCHAR(255) UNIQUE NOT NULL,

    password_hash TEXT NOT NULL,

    role user_role NOT NULL DEFAULT 'ANALYST',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);


-- ============================================================
-- MINING LEASES
-- ============================================================

CREATE TABLE IF NOT EXISTS mining_leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lease_number VARCHAR(100) UNIQUE NOT NULL,

    owner_name VARCHAR(255) NOT NULL,

    mineral_type VARCHAR(150),

    district VARCHAR(150),

    tehsil VARCHAR(150),

    village VARCHAR(150),

    survey_khasra VARCHAR(255),

    approved_area_hectares NUMERIC(14,4),

    lease_start_date DATE,

    lease_expiry_date DATE,

    approved_depth_meters NUMERIC(12,2),

    boundary GEOMETRY(MultiPolygon, 4326) NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_mining_leases_boundary
ON mining_leases
USING GIST(boundary);

CREATE INDEX IF NOT EXISTS idx_mining_leases_district
ON mining_leases(district);

CREATE INDEX IF NOT EXISTS idx_mining_leases_status
ON mining_leases(status);


-- ============================================================
-- SATELLITE IMAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS satellite_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lease_id UUID REFERENCES mining_leases(id)
        ON DELETE SET NULL,

    source VARCHAR(100),

    acquisition_date DATE NOT NULL,

    file_path TEXT NOT NULL,

    cloud_percentage NUMERIC(6,2),

    crs VARCHAR(100),

    bbox GEOMETRY(Polygon, 4326),

    width INTEGER,

    height INTEGER,

    bands JSONB,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_satellite_images_lease
ON satellite_images(lease_id);

CREATE INDEX IF NOT EXISTS idx_satellite_images_date
ON satellite_images(acquisition_date);

CREATE INDEX IF NOT EXISTS idx_satellite_images_bbox
ON satellite_images
USING GIST(bbox);


-- ============================================================
-- DETECTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lease_id UUID REFERENCES mining_leases(id)
        ON DELETE SET NULL,

    satellite_image_id UUID REFERENCES satellite_images(id)
        ON DELETE SET NULL,

    detection_type VARCHAR(100) NOT NULL,

    geometry GEOMETRY(MultiPolygon, 4326),

    detected_area_hectares NUMERIC(14,4),

    confidence NUMERIC(5,4),

    model_name VARCHAR(150),

    model_version VARCHAR(100),

    analysis_method VARCHAR(100),

    evidence_path TEXT,

    explanation TEXT,

    is_demo BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT detection_confidence_range
        CHECK (
            confidence IS NULL
            OR (confidence >= 0 AND confidence <= 1)
        )
);


CREATE INDEX IF NOT EXISTS idx_detections_lease
ON detections(lease_id);

CREATE INDEX IF NOT EXISTS idx_detections_geometry
ON detections
USING GIST(geometry);

CREATE INDEX IF NOT EXISTS idx_detections_type
ON detections(detection_type);


-- ============================================================
-- CHANGE EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS change_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lease_id UUID REFERENCES mining_leases(id)
        ON DELETE SET NULL,

    before_image_id UUID REFERENCES satellite_images(id)
        ON DELETE SET NULL,

    after_image_id UUID REFERENCES satellite_images(id)
        ON DELETE SET NULL,

    before_date DATE,

    after_date DATE,

    changed_area_hectares NUMERIC(14,4),

    change_percentage NUMERIC(8,4),

    change_geometry GEOMETRY(MultiPolygon, 4326),

    confidence NUMERIC(5,4),

    change_type VARCHAR(100),

    model_name VARCHAR(150),

    model_version VARCHAR(100),

    analysis_method VARCHAR(100),

    evidence_path TEXT,

    explanation TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT change_confidence_range
        CHECK (
            confidence IS NULL
            OR (confidence >= 0 AND confidence <= 1)
        )
);


CREATE INDEX IF NOT EXISTS idx_change_events_lease
ON change_events(lease_id);

CREATE INDEX IF NOT EXISTS idx_change_events_geometry
ON change_events
USING GIST(change_geometry);

CREATE INDEX IF NOT EXISTS idx_change_events_after_date
ON change_events(after_date);


-- ============================================================
-- ALERTS
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lease_id UUID REFERENCES mining_leases(id)
        ON DELETE SET NULL,

    detection_id UUID REFERENCES detections(id)
        ON DELETE SET NULL,

    change_event_id UUID REFERENCES change_events(id)
        ON DELETE SET NULL,

    alert_type VARCHAR(100) NOT NULL,

    risk_level VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',

    status alert_status NOT NULL DEFAULT 'OPEN',

    title VARCHAR(255) NOT NULL,

    reason TEXT,

    affected_area_hectares NUMERIC(14,4),

    outside_lease_area_hectares NUMERIC(14,4),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_alerts_lease
ON alerts(lease_id);

CREATE INDEX IF NOT EXISTS idx_alerts_status
ON alerts(status);

CREATE INDEX IF NOT EXISTS idx_alerts_risk
ON alerts(risk_level);

CREATE INDEX IF NOT EXISTS idx_alerts_created
ON alerts(created_at);


-- ============================================================
-- CASES
-- ============================================================

CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    case_number VARCHAR(100) UNIQUE NOT NULL,

    alert_id UUID REFERENCES alerts(id)
        ON DELETE SET NULL,

    lease_id UUID REFERENCES mining_leases(id)
        ON DELETE SET NULL,

    assigned_officer_id UUID REFERENCES users(id)
        ON DELETE SET NULL,

    status case_status NOT NULL DEFAULT 'NEW',

    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',

    title VARCHAR(255) NOT NULL,

    description TEXT,

    latitude NUMERIC(10,7),

    longitude NUMERIC(10,7),

    location GEOMETRY(Point, 4326),

    detected_area_hectares NUMERIC(14,4),

    outside_lease_area_hectares NUMERIC(14,4),

    remarks TEXT,

    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    closed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_cases_alert
ON cases(alert_id);

CREATE INDEX IF NOT EXISTS idx_cases_lease
ON cases(lease_id);

CREATE INDEX IF NOT EXISTS idx_cases_assigned_officer
ON cases(assigned_officer_id);

CREATE INDEX IF NOT EXISTS idx_cases_status
ON cases(status);

CREATE INDEX IF NOT EXISTS idx_cases_location
ON cases
USING GIST(location);


-- ============================================================
-- FIELD INSPECTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS field_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    case_id UUID NOT NULL REFERENCES cases(id)
        ON DELETE CASCADE,

    officer_id UUID REFERENCES users(id)
        ON DELETE SET NULL,

    inspection_date TIMESTAMPTZ,

    latitude NUMERIC(10,7),

    longitude NUMERIC(10,7),

    location GEOMETRY(Point, 4326),

    findings TEXT,

    remarks TEXT,

    status VARCHAR(50) DEFAULT 'PENDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_field_inspections_case
ON field_inspections(case_id);

CREATE INDEX IF NOT EXISTS idx_field_inspections_officer
ON field_inspections(officer_id);

CREATE INDEX IF NOT EXISTS idx_field_inspections_location
ON field_inspections
USING GIST(location);


-- ============================================================
-- INSPECTION PHOTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS inspection_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    inspection_id UUID NOT NULL REFERENCES field_inspections(id)
        ON DELETE CASCADE,

    file_path TEXT NOT NULL,

    latitude NUMERIC(10,7),

    longitude NUMERIC(10,7),

    captured_at TIMESTAMPTZ,

    description TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection
ON inspection_photos(inspection_id);


-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES users(id)
        ON DELETE SET NULL,

    entity_type VARCHAR(100) NOT NULL,

    entity_id UUID,

    action VARCHAR(100) NOT NULL,

    previous_status VARCHAR(100),

    new_status VARCHAR(100),

    remarks TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_audit_logs_user
ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
ON audit_logs(created_at);


-- ============================================================
-- UPDATED_AT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_users_updated_at
ON users;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_mining_leases_updated_at
ON mining_leases;

CREATE TRIGGER update_mining_leases_updated_at
BEFORE UPDATE ON mining_leases
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_alerts_updated_at
ON alerts;

CREATE TRIGGER update_alerts_updated_at
BEFORE UPDATE ON alerts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_cases_updated_at
ON cases;

CREATE TRIGGER update_cases_updated_at
BEFORE UPDATE ON cases
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_field_inspections_updated_at
ON field_inspections;

CREATE TRIGGER update_field_inspections_updated_at
BEFORE UPDATE ON field_inspections
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- DATABASE READY
-- ============================================================

SELECT PostGIS_Version() AS postgis_version;
