import ballerina/os;

// The `expense-db` platform-resource's env bindings (postgres-cnpg). Every one
// of these has a sensible local default applied in db.bal, so the service
// starts with no required environment variables.
configurable string dbHostEnv = os:getEnv("EXPENSE_DB_HOST");
configurable string dbPortEnv = os:getEnv("EXPENSE_DB_PORT");
configurable string dbNameEnv = os:getEnv("EXPENSE_DB_DBNAME");
configurable string dbUserEnv = os:getEnv("EXPENSE_DB_USER");
configurable string dbPasswordEnv = os:getEnv("EXPENSE_DB_PASSWORD");
