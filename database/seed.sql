-- ============================================================
-- SAMPLE / DEVELOPMENT DATA
-- ============================================================

-- ============================================================
-- DEMO USERS
-- ============================================================

-- Development password:
-- admin123
--
-- The password is generated using PostgreSQL's bcrypt-compatible
-- crypt() function instead of storing plaintext credentials.

INSERT INTO users (
    name,
    email,
    password_hash,
    role
)
VALUES (
    'System Administrator',
    'admin@illegalmining.local',
    crypt('admin123', gen_salt('bf')),
    'ADMIN'
)
ON CONFLICT (email) DO NOTHING;


INSERT INTO users (
    name,
    email,
    password_hash,
    role
)
VALUES (
    'Field Officer',
    'officer@illegalmining.local',
    crypt('officer123', gen_salt('bf')),
    'OFFICER'
)
ON CONFLICT (email) DO NOTHING;


INSERT INTO users (
    name,
    email,
    password_hash,
    role
)
VALUES (
    'GIS Analyst',
    'analyst@illegalmining.local',
    crypt('analyst123', gen_salt('bf')),
    'ANALYST'
)
ON CONFLICT (email) DO NOTHING;


-- ============================================================
-- SAMPLE MINING LEASE
-- ============================================================

INSERT INTO mining_leases (
    lease_number,
    owner_name,
    mineral_type,
    district,
    tehsil,
    village,
    survey_khasra,
    approved_area_hectares,
    lease_start_date,
    lease_expiry_date,
    approved_depth_meters,
    boundary,
    status,
    metadata
)
VALUES (
    'DEMO-LEASE-001',

    'Demo Mining Authority',

    'Mineral Ore',

    'Demo District',

    'Demo Tehsil',

    'Demo Village',

    'K-101,K-102',

    25.0000,

    '2025-01-01',

    '2030-12-31',

    20.00,

    ST_Multi(
        ST_GeomFromText(
            'POLYGON((
                78.0000 23.0000,
                78.0100 23.0000,
                78.0100 23.0100,
                78.0000 23.0100,
                78.0000 23.0000
            ))',
            4326
        )
    ),

    'ACTIVE',

    jsonb_build_object(
        'source', 'development_seed',
        'description', 'Sample lease for local development only'
    )
)
ON CONFLICT (lease_number) DO NOTHING;


-- ============================================================
-- SAMPLE SATELLITE IMAGE METADATA
-- ============================================================

INSERT INTO satellite_images (
    lease_id,
    source,
    acquisition_date,
    file_path,
    cloud_percentage,
    crs,
    bbox,
    width,
    height,
    bands,
    metadata
)
SELECT
    id,
    'LOCAL_SAMPLE',
    '2026-01-15',
    'data/satellite/sample_before.tif',
    4.50,
    'EPSG:4326',

    ST_GeomFromText(
        'POLYGON((
            77.995 22.995,
            78.015 22.995,
            78.015 23.015,
            77.995 23.015,
            77.995 22.995
        ))',
        4326
    ),

    1024,
    1024,

    '["RED","GREEN","BLUE","NIR"]'::jsonb,

    jsonb_build_object(
        'source', 'development_seed',
        'role', 'before_image'
    )

FROM mining_leases
WHERE lease_number = 'DEMO-LEASE-001'
AND NOT EXISTS (
    SELECT 1
    FROM satellite_images
    WHERE file_path = 'data/satellite/sample_before.tif'
);


INSERT INTO satellite_images (
    lease_id,
    source,
    acquisition_date,
    file_path,
    cloud_percentage,
    crs,
    bbox,
    width,
    height,
    bands,
    metadata
)
SELECT
    id,
    'LOCAL_SAMPLE',
    '2026-06-15',
    'data/satellite/sample_after.tif',
    3.20,
    'EPSG:4326',

    ST_GeomFromText(
        'POLYGON((
            77.995 22.995,
            78.015 22.995,
            78.015 23.015,
            77.995 23.015,
            77.995 22.995
        ))',
        4326
    ),

    1024,
    1024,

    '["RED","GREEN","BLUE","NIR"]'::jsonb,

    jsonb_build_object(
        'source', 'development_seed',
        'role', 'after_image'
    )

FROM mining_leases
WHERE lease_number = 'DEMO-LEASE-001'
AND NOT EXISTS (
    SELECT 1
    FROM satellite_images
    WHERE file_path = 'data/satellite/sample_after.tif'
);


-- ============================================================
-- DEMO FIXTURE DETECTION
--
-- IMPORTANT:
-- This is NOT an AI result.
-- It is explicitly marked as a development fixture.
-- The real AI engine must create real detections from imagery.
-- ============================================================

INSERT INTO detections (
    lease_id,
    detection_type,
    geometry,
    detected_area_hectares,
    confidence,
    model_name,
    model_version,
    analysis_method,
    explanation,
    is_demo
)
SELECT
    id,

    'Probable Excavation',

    ST_Multi(
        ST_GeomFromText(
            'POLYGON((
                78.0080 23.0040,
                78.0110 23.0040,
                78.0110 23.0070,
                78.0080 23.0070,
                78.0080 23.0040
            ))',
            4326
        )
    ),

    NULL,

    NULL,

    'development-fixture',

    'not-an-ai-result',

    'fixture',

    'DEMO FIXTURE ONLY - NOT GENERATED BY AI ANALYSIS',

    TRUE

FROM mining_leases
WHERE lease_number = 'DEMO-LEASE-001'
AND NOT EXISTS (
    SELECT 1
    FROM detections
    WHERE model_version = 'not-an-ai-result'
);


-- ============================================================
-- DATABASE SEED COMPLETE
-- ============================================================
