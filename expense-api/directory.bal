import ballerina/http;
import ballerina/sql;
import ballerinax/postgresql;

// A USER row (domain-model.md): id, name, email and the manager self-relation.
// The fixed test directory (security.json testUsers) is seeded in db.bal with
// id == username, so resolving a caller's directory id is a lookup by the
// gateway assertion's username claim — never the assertion's opaque `sub`.
public type UserRow record {|
    string id;
    string name;
    string email;
    string? managerId;
|};

// The caller's own directory id ("test-employee", "test-manager", ...), used
// consistently as the owner key for /me/expenses and the manager key for
// /me/team/expenses. A username the directory does not recognize is an
// unresolved identity, not an empty result.
function resolveCallerId(GatewayCaller caller) returns string|http:Unauthorized|http:InternalServerError|error {
    string|http:InternalServerError usernameResult = requireCallerUsername(caller);
    if usernameResult is http:InternalServerError {
        return usernameResult;
    }
    string username = usernameResult;
    postgresql:Client dbClient = check getDb();
    sql:ParameterizedQuery query = `SELECT id FROM users WHERE id = ${username}`;
    string|sql:Error result = dbClient->queryRow(query);
    if result is sql:NoRowsError {
        return <http:InternalServerError>{
            body: {code: 500, message: "caller '" + username + "' is not a recognized directory user"}
        };
    }
    if result is sql:Error {
        return error("failed to resolve caller identity", result);
    }
    return result;
}
