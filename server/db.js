import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error", err);
});

async function ensureAuthTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
      image TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      token TEXT NOT NULL UNIQUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" TIMESTAMPTZ,
      "refreshTokenExpiresAt" TIMESTAMPTZ,
      scope TEXT,
      password TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function ensureSchema() {
  const client = await pool.connect();
  try {
    await ensureAuthTables(client);
    await client.query(`
      CREATE TABLE IF NOT EXISTS module_data (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        module TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}',
        version INTEGER NOT NULL DEFAULT 1,
        client_updated_at TIMESTAMPTZ DEFAULT NOW(),
        server_updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, module)
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_module_data_user ON module_data(user_id)`,
    );
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE module_data ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `);
  } finally {
    client.release();
  }
}

export default pool;
