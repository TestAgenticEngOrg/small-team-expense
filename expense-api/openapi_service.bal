// Generated from specs/design/components/expense-api/openapi.yaml by
// `bal openapi --mode service`, then filled in by hand: the InterceptableService
// wiring (gateway_assertion.bal), resource bodies backed by expense_store.bal /
// directory.bal, and an `ExpenseCreated` (201) type the generator did not emit
// for `POST /me/expenses`.

import ballerina/http;

listener http:Listener ep0 = new (9090);

final Category[] CATEGORIES = ["Travel", "Meals", "Lodging", "Office Supplies", "Software", "Other"];

service http:InterceptableService / on ep0 {

    public function createInterceptors() returns AssertionInterceptor => new;

    # The fixed list of expense categories
    #
    # + return - Categories
    resource function get categories() returns Category[] {
        return CATEGORIES;
    }

    # The caller's own expenses
    #
    # + return - returns can be any of following types
    # http:Ok (The caller's expenses)
    # http:Unauthorized (Not signed in)
    resource function get me/expenses(http:RequestContext ctx, ExpenseStatus? status, int 'limit = 20, int offset = 0)
            returns ExpenseList|http:Unauthorized|http:InternalServerError|error {
        GatewayCaller|http:Unauthorized callerResult = requireGatewayCaller(ctx);
        if callerResult is http:Unauthorized {
            return callerResult;
        }
        string|http:Unauthorized|http:InternalServerError|error idResult = resolveCallerId(callerResult);
        if idResult !is string {
            return idResult;
        }
        string employeeId = idResult;
        int pageLimit = clampLimit('limit);
        int pageOffset = clampOffset(offset);
        int total = check countMyExpenses(employeeId, status);
        Expense[] items = check listMyExpenses(employeeId, status, pageLimit, pageOffset);
        [string?, string?] links = pageLinks("/me/expenses", total, pageLimit, pageOffset, status);
        ExpenseList list = {count: total, data: items, next: links[0], previous: links[1]};
        return list;
    }

    # The caller's own expense
    #
    # + return - returns can be any of following types
    # http:Ok (The expense)
    # http:NotFound (No such expense of the caller's)
    # http:Unauthorized (Not signed in)
    resource function get me/expenses/[string expenseId](http:RequestContext ctx)
            returns Expense|http:NotFound|http:Unauthorized|http:InternalServerError|error {
        GatewayCaller|http:Unauthorized callerResult = requireGatewayCaller(ctx);
        if callerResult is http:Unauthorized {
            return callerResult;
        }
        string|http:Unauthorized|http:InternalServerError|error idResult = resolveCallerId(callerResult);
        if idResult !is string {
            return idResult;
        }
        Expense? found = check getMyExpense(idResult, expenseId);
        if found is () {
            return <http:NotFound>{body: {code: 404, message: "no such expense of the caller's"}};
        }
        return found;
    }

    # The expenses of the caller's reports
    #
    # + return - returns can be any of following types
    # http:Ok (Expenses submitted by the caller's reports)
    # http:Unauthorized (Not signed in)
    resource function get me/team/expenses(http:RequestContext ctx, ExpenseStatus? status, int 'limit = 20, int offset = 0)
            returns ExpenseList|http:Unauthorized|http:InternalServerError|error {
        GatewayCaller|http:Unauthorized callerResult = requireGatewayCaller(ctx);
        if callerResult is http:Unauthorized {
            return callerResult;
        }
        string|http:Unauthorized|http:InternalServerError|error idResult = resolveCallerId(callerResult);
        if idResult !is string {
            return idResult;
        }
        string managerId = idResult;
        int pageLimit = clampLimit('limit);
        int pageOffset = clampOffset(offset);
        int total = check countTeamExpenses(managerId, status);
        Expense[] items = check listTeamExpenses(managerId, status, pageLimit, pageOffset);
        [string?, string?] links = pageLinks("/me/team/expenses", total, pageLimit, pageOffset, status);
        ExpenseList list = {count: total, data: items, next: links[0], previous: links[1]};
        return list;
    }

    # Submit a new expense
    #
    # + return - returns can be any of following types
    # http:Created (Expense created, pending decision)
    # http:BadRequest (A required field is missing or invalid)
    # http:Unauthorized (Not signed in)
    resource function post me/expenses(http:RequestContext ctx, ExpenseCreate payload)
            returns ExpenseCreated|http:BadRequest|http:Unauthorized|http:InternalServerError|error {
        GatewayCaller|http:Unauthorized callerResult = requireGatewayCaller(ctx);
        if callerResult is http:Unauthorized {
            return callerResult;
        }
        string|http:Unauthorized|http:InternalServerError|error idResult = resolveCallerId(callerResult);
        if idResult !is string {
            return idResult;
        }
        http:BadRequest? validationError = validateExpenseCreate(payload);
        if validationError is http:BadRequest {
            return validationError;
        }
        string? photoUrl = payload?.photoUrl;
        Expense created = check insertExpense(idResult, payload.vendor, payload.expenseDate, payload.amount,
                payload.category, photoUrl);
        return <ExpenseCreated>{body: created};
    }

    # Approve a report's submitted expense
    #
    # + return - returns can be any of following types
    # http:Ok (Expense approved)
    # http:NotFound (No such pending expense of a report's)
    # http:BadRequest (The expense is not pending)
    # http:Unauthorized (Not signed in)
    resource function post me/team/expenses/[string expenseId]/approve(http:RequestContext ctx, ExpenseDecision? payload)
            returns ExpenseOk|http:NotFound|http:BadRequest|http:Unauthorized|http:InternalServerError|error {
        return decideTeamExpense(ctx, expenseId, "approved", payload);
    }

    # Reject a report's submitted expense
    #
    # + return - returns can be any of following types
    # http:Ok (Expense rejected)
    # http:NotFound (No such pending expense of a report's)
    # http:BadRequest (The expense is not pending)
    # http:Unauthorized (Not signed in)
    resource function post me/team/expenses/[string expenseId]/reject(http:RequestContext ctx, ExpenseDecision? payload)
            returns ExpenseOk|http:NotFound|http:BadRequest|http:Unauthorized|http:InternalServerError|error {
        return decideTeamExpense(ctx, expenseId, "rejected", payload);
    }
}

// Shared by approve/reject: both resolve the caller, load a report's PENDING
// expense (404 when it does not exist or is not one of this manager's
// reports', 400 when it exists but is already decided), and apply the decision.
function decideTeamExpense(http:RequestContext ctx, string expenseId, ExpenseStatus newStatus, ExpenseDecision? payload)
        returns ExpenseOk|http:NotFound|http:BadRequest|http:Unauthorized|http:InternalServerError|error {
    GatewayCaller|http:Unauthorized callerResult = requireGatewayCaller(ctx);
    if callerResult is http:Unauthorized {
        return callerResult;
    }
    string|http:Unauthorized|http:InternalServerError|error idResult = resolveCallerId(callerResult);
    if idResult !is string {
        return idResult;
    }
    string managerId = idResult;
    ExpenseRow? existing = check getReportExpense(managerId, expenseId);
    if existing is () {
        return <http:NotFound>{body: {code: 404, message: "no such pending expense of a report's"}};
    }
    if existing.status != "pending" {
        return <http:BadRequest>{body: {code: 400, message: "the expense is not pending"}};
    }
    string? comment = payload?.comment;
    Expense updated = check decideExpense(expenseId, managerId, newStatus, comment);
    return <ExpenseOk>{body: updated};
}

function validateExpenseCreate(ExpenseCreate payload) returns http:BadRequest? {
    if payload.vendor.trim() == "" {
        return <http:BadRequest>{body: {code: 400, message: "vendor is required"}};
    }
    if !re `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`.isFullMatch(payload.expenseDate) {
        return <http:BadRequest>{body: {code: 400, message: "expenseDate must be an ISO date (YYYY-MM-DD)"}};
    }
    if payload.amount <= 0d {
        return <http:BadRequest>{body: {code: 400, message: "amount must be greater than zero"}};
    }
    return ();
}

function clampLimit(int requested) returns int {
    if requested > 100 {
        return 100;
    }
    if requested < 0 {
        return 0;
    }
    return requested;
}

function clampOffset(int requested) returns int {
    if requested < 0 {
        return 0;
    }
    return requested;
}

function pageLinks(string basePath, int total, int pageLimit, int pageOffset, ExpenseStatus? status)
        returns [string?, string?] {
    string suffix = status is string ? "&status=" + status : "";
    string? next = ();
    if pageOffset + pageLimit < total {
        next = basePath + "?limit=" + pageLimit.toString() + "&offset=" + (pageOffset + pageLimit).toString() + suffix;
    }
    string? previous = ();
    if pageOffset > 0 {
        int prevOffset = pageOffset - pageLimit;
        if prevOffset < 0 {
            prevOffset = 0;
        }
        previous = basePath + "?limit=" + pageLimit.toString() + "&offset=" + prevOffset.toString() + suffix;
    }
    return [next, previous];
}

public type ExpenseList record {
    # total matching items
    int count;
    # relative URI of the next page
    string? next?;
    # relative URI of the previous page
    string? previous?;
    Expense[] data;
};

public type ExpenseCreated record {|
    *http:Created;
    Expense body;
|};

public type ExpenseOk record {|
    *http:Ok;
    Expense body;
|};

public type Category "Travel"|"Meals"|"Lodging"|"Office Supplies"|"Software"|"Other";

public type Expense record {
    string id;
    string employeeId;
    string vendor;
    string expenseDate;
    decimal amount;
    Category category;
    string photoUrl?;
    ExpenseStatus status;
    string? managerComment?;
    string? decidedBy?;
    string? decidedAt?;
    string createdAt;
};

public type ExpenseCreate record {
    string vendor;
    string expenseDate;
    decimal amount;
    Category category;
    string photoUrl?;
};

public type Error record {
    # HTTP or application error code
    int code;
    # short human-readable label
    string message;
    # detailed explanation
    string description?;
    # URI to documentation
    string moreInfo?;
};

public type ExpenseDecision record {
    string? comment?;
};

public type ExpenseStatus "pending"|"approved"|"rejected";
