import ballerina/sql;
import ballerina/time;
import ballerina/uuid;
import ballerinax/postgresql;

// The EXPENSE row shape (domain-model.md), read back from Postgres with
// camelCase column aliases so it binds directly onto this record.
type ExpenseRow record {|
    string id;
    string employeeId;
    string vendor;
    string expenseDate;
    decimal amount;
    string category;
    string? photoUrl;
    string status;
    string? managerComment;
    string? decidedBy;
    string? decidedAt;
    string createdAt;
|};

final sql:ParameterizedQuery expenseColumnList = `id, employee_id AS "employeeId", vendor,
    expense_date AS "expenseDate", amount, category, photo_url AS "photoUrl", status,
    manager_comment AS "managerComment", decided_by AS "decidedBy", decided_at AS "decidedAt",
    created_at AS "createdAt"`;

function toExpense(ExpenseRow row) returns Expense {
    Expense result = {
        id: row.id,
        employeeId: row.employeeId,
        vendor: row.vendor,
        expenseDate: row.expenseDate,
        amount: row.amount,
        category: <Category>row.category,
        status: <ExpenseStatus>row.status,
        managerComment: row.managerComment,
        decidedBy: row.decidedBy,
        decidedAt: row.decidedAt,
        createdAt: row.createdAt
    };
    string? photoUrl = row.photoUrl;
    if photoUrl is string {
        result.photoUrl = photoUrl;
    }
    return result;
}

function statusFilter(sql:ParameterizedQuery query, ExpenseStatus? status) returns sql:ParameterizedQuery {
    if status is string {
        return sql:queryConcat(query, ` AND status = ${status}`);
    }
    return query;
}

// GET /me/expenses — the caller's own rows.
function countMyExpenses(string employeeId, ExpenseStatus? status) returns int|error {
    sql:ParameterizedQuery query = statusFilter(`SELECT COUNT(*) FROM expenses WHERE employee_id = ${employeeId}`, status);
    postgresql:Client dbClient = check getDb();
    return dbClient->queryRow(query);
}

function listMyExpenses(string employeeId, ExpenseStatus? status, int pageLimit, int pageOffset) returns Expense[]|error {
    sql:ParameterizedQuery query = statusFilter(
        sql:queryConcat(`SELECT `, expenseColumnList, ` FROM expenses WHERE employee_id = ${employeeId}`), status);
    query = sql:queryConcat(query, ` ORDER BY created_at DESC LIMIT ${pageLimit} OFFSET ${pageOffset}`);
    postgresql:Client dbClient = check getDb();
    stream<ExpenseRow, sql:Error?> rows = dbClient->query(query);
    Expense[] items = [];
    error? iterationError = from ExpenseRow row in rows
        do {
            items.push(toExpense(row));
        };
    if iterationError is error {
        return iterationError;
    }
    return items;
}

function getMyExpense(string employeeId, string expenseId) returns Expense?|error {
    sql:ParameterizedQuery query = sql:queryConcat(`SELECT `, expenseColumnList,
        ` FROM expenses WHERE id = ${expenseId} AND employee_id = ${employeeId}`);
    postgresql:Client dbClient = check getDb();
    ExpenseRow|sql:Error result = dbClient->queryRow(query);
    if result is sql:NoRowsError {
        return ();
    }
    if result is sql:Error {
        return result;
    }
    return toExpense(result);
}

function insertExpense(string employeeId, string vendor, string expenseDate, decimal amount, string category,
        string? photoUrl) returns Expense|error {
    string id = uuid:createRandomUuid();
    string createdAt = time:utcToString(time:utcNow());
    postgresql:Client dbClient = check getDb();
    sql:ExecutionResult _ = check dbClient->execute(`
        INSERT INTO expenses (id, employee_id, vendor, expense_date, amount, category, photo_url, status, created_at)
        VALUES (${id}, ${employeeId}, ${vendor}, ${expenseDate}, ${amount}, ${category}, ${photoUrl}, 'pending', ${createdAt})
    `);
    ExpenseRow row = {
        id: id,
        employeeId: employeeId,
        vendor: vendor,
        expenseDate: expenseDate,
        amount: amount,
        category: category,
        photoUrl: photoUrl,
        status: "pending",
        managerComment: (),
        decidedBy: (),
        decidedAt: (),
        createdAt: createdAt
    };
    return toExpense(row);
}

// GET /me/team/expenses — rows of the caller's reports (USER.managerId == caller).
function countTeamExpenses(string managerId, ExpenseStatus? status) returns int|error {
    sql:ParameterizedQuery query = statusFilter(
        `SELECT COUNT(*) FROM expenses WHERE employee_id IN (SELECT id FROM users WHERE manager_id = ${managerId})`,
        status);
    postgresql:Client dbClient = check getDb();
    return dbClient->queryRow(query);
}

function listTeamExpenses(string managerId, ExpenseStatus? status, int pageLimit, int pageOffset) returns Expense[]|error {
    sql:ParameterizedQuery query = statusFilter(
        sql:queryConcat(`SELECT `, expenseColumnList,
            ` FROM expenses WHERE employee_id IN (SELECT id FROM users WHERE manager_id = ${managerId})`),
        status);
    query = sql:queryConcat(query, ` ORDER BY created_at DESC LIMIT ${pageLimit} OFFSET ${pageOffset}`);
    postgresql:Client dbClient = check getDb();
    stream<ExpenseRow, sql:Error?> rows = dbClient->query(query);
    Expense[] items = [];
    error? iterationError = from ExpenseRow row in rows
        do {
            items.push(toExpense(row));
        };
    if iterationError is error {
        return iterationError;
    }
    return items;
}

// A report's expense — () when it does not exist, or exists but is not one of
// this manager's reports' (both are "no such pending expense of a report's").
function getReportExpense(string managerId, string expenseId) returns ExpenseRow?|error {
    sql:ParameterizedQuery query = sql:queryConcat(`SELECT `, expenseColumnList,
        ` FROM expenses WHERE id = ${expenseId} AND employee_id IN (SELECT id FROM users WHERE manager_id = ${managerId})`);
    postgresql:Client dbClient = check getDb();
    ExpenseRow|sql:Error result = dbClient->queryRow(query);
    if result is sql:NoRowsError {
        return ();
    }
    if result is sql:Error {
        return result;
    }
    return result;
}

function decideExpense(string expenseId, string managerId, ExpenseStatus newStatus, string? comment) returns Expense|error {
    string decidedAt = time:utcToString(time:utcNow());
    sql:ParameterizedQuery query = sql:queryConcat(
        `UPDATE expenses SET status = ${newStatus}, decided_by = ${managerId}, decided_at = ${decidedAt},
            manager_comment = ${comment} WHERE id = ${expenseId} RETURNING `,
        expenseColumnList);
    postgresql:Client dbClient = check getDb();
    ExpenseRow row = check dbClient->queryRow(query);
    return toExpense(row);
}
