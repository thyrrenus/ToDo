#!/bin/bash
# Database initialization script

set -e

echo "🚀 Initializing database..."

# Create extensions
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- Enable full-text search
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    
    -- Create enum types (if not using Prisma enums)
    DO $$ BEGIN
        CREATE TYPE task_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    
    DO $$ BEGIN
        CREATE TYPE task_priority AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    
    DO $$ BEGIN
        CREATE TYPE recurrence_frequency AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    
    DO $$ BEGIN
        CREATE TYPE reminder_method AS ENUM ('PUSH', 'EMAIL', 'BOTH');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    
    DO $$ BEGIN
        CREATE TYPE sync_status AS ENUM ('PENDING', 'SYNCED', 'CONFLICT', 'FAILED');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    
    DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('USER', 'PREMIUM', 'ADMIN');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
EOSQL

echo "✅ Database initialized successfully!"
