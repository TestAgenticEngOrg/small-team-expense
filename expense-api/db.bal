import ballerina/log;
import ballerina/sql;
import ballerinax/postgresql;
import ballerinax/postgresql.driver as _;

// The Postgres client is constructed lazily, on first use, behind `getDb()`
// rather than eagerly at module load. That keeps a `bal test` run of
// gateway_assertion_test.bal — which only exercises the interceptor boundary —
// from blocking on a database connection it does not need; `getDb` is the
// "small init function" `tests.md` says to wrap a connector's construction in
// so `@test:Mock` can replace it.
postgresql:Client? cachedDbClient = ();

function resolvedDbHost() returns string => dbHostEnv == "" ? "localhost" : dbHostEnv;

function resolvedDbPort() returns int {
    if dbPortEnv == "" {
        return 5432;
    }
    int|error parsed = int:fromString(dbPortEnv);
    if parsed is error {
        log:printWarn("EXPENSE_DB_PORT is not a valid integer, falling back to 5432", dbPortEnv = dbPortEnv);
        return 5432;
    }
    return parsed;
}

function resolvedDbName() returns string => dbNameEnv == "" ? "expense_api" : dbNameEnv;

function resolvedDbUser() returns string => dbUserEnv == "" ? "postgres" : dbUserEnv;

function resolvedDbPassword() returns string => dbPasswordEnv == "" ? "postgres" : dbPasswordEnv;

// The Postgres client, connecting and preparing the schema on first call and
// caching the result afterwards.
function getDb() returns postgresql:Client|error {
    postgresql:Client? existing = cachedDbClient;
    if existing is postgresql:Client {
        return existing;
    }
    postgresql:Client newClient = check new (
        host = resolvedDbHost(),
        username = resolvedDbUser(),
        password = resolvedDbPassword(),
        database = resolvedDbName(),
        port = resolvedDbPort()
    );
    error? prepared = prepareSchema(newClient);
    if prepared is error {
        return prepared;
    }
    cachedDbClient = newClient;
    return newClient;
}

function prepareSchema(postgresql:Client dbClient) returns error? {
    sql:ExecutionResult _ = check dbClient->execute(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            manager_id TEXT REFERENCES users(id)
        )
    `);
    sql:ExecutionResult _ = check dbClient->execute(`
        CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL REFERENCES users(id),
            vendor TEXT NOT NULL,
            expense_date TEXT NOT NULL,
            amount NUMERIC NOT NULL,
            category TEXT NOT NULL,
            photo_url TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            manager_comment TEXT,
            decided_by TEXT REFERENCES users(id),
            decided_at TEXT,
            created_at TEXT NOT NULL
        )
    `);
    check seedDirectory(dbClient);
}

// This single-tenant small-team app has no directory-provisioning endpoint
// (none is declared in openapi.yaml), so the fixed directory named in
// security.json's testUsers is seeded here: test-manager manages both
// test-employee and test-employee-2. A caller's username (resolved from the
// gateway assertion) is used directly as their USER.id.
function seedDirectory(postgresql:Client dbClient) returns error? {
    sql:ExecutionResult _ = check dbClient->execute(`
        INSERT INTO users (id, name, email, manager_id)
        VALUES ('test-manager', 'Test Manager', 'test-manager@example.com', NULL)
        ON CONFLICT (id) DO NOTHING
    `);
    sql:ExecutionResult _ = check dbClient->execute(`
        INSERT INTO users (id, name, email, manager_id)
        VALUES ('test-employee', 'Test Employee', 'test-employee@example.com', 'test-manager')
        ON CONFLICT (id) DO NOTHING
    `);
    sql:ExecutionResult _ = check dbClient->execute(`
        INSERT INTO users (id, name, email, manager_id)
        VALUES ('test-employee-2', 'Test Employee 2', 'test-employee-2@example.com', 'test-manager')
        ON CONFLICT (id) DO NOTHING
    `);
}
