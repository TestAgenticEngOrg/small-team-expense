// Tests for the gateway-signed assertion (gateway_assertion.bal), per the
// `ballerina` skill's testing guidance: a valid assertion is accepted, one
// signed with a different key is rejected, one tampered with after signing is
// rejected, and a `security: []` resource (`/categories`) serves 200 with no
// assertion at all.
//
// GATEWAY_ASSERTION_CERTIFICATE / _ISSUER / _HEADER must be exported (from a
// throwaway RSA keypair) before `bal test` runs — see the run script. With the
// full trio unset the interceptor takes its unverified fallback and every
// assertion here would pass for the wrong reason.
//
// These tests exercise only the interceptor boundary, so the Postgres client
// is mocked out via `getDb` (db.bal wraps its construction in that function
// precisely so `@test:Mock` can replace it, per tests.md) — a valid assertion
// is proven "accepted" by reaching the handler and failing on the mocked,
// unavailable database (500), never by a 401 from the interceptor.

import ballerina/crypto;
import ballerina/http;
import ballerina/jwt;
import ballerinax/postgresql;
import ballerina/test;

// keepAlive is off so each request opens its own connection: a prior
// response's body is not always drained in these tests (only the status
// matters), and a pooled connection left mid-body otherwise stalls the next
// request until the client's idle timeout.
final http:Client testClient = check new ("http://localhost:9090", httpVersion = http:HTTP_1_1, http1Settings = {keepAlive: http:KEEPALIVE_NEVER});

// A throwaway RSA keypair, generated once with openssl for this test run
// only; GATEWAY_ASSERTION_CERTIFICATE (exported before `bal test`) is this
// key's self-signed certificate. Never used outside this test file.
final string TEST_PRIVATE_KEY_PEM = string `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7CwQMA42oGwrp
6yoTTG8k+SWxFqoWaFu8zLNJcAlIFst2HgPs6gPiwSfXVTfirS+aIkh6QmCHq8fZ
X4YKPJbbMNc7im82rGvjERsBmegxUowW+XU+02qa9sPfVjBPnnUWfsw+yUQoCEUL
u+cNyGv4Q4jotRoK4Frc7F8ACd1ZEi1wahr11dyPcAFleyNU/5u6iW4jvNMsY6ES
bDhgq2tujD+3mSbkEIBdF8U/sdtDeCN+VGvNLpPdRpyXcwgCL5/prWVO3QJJ7ej+
OusOCV9MVYZuvmTibik6EyhmOsqc1q1RSLi6xQqPe0dAPJOe6D1/K4/qOSH+/6q7
5e+ZJSSzAgMBAAECggEAHKPUK87DexEg+65xk+DpR90Kg3I3+xRhr6gcb8tC8JHk
96Ii8bzneWogIp2+3+uq1UwYkvfk9gE8qbExwhGC++8fldNdsh52qp8s5nLdlefQ
4Zey9zrCIRZV6bW10gsuXJJvzdFdqU+S2vgbqgWdWrdkmFVatn2iDB/5b/USupeF
Tj+B6d3yRWKaYLW3TLiq9DYXLPwLD0Ud7finO+pjnRq9uhkHQkGg999VyS7nHZxi
Ntsk8wY/zj27z9ZmjUs5w6eQ/qk9W0WncC47HUn6xp01dHOmIM2WX2ea3pL/ckSH
1Eod9EG4wO+oGTYD56RSzrKDoPzVFjU62Ta9RROJuQKBgQD7CybxHfNytyC+1nF3
MmKnK+/daFXji05t7Ys+CngEZQRgMH8h6pyfntBqpdUAuRNc0NeNvk09i6mBq3+M
duNfPlg+O2O6iCyA1JF0fsxu/yN8wEmgQmBZTSYX2wZhkLpYDVtfvB9YM3sH4LKJ
yIAvyGfFKbEl7CKKoHpJ8HoK/wKBgQC+vGLegCga7o7jx0lYzlogIeXIEBeSM3Vy
VPOe9+W1eFcZ2W5Sv9OqNs8hcZ1gGgGYSwhj9aUi4G81xRfGP06fphGpBZcGfMY1
1ZZMC6A5hxRkgh2o4i9atDdezlow8UYkhNpwH5cAlX3chcbg5s3UcRzD2fQfZ63G
rkVKy14qTQKBgH3eUpEUHkrHDLECXfOQnKwKuII/XMjwwMsXDfh2UUSKzY3Y4vVD
Z3IUs5S1Pr3VDaM8xsa3wox4KO3t6c6okUngvWe+aTtOKVoSujc5mBCS9d0HoCKt
BRfhOZc+Zs2mPfgGAmlWrjSP40DI5Vt13ueWSIkvZTWJVqxA1++YlehLAoGASn8P
6rGJeINmgearaikmoFg9BDfszOiWXbJ6eMOAD7HR60G2SlGsHVZM7lYOzqM5rj7Y
Jxqhhg68wPabA45kagyV5ztMsnb3f71Nd6Quz2lH+L2tUfIN5tJusfPM3ELQT6Eo
JBTiiJLa1s/VTrA3AluvjXtKUx3OjMQyQjVOMR0CgYEAgsvGMmX3EkhNETblWeVb
oDHylvvA+ANHxEUYMaK0AntDdU+u6tpojbf8A71DC2/8ruNjJYTx4PdrIV4LatGj
IX+8hfo/EouydwMFs/hDHE8rktzH/7DxLi658yn2nKJV9Lfg2JRPsmE4YdETco4v
Rh1Z1EAKDZJrSsq82Tn0WJ4=
-----END PRIVATE KEY-----
`;

