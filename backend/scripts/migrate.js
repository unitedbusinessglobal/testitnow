// ============================================================
// scripts/migrate.js — Apply schema to Neon PostgreSQL
// Run: npm run db:migrate   (loads .env automatically)
// ============================================================

// Load .env for local runs; Vercel injects env vars automatically
import { config } from 'dotenv';
config();

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set. Copy .env.example → .env and fill it in.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function run(label, statement) {
  try {
    await sql(statement);
    console.log(`  ✓ ${label}`);
  } catch (err) {
    // Ignore "already exists" from IF NOT EXISTS guards
    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      console.log(`  ~ ${label} (already exists — skipped)`);
    } else {
      console.error(`  ✗ ${label}:`, err.message.split('\n')[0]);
    }
  }
}

async function migrate() {
  console.log('\n🔌  Connecting to Neon…\n');

  await run('uuid-ossp extension', `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await run('users table', `
    CREATE TABLE IF NOT EXISTS users (
      user_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email              VARCHAR(255) UNIQUE NOT NULL,
      password_hash      VARCHAR(255),
      full_name          VARCHAR(255),
      phone              VARCHAR(50),
      avatar_url         TEXT,
      role               VARCHAR(50)  DEFAULT 'user',
      oauth_provider     VARCHAR(50),
      oauth_id           VARCHAR(255),
      plan_type          VARCHAR(50)  DEFAULT 'free',
      stripe_customer_id VARCHAR(255),
      tests_remaining    INTEGER      DEFAULT 5,
      company            VARCHAR(255),
      created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      last_login         TIMESTAMP,
      is_active          BOOLEAN      DEFAULT true,
      email_verified     BOOLEAN      DEFAULT false,
      CONSTRAINT unique_oauth UNIQUE (oauth_provider, oauth_id)
    )
  `);

  await run('projects table', `
    CREATE TABLE IF NOT EXISTS projects (
      project_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_key  VARCHAR(50)  UNIQUE NOT NULL,
      project_name VARCHAR(255) NOT NULL,
      description  TEXT,
      created_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run('test_cases table', `
    CREATE TABLE IF NOT EXISTS test_cases (
      test_case_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      test_case_key   VARCHAR(100) UNIQUE NOT NULL,
      project_id      UUID REFERENCES projects(project_id) ON DELETE CASCADE,
      test_case_type  VARCHAR(50)  NOT NULL,
      summary         VARCHAR(500) NOT NULL,
      description     TEXT,
      preconditions   TEXT,
      test_steps      JSONB,
      test_data       JSONB,
      expected_result TEXT,
      priority        VARCHAR(50) DEFAULT 'Medium',
      status          VARCHAR(50) DEFAULT 'Draft',
      created_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run('test_executions table', `
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
    )
  `);

  await run('bug_reports table', `
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
    )
  `);

  await run('subscription_plans table', `
    CREATE TABLE IF NOT EXISTS subscription_plans (
      plan_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      plan_name       VARCHAR(100) NOT NULL,
      plan_type       VARCHAR(50)  UNIQUE NOT NULL,
      price_monthly   DECIMAL(10,2),
      max_test_runs   INTEGER,
      max_test_cases  INTEGER,
      features        JSONB,
      stripe_price_id VARCHAR(255),
      is_active       BOOLEAN DEFAULT true
    )
  `);

  await run('contact_requests table', `
    CREATE TABLE IF NOT EXISTS contact_requests (
      request_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      full_name     VARCHAR(255) NOT NULL,
      email         VARCHAR(255) NOT NULL,
      company       VARCHAR(255),
      phone         VARCHAR(50),
      message       TEXT,
      plan_interest VARCHAR(50) DEFAULT 'premium',
      status        VARCHAR(50) DEFAULT 'new',
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Indexes
  for (const [name, ddl] of [
    ['idx_users_email',         `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`],
    ['idx_users_oauth',         `CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id)`],
    ['idx_test_cases_project',  `CREATE INDEX IF NOT EXISTS idx_test_cases_project ON test_cases(project_id)`],
    ['idx_test_exec_case',      `CREATE INDEX IF NOT EXISTS idx_test_exec_case ON test_executions(test_case_id)`],
    ['idx_test_exec_user',      `CREATE INDEX IF NOT EXISTS idx_test_exec_user ON test_executions(executed_by)`],
    ['idx_bug_reports_project', `CREATE INDEX IF NOT EXISTS idx_bug_reports_project ON bug_reports(project_id)`],
  ]) {
    await run(name, ddl);
  }

  // Trigger function
  await run('update_updated_at_column function', `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$
    LANGUAGE plpgsql
  `);

  for (const [name, table] of [
    ['update_users_updated_at',      'users'],
    ['update_projects_updated_at',   'projects'],
    ['update_test_cases_updated_at', 'test_cases'],
    ['update_bug_reports_updated_at','bug_reports'],
  ]) {
    await run(`${name} trigger`, `
      DO $do$ BEGIN
        CREATE TRIGGER ${name} BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $do$
    `);
  }

  // Seed plans
  await run('seed subscription_plans', `
    INSERT INTO subscription_plans
      (plan_name, plan_type, price_monthly, max_test_runs, max_test_cases, features)
    VALUES
      ('Free',           'free',           0,    5,    10,   '{"features":["5 test runs/month","10 test cases","1 project","Basic reporting"]}'),
      ('Pro',            'pro',            29,   100,  1000, '{"features":["100 test runs/month","1000 test cases","5 projects","Jira integration","Priority support"]}'),
      ('Small Business', 'small_business', 99,   500,  5000, '{"features":["500 test runs/month","5000 test cases","20 projects","SSO support"]}'),
      ('Premium',        'premium',        NULL, -1,   -1,   '{"features":["Unlimited runs","Unlimited test cases","Dedicated support","Custom SLA"]}')
    ON CONFLICT (plan_type) DO NOTHING
  `);

  console.log('\n✅  Migration complete!\n');
  console.log('Next steps:');
  console.log('  1. Check tables in Neon Console → Tables tab');
  console.log('  2. Set DATABASE_URL + JWT_SECRET in Vercel env vars');
  console.log('  3. Deploy backend:  cd backend && vercel --prod');
  console.log('  4. Set REACT_APP_API_URL in Netlify env vars');
  console.log('  5. Deploy frontend: netlify deploy --prod\n');
}

migrate().catch(err => {
  console.error('\n❌  Migration failed:', err.message);
  process.exit(1);
});
