-- =====================================================
-- ASSEMBLY PRODUCTION MONITORING SYSTEM DATABASE SCHEMA
-- =====================================================

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('master_admin', 'admin', 'viewer', 'customer')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);

-- =====================================================
-- VEHICLES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('K9', 'K10', 'K11')),
    vehicle_number TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vehicle_type ON vehicles(vehicle_type);

-- =====================================================
-- STATIONS TABLE (Template Stations per Vehicle Type)
-- =====================================================

CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('K9', 'K10', 'K11')),
    station_code TEXT NOT NULL,
    UNIQUE(vehicle_type, station_code)
);

CREATE INDEX idx_station_vehicle_type ON stations(vehicle_type);

-- =====================================================
-- PRODUCTION STATUS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS production_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_number TEXT NOT NULL,
    station_code TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT fk_vehicle
        FOREIGN KEY(vehicle_number)
        REFERENCES vehicles(vehicle_number)
        ON DELETE CASCADE
);

CREATE INDEX idx_prod_vehicle ON production_status(vehicle_number);
CREATE INDEX idx_prod_status ON production_status(status);

-- =====================================================
-- REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('K9', 'K10', 'K11')),
    vehicle_number TEXT NOT NULL,
    station_code TEXT NOT NULL,

    part_number TEXT,
    qty INTEGER CHECK (qty >= 0),

    request_type TEXT NOT NULL CHECK (request_type IN ('station', 'part')),
    fastener BOOLEAN DEFAULT FALSE,

    request_date TIMESTAMP DEFAULT NOW(),
    delivery_date TIMESTAMP,

    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'delivered')),

    requested_by TEXT NOT NULL,

    CONSTRAINT fk_vehicle_request
        FOREIGN KEY(vehicle_number)
        REFERENCES vehicles(vehicle_number)
        ON DELETE CASCADE
);

CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_vehicle ON requests(vehicle_number);
CREATE INDEX idx_requests_date ON requests(request_date);

-- =====================================================
-- AUTO UPDATE DELIVERY DATE WHEN STATUS CHANGES
-- =====================================================

CREATE OR REPLACE FUNCTION set_delivery_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status = 'open' THEN
        NEW.delivery_date = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_delivery_date
BEFORE UPDATE ON requests
FOR EACH ROW
EXECUTE FUNCTION set_delivery_date();

-- =====================================================
-- DEFAULT STATION TEMPLATES
-- =====================================================

-- K9 Stations A01-A11
INSERT INTO stations (vehicle_type, station_code)
SELECT 'K9', 'A' || LPAD(generate_series::text, 2, '0')
FROM generate_series(1, 11)
ON CONFLICT DO NOTHING;

-- K10 Stations A01, A12-A16
INSERT INTO stations (vehicle_type, station_code)
VALUES ('K10', 'A01')
ON CONFLICT DO NOTHING;

INSERT INTO stations (vehicle_type, station_code)
SELECT 'K10', 'A' || LPAD(generate_series::text, 2, '0')
FROM generate_series(12, 16)
ON CONFLICT DO NOTHING;

-- K11 Stations A01, A12-A16
INSERT INTO stations (vehicle_type, station_code)
VALUES ('K11', 'A01')
ON CONFLICT DO NOTHING;

INSERT INTO stations (vehicle_type, station_code)
SELECT 'K11', 'A' || LPAD(generate_series::text, 2, '0')
FROM generate_series(12, 16)
ON CONFLICT DO NOTHING;

-- =====================================================
-- OPTIONAL: INSERT FIRST MASTER ADMIN
-- (Replace HASH with actual SHA256 password hash)
-- =====================================================

-- Example: Create a default admin user
-- Password: admin123 (SHA256 hash shown below)
-- IMPORTANT: Change this password after first login!

INSERT INTO users (username, password_hash, role)
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'master_admin')
ON CONFLICT DO NOTHING;

-- =====================================================
-- END OF SCHEMA
-- =====================================================