// A second, unrelated RSA keypair — its certificate is NOT what
// GATEWAY_ASSERTION_CERTIFICATE carries, so a token it signs must fail
// verification even though every claim in it is otherwise well-formed.
final string WRONG_PRIVATE_KEY_PEM = string `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDP+ClvUcg9j1dQ
vJWunvd6yEh9JJhib/WpWw02Ovn4MuZXB2W3oVhaZKSRBD1Zxvz1WRUvVt9kdODp
x5lzeMXM6QgItyMl77hclq1Ie+0RqVf6ef8S0hqiltfE8aM1uralcHHI52F+WgHU
FctlOgviLgaoF3Q/AfbyKFO6Vj6nXCEaF4G7rpLAzXP8oXwf2dEPxOGpO7PTiVoW
hJQSEJjnkqEwNYayZsQFtvw5CI/wKL06/0QG5DsWLlBzfk0iUF1Uv5Gh4f9nyfJ5
dggYot4ywIjvLvD5ujnCwH+Mqs8ZsFm5VLAyAIWXKPwM57n8D36kJd6i27Dmojyx
5qpcpd8dAgMBAAECggEAE5Ufea7utvU3WI/ZXE71qKcRRE9c1fAK5r5/GPsmrHtG
ey1kI41av3A4mrsWd8yn5wZTW1jHwjLLNtgnl9robSoIKqHr+ld/OaCqgmfA4+fZ
M+mm3gPQpDyl5pKGNrn1FtDmte8rm/UntOu0cjyr/8krsUo8FO6/bP/lGmeikKmN
oeX2spk6t+AU2KQjmRSKEx9WG3dknbUkDcu6iJfzMLbbH5JzDF7Dx+NPXxWOmuvJ
5OCvbKffdKmefmUeS5hdUOV+Ht4hX1LX5RLqlkAjuUzFZdkshGThvXisuWETTarO
oeSmSADqIt2Yf5amq0XdugGpEOoVzo/L/iMKGtY0IQKBgQD0Yza4yP0oFlWa/J1B
WBf+X8LZ881gMSzSsf95NVM23Zskl/Jropeh3iR9U7nfMq8TQhXV0OL1e5dunQBZ
AzDy+cDn+9cA0iqVmXsAeNzuVUi0gwMmZe9F2ID7JFC9CsLEKytaoSBgR7QS/IFc
tJK+T+OfDrBmvFcUWatvnH1rZQKBgQDZ2fL4zDLVsPKxxHIR/fizTEMxSMM95Gol
SOZ/HdmkjWMlNgDe9VmPevO5ae+UYvCmFiz++iwUQboN72YSSucf9pGuvHm/bSqT
Q6zjJwYICEJpE6lEL5dsdDU4kmzgSapTW9RIuFxNefKiaJbj8M3lDE8QYyDY4tUc
kNsu5CdVWQKBgQCpdubqSg0qMBqah5NwTWsN7E+MnUAL9O2VCPMTlMOoZxD+1hK3
Sp8FEqqQ8W8Rc+7tVsUXaGsJOPOwM1SbZNgblM6MzxivLA11gWFG2YiyCBeLfNHB
XawG7fO6str9y6l1KE4+4T43JWGcTNZTd6/OIk2/7QqrouxrYya7FXPu9QKBgQC2
jzZV2IkhGk/HOOB+w14OovIL8vXqf+eTpyvBirpAc1uKa17/eIu8+UQVNPlYWDFi
fWLnqa4Wq53G37+hxLM6zd33mGpOSKVNE4FmOeWMBZ/hfmByi49Ri3CuH8atjg32
HRYgep6fLnpuL0eDbOCd+VqoWOnF1xDQB3QmL3vmwQKBgFAJaqs5zUCC501bPwIl
34C/xDPA7EGwvdxY1kOwFNAS4cxsN2BEmxagi9sTxFJd5tdr1BsH3HIXgBWBptrC
Dtip06msExfg98NDkSeHlH0QtDVmxoanJ3/Z+//OfkcLH7THc7L2pIDvA5wH7bqO
3R6eLyjxPCENTZmLlYIJ+0Hw
-----END PRIVATE KEY-----
`;

