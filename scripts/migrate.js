// ============================================================
// scripts/migrate.js — Run the schema against Neon PostgreSQL
// Usage: node scripts/migrate.js
// Requires DATABASE_URL in environment
// ============================================================

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sql = neon(process.env.DATABASE_URL);

const SCHEMA = /* sql */ `
-- ──────────────────────────────────────────────────────────────
-- TestItNow Schema — apply to Neon PostgreSQL
-- ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
    user_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email             VARCHAR(255) UNIQUE NOT NULL,
    password_hash     VARCHAR(255),
    full_name         VARCHAR(255),
    phone             VARCHAR(50),
    avatar_url        TEXT,
    role              VARCHAR(50)  DEFAULT 'user',
    oauth_provider    VARCHAR(50),
    oauth_id          VARCHAR(255),
    plan_type         VARCHAR(50)  DEFAULT 'free',
    stripe_customer_id VARCHAR(255),
    tests_remaining   INTEGER      DEFAULT 5,
    company           VARCHAR(255),
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    last_login        TIMESTAMP,
    is_active         BOOLEAN      DEFAULT true,
    email_verified    BOOLEAN      DEFAULT false,
    CONSTRAINT unique_oauth UNIQUE (oauth_provider, oauth_id)
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    project_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_key  VARCHAR(50)  UNIQUE NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    description  TEXT,
    created_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test Cases
CREATE TABLE IF NOT EXISTS test_cases (
    test_case_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_key VARCHAR(100) UNIQUE NOT NULL,
    project_id    UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    test_case_type VARCHAR(50) NOT NULL,
    summary       VARCHAR(500) NOT NULL,
    description   TEXT,
    preconditions TEXT,
    test_steps    JSONB,
    test_data     JSONB,
    expected_result TEXT,
    priority      VARCHAR(50) DEFAULT 'Medium',
    status        VARCHAR(50) DEFAULT 'Draft',
    created_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test Executions
CREATE TABLE IF NOT EXISTS test_executions (
    execution_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id     UUID REFERENCES test_cases(test_case_id) ON DELETE CASCADE,
    executed_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    execution_status VARCHAR(50) NOT NULL,
    duration_ms      INTEGER,
    error_message    TEXT,
    screenshot_url   TEXT,
    environment      VARCHAR(100),
    browser          VARCHAR(100),
    os               VARCHAR(100),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bug Reports
CREATE TABLE IF NOT EXISTS bug_reports (
    bug_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bug_key      VARCHAR(100) UNIQUE NOT NULL,
    project_id   UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES test_cases(test_case_id) ON DELETE SET NULL,
    summary      VARCHAR(500) NOT NULL,
    description  TEXT,
    severity     VARCHAR(50) DEFAULT 'Major',
    priority     VARCHAR(50) DEFAULT 'High',
    status       VARCHAR(50) DEFAULT 'Open',
    reported_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    plan_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_name      VARCHAR(100) NOT NULL,
    plan_type      VARCHAR(50)  UNIQUE NOT NULL,
    price_monthly  DECIMAL(10,2),
    max_test_runs  INTEGER,
    max_test_cases INTEGER,
    features       JSONB,
    stripe_price_id VARCHAR(255),
    is_active      BOOLEAN DEFAULT true
);

-- Contact Requests
CREATE TABLE IF NOT EXISTS contact_requests (
    request_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name    VARCHAR(255) NOT NULL,
    email        VARCHAR(255) NOT NULL,
    company      VARCHAR(255),
    phone        VARCHAR(50),
    message      TEXT,
    plan_interest VARCHAR(50) DEFAULT 'premium',
    status       VARCHAR(50) DEFAULT 'new',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth        ON users(oauth_provider, oauth_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_project ON test_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_test_exec_case     ON test_executions(test_case_id);
CREATE INDEX IF NOT EXISTS idx_test_exec_user     ON test_executions(executed_by);
CREATE INDEX IF NOT EXISTS idx_bug_reports_project ON bug_reports(project_id);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$ language 'plpgsql';

DO $$ BEGIN
  CREATE TRIGGER update_users_updated_at    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON test_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_bug_reports_updated_at BEFORE UPDATE ON bug_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

const SEED = /* sql */ `
-- Seed subscription plans
INSERT INTO subscription_plans (plan_name, plan_type, price_monthly, max_test_runs, max_test_cases, features)
VALUES
  ('Free',           'free',           0,    5,    10,   '{"features":["5 test runs/month","10 test cases","1 project","Basic reporting"]}'),
  ('Pro',            'pro',            29,   100,  1000, '{"features":["100 test runs/month","1000 test cases","5 projects","Jira integration","Priority support"]}'),
  ('Small Business', 'small_business', 99,   500,  5000, '{"features":["500 test runs/month","5000 test cases","20 projects","20 team members","SSO support"]}'),
  ('Premium',        'premium',        NULL, -1,   -1,   '{"features":["Unlimited runs","Unlimited test cases","Dedicated support","Custom SLA","White labeling"]}')
ON CONFLICT (plan_type) DO NOTHING;
`;

async function migrate() {
  console.log('🔌 Connecting to Neon…');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Add it to .env or environment.');
    process.exit(1);
  }

  try {
    console.log('📦 Running schema migration…');
    // Split on statement boundaries and execute each
    const statements = SCHEMA
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 10);

    for (const stmt of statements) {
      try {
        await sql(stmt);
      } catch (err) {
        // Ignore "already exists" errors from IF NOT EXISTS
        if (!err.message.includes('already exists')) {
          console.warn('  ⚠️  ', err.message.split('\n')[0]);
        }
      }
    }

    console.log('🌱 Seeding subscription plans…');
    await sql(SEED);

    console.log('✅ Migration complete!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Verify tables in Neon Console → Tables tab');
    console.log('  2. Set DATABASE_URL in Vercel environment variables');
    console.log('  3. Deploy backend: cd backend && vercel --prod');
    console.log('  4. Set REACT_APP_API_URL in Netlify environment variables');
    console.log('  5. Deploy frontend: netlify deploy --prod');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