const string ASSERTION_HEADER = "x-jwt-assertion";
const string ASSERTION_ISSUER = "test-gateway";

// db.bal's lazy Postgres getter, mocked so these interceptor-only tests never
// need a reachable database.
@test:Mock {
    functionName: "getDb"
}
test:MockFunction getDbMockFn = new ();

function mintAssertion(string privateKeyPem, string subjectUsername, string scope) returns string|error {
    crypto:PrivateKey key = check crypto:decodeRsaPrivateKeyFromContent(privateKeyPem.toBytes());
    jwt:IssuerConfig issuerConfig = {
        issuer: ASSERTION_ISSUER,
        username: subjectUsername,
        expTime: 300,
        customClaims: {"username": subjectUsername, "scope": scope, "ouHandle": "test-org"},
        signatureConfig: {
            algorithm: jwt:RS256,
            config: key
        }
    };
    return jwt:issue(issuerConfig);
}

// Flips one character in the payload segment of an already-signed JWT, so the
// signature no longer matches what it covers — "edited after signing".
function tamperPayload(string token) returns string {
    string[] parts = re `\.`.split(token);
    string payload = parts[1];
    string firstChar = payload.substring(0, 1);
    string flipped = firstChar == "A" ? "B" : "A";
    string tamperedPayload = flipped + payload.substring(1);
    return parts[0] + "." + tamperedPayload + "." + parts[2];
}

@test:Config {}
function testValidAssertionIsAccepted() returns error? {
    test:when(getDbMockFn).thenReturn(<postgresql:Client|error>error("mocked: no db in tests"));
    string token = check mintAssertion(TEST_PRIVATE_KEY_PEM, "test-employee", "expenses:read");
    http:Response response = check testClient->get("/me/expenses", {[ASSERTION_HEADER]: token});
    // Never 401: the assertion verified and the request reached the handler.
    // It then fails on the mocked database, which is expected in this test.
    test:assertEquals(response.statusCode, 500);
}

@test:Config {}
function testAssertionSignedWithWrongKeyIsRejected() returns error? {
    string token = check mintAssertion(WRONG_PRIVATE_KEY_PEM, "test-employee", "expenses:read");
    http:Response response = check testClient->get("/me/expenses", {[ASSERTION_HEADER]: token});
    test:assertEquals(response.statusCode, 401);
}

@test:Config {}
function testTamperedAssertionIsRejected() returns error? {
    string token = check mintAssertion(TEST_PRIVATE_KEY_PEM, "test-employee", "expenses:read");
    string tampered = tamperPayload(token);
    http:Response response = check testClient->get("/me/expenses", {[ASSERTION_HEADER]: tampered});
    test:assertEquals(response.statusCode, 401);
}

@test:Config {}
function testPublicEndpointNeedsNoAssertion() returns error? {
    http:Response response = check testClient->get("/categories");
    test:assertEquals(response.statusCode, 200);
    json body = check response.getJsonPayload();
    test:assertEquals(body, ["Travel", "Meals", "Lodging", "Office Supplies", "Software", "Other"]);
}
