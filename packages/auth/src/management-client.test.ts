/**
 * Covers what a `ManagementClient` promises its callers: a validated subject whose
 * timestamps arrive as dates, the service client's token on every request, and a
 * failure taxonomy where a missing record and an unavailable provider stay apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import {
	ManagementClient,
	ManagementError,
	ManagementErrorCode,
	ManagementProblem,
	SubjectNotFoundError,
} from "./management-client.js";

/** The provider every test in this file reads records from. */
const ISSUER = "https://auth.test";

/** The record every test asks for. */
const SUBJECT_ID = "subject_1";

/** Where the management API serves {@link SUBJECT_ID}. */
const SUBJECT_URL = `${ISSUER}/api/subjects/${SUBJECT_ID}`;

/** A payload in the shape the management API answers a subject read with. */
const PAYLOAD = {
	subject: {
		id: SUBJECT_ID,
		createdAt: "2026-01-02T03:04:05.000Z",
		updatedAt: "2026-02-03T04:05:06.000Z",
		displayName: "Ada Lovelace",
		avatar: "https://cdn.test/avatars/ada.png",
		role: "admin",
		username: "ada",
		emailAddress: "ada@test",
	},
};

/**
 * A service client that hands out a fixed token and records what it was asked for,
 * so a test asserts on the credential a request carried and the resources it was
 * scoped to without reaching into the client under test.
 */
class TestService implements ManagementClient.Service {
	/** The provider a client with no base URL of its own reads records from. */
	readonly issuer = { url: new URL(ISSUER) };

	/** The resource indicators of every token request, in the order they arrived. */
	readonly requested: string[][] = [];

	/** The bearer credential every token request answers with. */
	value = "token-abc";

	/**
	 * Issues the fixed token.
	 *
	 * @param options - Resource indicators the token is scoped to.
	 */
	token(options?: { resources?: string[] }): Promise<string> {
		this.requested.push(options?.resources ?? []);
		return Promise.resolve(this.value);
	}
}

let server = setupServer();
let service: TestService;

/**
 * Answers the subject read with a body carried as a blob, so the answer declares
 * exactly the media type a test names and nothing when it names none.
 *
 * @param body - The raw body the provider answers with.
 * @param contentType - The media type the provider declares, left off when absent.
 */
function answerWith(body: string, contentType?: string): void {
	server.use(
		http.get(SUBJECT_URL, () => {
			let headers = contentType === undefined ? undefined : { "content-type": contentType };
			return new HttpResponse(new Blob([body]), { headers });
		}),
	);
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
	service = new TestService();
});

describe("ManagementClient#fetchSubjectById", () => {
	test("answers with a subject whose timestamps are dates and whose avatar is a URL", async () => {
		server.use(http.get(SUBJECT_URL, () => HttpResponse.json(PAYLOAD)));

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isFailure(result)) throw result.error;

		expect(result.data.createdAt).toBeInstanceOf(Date);
		expect(result.data.createdAt.toISOString()).toBe("2026-01-02T03:04:05.000Z");
		expect(result.data.updatedAt).toBeInstanceOf(Date);
		expect(result.data.updatedAt.toISOString()).toBe("2026-02-03T04:05:06.000Z");
		expect(result.data).toMatchObject({
			id: SUBJECT_ID,
			displayName: "Ada Lovelace",
			avatar: "https://cdn.test/avatars/ada.png",
			role: "admin",
			username: "ada",
			emailAddress: "ada@test",
		});
	});

	test("sends the service client's token as a bearer credential", async () => {
		let authorization: string | null = null;

		server.use(
			http.get(SUBJECT_URL, ({ request }) => {
				authorization = request.headers.get("authorization");
				return HttpResponse.json(PAYLOAD);
			}),
		);

		await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		expect(authorization).toBe("Bearer token-abc");
	});

	test("scopes the token to the configured resource indicators", async () => {
		server.use(http.get(SUBJECT_URL, () => HttpResponse.json(PAYLOAD)));

		let client = new ManagementClient(service, { baseUrl: ISSUER, resources: [`${ISSUER}/api`] });
		await client.fetchSubjectById(SUBJECT_ID);

		expect(service.requested).toEqual([[`${ISSUER}/api`]]);
	});

	test("reads from the service client's issuer when it is given no base URL", async () => {
		server.use(http.get(SUBJECT_URL, () => HttpResponse.json(PAYLOAD)));

		let client = new ManagementClient(service);

		expect(isSuccess(await client.fetchSubjectById(SUBJECT_ID))).toBe(true);
	});

	test("reads from an explicit base URL, for a management API served elsewhere", async () => {
		server.use(
			http.get(`https://admin.test/api/subjects/${SUBJECT_ID}`, () => HttpResponse.json(PAYLOAD)),
		);

		let client = new ManagementClient(service, { baseUrl: "https://admin.test" });

		expect(isSuccess(await client.fetchSubjectById(SUBJECT_ID))).toBe(true);
	});

	test("escapes a subject id into the path", async () => {
		let path: string | null = null;

		server.use(
			http.get(`${ISSUER}/api/subjects/*`, ({ request }) => {
				path = new URL(request.url).pathname;
				return HttpResponse.json(PAYLOAD);
			}),
		);

		await new ManagementClient(service).fetchSubjectById("a b/c");

		expect(path).toBe("/api/subjects/a%20b%2Fc");
	});

	test("answers a missing subject with a not-found failure carrying the id", async () => {
		server.use(
			http.get(SUBJECT_URL, () =>
				HttpResponse.json({ error: "Subject not found" }, { status: 404 }),
			),
		);

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isSuccess(result)) throw new Error("Expected a failure.");
		expect(result.error).toBeInstanceOf(SubjectNotFoundError);
		expect((result.error as SubjectNotFoundError).subjectId).toBe(SUBJECT_ID);
	});

	test.each([
		[401, ManagementErrorCode.Unauthorized],
		[403, ManagementErrorCode.Unauthorized],
		[429, ManagementErrorCode.RateLimited],
		[500, ManagementErrorCode.ProviderFailed],
		[503, ManagementErrorCode.ProviderFailed],
	])("answers a %i with a %s failure a caller tells apart from not-found", async (status, code) => {
		server.use(http.get(SUBJECT_URL, () => new HttpResponse(null, { status })));

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isSuccess(result)) throw new Error("Expected a failure.");
		expect(result.error).toBeInstanceOf(ManagementError);
		expect(result.error).not.toBeInstanceOf(SubjectNotFoundError);
		expect(ManagementError.is(result.error, code)).toBe(true);
		expect((result.error as ManagementError).status).toBe(status);
	});

	test("answers a request that never completed with a request-failed failure", async () => {
		server.use(http.get(SUBJECT_URL, () => HttpResponse.error()));

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isSuccess(result)) throw new Error("Expected a failure.");
		expect(result.error).not.toBeInstanceOf(SubjectNotFoundError);
		expect(ManagementError.is(result.error, ManagementErrorCode.RequestFailed)).toBe(true);
		expect((result.error as ManagementError).status).toBeNull();
	});

	test("answers a payload missing a member with an invalid-response failure", async () => {
		server.use(http.get(SUBJECT_URL, () => HttpResponse.json({ subject: { id: SUBJECT_ID } })));

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isSuccess(result)) throw new Error("Expected a failure.");
		expect(result.error).not.toBeInstanceOf(SubjectNotFoundError);
		expect(ManagementError.is(result.error, ManagementErrorCode.InvalidResponse)).toBe(true);
	});

	test("answers a payload whose avatar is not a URL with an invalid-response failure", async () => {
		server.use(
			http.get(SUBJECT_URL, () =>
				HttpResponse.json({ subject: { ...PAYLOAD.subject, avatar: "not-a-url" } }),
			),
		);

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isSuccess(result)) throw new Error("Expected a failure.");
		expect(ManagementError.is(result.error, ManagementErrorCode.InvalidResponse)).toBe(true);
	});

	test("answers a payload whose timestamp is unreadable with an invalid-response failure", async () => {
		server.use(
			http.get(SUBJECT_URL, () =>
				HttpResponse.json({ subject: { ...PAYLOAD.subject, createdAt: "yesterday" } }),
			),
		);

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isSuccess(result)) throw new Error("Expected a failure.");
		expect(ManagementError.is(result.error, ManagementErrorCode.InvalidResponse)).toBe(true);
	});

	test("answers a body that is not JSON with an invalid-response failure", async () => {
		server.use(http.get(SUBJECT_URL, () => HttpResponse.text("<html>maintenance</html>")));

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isSuccess(result)) throw new Error("Expected a failure.");
		expect(ManagementError.is(result.error, ManagementErrorCode.InvalidResponse)).toBe(true);
	});

	test("discards a body declared as HTML without parsing it, naming the type", async () => {
		answerWith(JSON.stringify(PAYLOAD), "text/html");

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isSuccess(result)) throw new Error("Expected a failure.");
		expect(ManagementError.is(result.error, ManagementErrorCode.InvalidResponse)).toBe(true);
		expect(result.error.message).toContain("text/html");
		expect((result.error as ManagementError).status).toBe(200);
	});

	test("reads a subject from a payload declared as JSON with a charset", async () => {
		answerWith(JSON.stringify(PAYLOAD), "application/json; charset=utf-8");

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isFailure(result)) throw result.error;
		expect(result.data.id).toBe(SUBJECT_ID);
	});

	test("reads a subject from a payload declared under a `+json` subtype", async () => {
		answerWith(JSON.stringify(PAYLOAD), "application/vnd.provider.subject+json");

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isFailure(result)) throw result.error;
		expect(result.data.id).toBe(SUBJECT_ID);
	});

	test("reads a subject from an answer that declares no media type", async () => {
		answerWith(JSON.stringify(PAYLOAD));

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isFailure(result)) throw result.error;
		expect(result.data.id).toBe(SUBJECT_ID);
	});

	test("answers a body that declares no media type and is not JSON with an invalid-response failure", async () => {
		answerWith("<html>maintenance</html>");

		let result = await new ManagementClient(service).fetchSubjectById(SUBJECT_ID);

		if (isSuccess(result)) throw new Error("Expected a failure.");
		expect(ManagementError.is(result.error, ManagementErrorCode.InvalidResponse)).toBe(true);
		expect((result.error as ManagementError).status).toBe(200);
	});

	test("lets a best-effort caller pass over a missing subject and surface a blip", async () => {
		server.use(http.get(SUBJECT_URL, () => new HttpResponse(null, { status: 429 })));

		let client = new ManagementClient(service);

		/**
		 * The shape a caller resolving many ids writes: an absent record is an answer it
		 * skips, and every other failure reaches the run so an empty list is never
		 * mistaken for a complete one.
		 */
		async function resolve(subjectId: string): Promise<ManagementClient.Subject | null> {
			let result = await client.fetchSubjectById(subjectId);
			if (isSuccess(result)) return result.data;
			if (result.error instanceof SubjectNotFoundError) return null;
			throw result.error;
		}

		await expect(resolve(SUBJECT_ID)).rejects.toBeInstanceOf(ManagementError);

		server.use(http.get(SUBJECT_URL, () => new HttpResponse(null, { status: 404 })));

		expect(await resolve(SUBJECT_ID)).toBeNull();
	});
});

/**
 * Covers the tenant-scoped management surface: a request built under
 * `{baseUrl}/tenants/{tenantId}/…`, a bearer token and an `X-API-Version` on every
 * call, RFC 9457 `application/problem+json` decoded into a {@link ManagementProblem},
 * and a keyset list's `Link` header parsed into continuation targets. Every method
 * shares the same request and decode helpers, so each resource group below covers a
 * success path, a not-found problem, and a validation problem once, and the `Link`
 * header round trip is exercised on a single list method rather than on every one.
 */
describe("ManagementClient tenant-scoped surface", () => {
	/** Where the tenant-scoped surface is served, apart from the OIDC issuer above. */
	const MANAGEMENT_BASE_URL = "https://api.test";

	/** The tenant every call in this suite is scoped to. */
	const TENANT_ID = "ten_1";

	/** Builds the absolute URL one of this tenant's resources is served at. */
	function tenantUrl(...segments: string[]): string {
		return [MANAGEMENT_BASE_URL, "tenants", TENANT_ID, ...segments].join("/");
	}

	/** Builds a client pointed at the tenant-scoped surface, with an optional configured API version. */
	function tenantClient(apiVersion?: string): ManagementClient {
		return new ManagementClient(service, {
			baseUrl: MANAGEMENT_BASE_URL,
			resources: [MANAGEMENT_BASE_URL],
			apiVersion,
		});
	}

	/** Answers with an RFC 9457 `application/problem+json` body. */
	function problem(
		body: { type: string; title: string; detail?: string; instance?: string; errors?: unknown[] },
		status: number,
	) {
		return new HttpResponse(JSON.stringify({ status, ...body }), {
			status,
			headers: { "content-type": "application/problem+json" },
		});
	}

	describe("subjects and identifiers", () => {
		const SUBJECT_PAYLOAD = {
			id: "sub_1",
			status: "active",
			name: "Ada Lovelace",
			givenName: "Ada",
			familyName: "Lovelace",
			nickname: null,
			preferredUsername: null,
			picture: null,
			locale: null,
			zoneinfo: null,
			identifiers: [
				{
					kind: "email",
					value: "ada@example.com",
					verified: true,
					verifiedAt: 1_750_000_000_000,
					isPrimary: true,
				},
			],
			attributes: { department: "engineering" },
			totpFactor: { label: "iPhone", lastUsedAt: 1_750_000_000_000 },
			recoveryCodesRemaining: 8,
			trustedDevices: [],
		};

		test("reads a tenant's subject with its identifiers and second-factor state", async () => {
			server.use(
				http.get(tenantUrl("subjects", "sub_1"), () => HttpResponse.json(SUBJECT_PAYLOAD)),
			);

			let result = await tenantClient().fetchTenantSubjectById(TENANT_ID, "sub_1");

			if (isFailure(result)) throw result.error;
			expect(result.data).toEqual(SUBJECT_PAYLOAD);
		});

		test("answers a missing subject with a decoded not-found problem", async () => {
			server.use(
				http.get(tenantUrl("subjects", "sub_x"), () =>
					problem(
						{ type: "https://api.test/errors/subject-not-found", title: "Subject not found" },
						404,
					),
				),
			);

			let result = await tenantClient().fetchTenantSubjectById(TENANT_ID, "sub_x");

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect(result.error).toBeInstanceOf(ManagementProblem);
			expect((result.error as ManagementProblem).status).toBe(404);
			expect((result.error as ManagementProblem).type).toBe(
				"https://api.test/errors/subject-not-found",
			);
		});

		test("decodes a validation failure's field-level errors", async () => {
			server.use(
				http.post(tenantUrl("subjects"), () =>
					problem(
						{
							type: "https://api.test/errors/validation",
							title: "Validation failed",
							detail: "One or more fields were invalid.",
							instance: "req_123",
							errors: [
								{
									pointer: "/identifiers/0/value",
									code: "invalid_identifier",
									message: "Not a valid email address.",
								},
							],
						},
						422,
					),
				),
			);

			let result = await tenantClient().createTenantSubject(TENANT_ID, {
				identifiers: [{ kind: "email", value: "not-an-email" }],
			});

			if (isSuccess(result)) throw new Error("Expected a failure.");
			let error = result.error as ManagementProblem;
			expect(error).toBeInstanceOf(ManagementProblem);
			expect(error.title).toBe("Validation failed");
			expect(error.detail).toBe("One or more fields were invalid.");
			expect(error.instance).toBe("req_123");
			expect(error.errors).toEqual([
				{
					pointer: "/identifiers/0/value",
					code: "invalid_identifier",
					message: "Not a valid email address.",
				},
			]);
		});

		test("sends a removed identifier's value as a query parameter rather than a path segment", async () => {
			let requestedMethod: string | null = null;
			let requestedUrl: string | null = null;

			server.use(
				http.delete(tenantUrl("subjects", "sub_1", "identifiers"), ({ request }) => {
					requestedMethod = request.method;
					requestedUrl = request.url;
					return HttpResponse.json({ promotedPrimary: null, notify: [] });
				}),
			);

			let result = await tenantClient().removeTenantSubjectIdentifier(TENANT_ID, "sub_1", {
				value: "ada@example.com",
			});

			if (isFailure(result)) throw result.error;
			expect(requestedMethod).toBe("DELETE");
			expect(new URL(requestedUrl ?? "").searchParams.get("value")).toBe("ada@example.com");
		});

		test("verifies an identifier from its ticket alone, naming no subject in the path", async () => {
			let requestedPath: string | null = null;

			server.use(
				http.post(tenantUrl("identifiers", "verify"), ({ request }) => {
					requestedPath = new URL(request.url).pathname;
					return HttpResponse.json({ subjectId: "sub_1", promotedPrimary: true });
				}),
			);

			let result = await tenantClient().verifyTenantSubjectIdentifier(TENANT_ID, {
				ticket: "ticket-abc",
			});

			if (isFailure(result)) throw result.error;
			expect(requestedPath).toBe("/tenants/ten_1/identifiers/verify");
			expect(result.data).toEqual({ subjectId: "sub_1", promotedPrimary: true });
		});
	});

	describe("credentials and sessions", () => {
		test("pages a subject's sessions and follows the Link header's continuation targets", async () => {
			let next = tenantUrl("subjects", "sub_1", "sessions") + "?cursor=next-cursor";
			let prev = tenantUrl("subjects", "sub_1", "sessions") + "?cursor=prev-cursor";

			server.use(
				http.get(tenantUrl("subjects", "sub_1", "sessions"), () =>
					HttpResponse.json(
						[
							{
								id: "sess_1",
								createdAt: 1,
								lastSeenAt: 2,
								amr: ["pwd"],
								ip: "203.0.113.10",
								userAgent: "UA",
								country: "US",
								region: "CA",
								city: "SF",
							},
						],
						{ headers: { link: `<${next}>; rel="next", <${prev}>; rel="prev"` } },
					),
				),
			);

			let result = await tenantClient().listTenantSubjectSessions(TENANT_ID, "sub_1");

			if (isFailure(result)) throw result.error;
			expect(result.data.items).toHaveLength(1);
			expect(result.data.items[0]?.id).toBe("sess_1");
			expect(result.data.next).toBe(next);
			expect(result.data.prev).toBe(prev);
		});

		test("answers revoking a missing session with a not-found problem", async () => {
			server.use(
				http.post(tenantUrl("subjects", "sub_1", "sessions", "sess_x", "revoke"), () =>
					problem({ type: "https://api.test/errors/session-not-found", title: "Not found" }, 404),
				),
			);

			let result = await tenantClient().revokeTenantSubjectSession(TENANT_ID, "sub_1", "sess_x", {
				reason: "suspicious activity",
			});

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect((result.error as ManagementProblem).status).toBe(404);
		});

		test("carries a second-factor reset's notify address through, or a validation problem", async () => {
			server.use(
				http.post(tenantUrl("subjects", "sub_1", "second-factor", "reset"), () =>
					problem({ type: "https://api.test/errors/validation", title: "Validation failed" }, 422),
				),
			);

			let result = await tenantClient().resetTenantSubjectSecondFactor(TENANT_ID, "sub_1", {
				reason: "",
			});

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect(result.error).toBeInstanceOf(ManagementProblem);

			server.use(
				http.post(tenantUrl("subjects", "sub_1", "second-factor", "reset"), () =>
					HttpResponse.json({ notifyAddress: "ada@example.com" }),
				),
			);

			let succeeded = await tenantClient().resetTenantSubjectSecondFactor(TENANT_ID, "sub_1", {
				reason: "lost device",
			});

			if (isFailure(succeeded)) throw succeeded.error;
			expect(succeeded.data.notifyAddress).toBe("ada@example.com");
		});
	});

	describe("clients and secrets", () => {
		const CLIENT_RECORD = {
			id: "client_1",
			name: "Acme Dashboard",
			kind: "confidential",
			redirectUris: ["https://acme.test/callback"],
			postLogoutRedirectUris: [],
			grantTypes: ["authorization_code"],
			responseTypes: ["code"],
			scopes: ["openid"],
			tokenEndpointAuthMethod: "client_secret_basic",
			requireConsent: true,
			createdAt: 1,
			updatedAt: 1,
			disabledAt: null,
		};

		test("registers a confidential client and returns its one-time secret", async () => {
			server.use(
				http.post(tenantUrl("clients"), () =>
					HttpResponse.json({ client: CLIENT_RECORD, secret: "csec_abc" }),
				),
			);

			let result = await tenantClient().registerTenantClient(TENANT_ID, {
				name: "Acme Dashboard",
				kind: "confidential",
				redirectUris: ["https://acme.test/callback"],
				postLogoutRedirectUris: [],
				grantTypes: ["authorization_code"],
				responseTypes: ["code"],
				scopes: ["openid"],
				tokenEndpointAuthMethod: "client_secret_basic",
				requireConsent: true,
			});

			if (isFailure(result)) throw result.error;
			expect(result.data.client).toEqual(CLIENT_RECORD);
			expect(result.data.secret).toBe("csec_abc");
		});

		test("answers updating a missing client with a not-found problem", async () => {
			server.use(
				http.put(tenantUrl("clients", "client_x"), () =>
					problem({ type: "https://api.test/errors/client-not-found", title: "Not found" }, 404),
				),
			);

			let result = await tenantClient().updateTenantClient(TENANT_ID, "client_x", {
				name: "Acme Dashboard",
				kind: "confidential",
				redirectUris: [],
				postLogoutRedirectUris: [],
				grantTypes: [],
				responseTypes: ["code"],
				scopes: [],
				tokenEndpointAuthMethod: "client_secret_basic",
				requireConsent: true,
			});

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect((result.error as ManagementProblem).status).toBe(404);
		});

		test("decodes a client registration's redirect-uri validation failure", async () => {
			server.use(
				http.post(tenantUrl("clients"), () =>
					problem(
						{
							type: "https://api.test/errors/validation",
							title: "Validation failed",
							errors: [
								{
									pointer: "/redirectUris/0",
									code: "invalid-redirect-uri",
									message: "Must be absolute and carry no fragment.",
								},
							],
						},
						422,
					),
				),
			);

			let result = await tenantClient().registerTenantClient(TENANT_ID, {
				name: "Acme Dashboard",
				kind: "confidential",
				redirectUris: ["not-a-url"],
				postLogoutRedirectUris: [],
				grantTypes: ["authorization_code"],
				responseTypes: ["code"],
				scopes: [],
				tokenEndpointAuthMethod: "client_secret_basic",
				requireConsent: true,
			});

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect((result.error as ManagementProblem).errors[0]?.pointer).toBe("/redirectUris/0");
		});
	});

	describe("scopes, grants and roles", () => {
		test("lists a subject's grants", async () => {
			server.use(
				http.get(tenantUrl("subjects", "sub_1", "grants"), () =>
					HttpResponse.json([
						{
							clientId: "client_1",
							clientName: "Acme Dashboard",
							scopes: ["openid"],
							createdAt: 1,
						},
					]),
				),
			);

			let result = await tenantClient().listTenantGrants(TENANT_ID, "sub_1");

			if (isFailure(result)) throw result.error;
			expect(result.data.items).toEqual([
				{ clientId: "client_1", clientName: "Acme Dashboard", scopes: ["openid"], createdAt: 1 },
			]);
		});

		test("answers revoking an unknown grant with a not-found problem", async () => {
			server.use(
				http.delete(tenantUrl("subjects", "sub_1", "grants", "client_x"), () =>
					problem({ type: "https://api.test/errors/grant-not-found", title: "Not found" }, 404),
				),
			);

			let result = await tenantClient().revokeTenantGrant(TENANT_ID, "sub_1", "client_x");

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect((result.error as ManagementProblem).status).toBe(404);
		});

		test("decodes a bad-cursor validation problem while paging grants", async () => {
			server.use(
				http.get(tenantUrl("subjects", "sub_1", "grants"), () =>
					problem(
						{
							type: "https://api.test/errors/validation",
							title: "Validation failed",
							errors: [{ pointer: "/cursor", code: "invalid_cursor", message: "Stale cursor." }],
						},
						400,
					),
				),
			);

			let result = await tenantClient().listTenantGrants(TENANT_ID, "sub_1", { cursor: "stale" });

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect((result.error as ManagementProblem).errors[0]?.code).toBe("invalid_cursor");
		});
	});

	describe("audit events", () => {
		const AUDIT_EVENT = {
			id: "000000000001",
			at: 1_750_000_000_000,
			action: "subject.created",
			actorType: "platform",
			actorId: "system",
			targetType: "subject",
			targetId: "sub_1",
			outcome: "succeeded",
			context: {},
			detail: {},
		};

		test("reads a page of the tenant's audit log over a window", async () => {
			server.use(http.get(tenantUrl("audit-events"), () => HttpResponse.json([AUDIT_EVENT])));

			let result = await tenantClient().readTenantAuditPage(TENANT_ID, { from: 0, to: Date.now() });

			if (isFailure(result)) throw result.error;
			expect(result.data.items).toEqual([AUDIT_EVENT]);
		});

		test("answers a missing tenant's audit log with a not-found problem", async () => {
			server.use(
				http.get(tenantUrl("audit-events"), () =>
					problem({ type: "https://api.test/errors/tenant-not-found", title: "Not found" }, 404),
				),
			);

			let result = await tenantClient().readTenantAuditPage(TENANT_ID, { from: 0, to: Date.now() });

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect((result.error as ManagementProblem).status).toBe(404);
		});

		test("decodes a validation problem for a window with `to` before `from`", async () => {
			server.use(
				http.get(tenantUrl("audit-events"), () =>
					problem(
						{
							type: "https://api.test/errors/validation",
							title: "Validation failed",
							errors: [{ pointer: "/to", code: "before_from", message: "`to` precedes `from`." }],
						},
						400,
					),
				),
			);

			let result = await tenantClient().readTenantAuditPage(TENANT_ID, { from: 100, to: 0 });

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect((result.error as ManagementProblem).errors[0]?.pointer).toBe("/to");
		});
	});

	describe("tenants, members and domains", () => {
		const TENANT_RECORD = {
			id: TENANT_ID,
			name: "Acme",
			slug: "acme-4f9a",
			issuer: "https://acme.example.com",
			region: "wnam",
			status: "active",
			planSlug: "pro",
			subscriptionStatus: "active",
			currentPeriodEnd: 1_750_000_000_000,
			cancelAtPeriodEnd: false,
			graceUntil: null,
			lapsedAt: null,
			createdAt: 1,
			updatedAt: 1,
		};

		test("reads a tenant's own public record, leaving out its billing linkage", async () => {
			server.use(http.get(tenantUrl(), () => HttpResponse.json(TENANT_RECORD)));

			let result = await tenantClient().fetchTenant(TENANT_ID);

			if (isFailure(result)) throw result.error;
			expect(result.data).toEqual(TENANT_RECORD);
			expect(result.data).not.toHaveProperty("customerId");
			expect(result.data).not.toHaveProperty("subscriptionId");
		});

		test("answers a missing tenant with a not-found problem", async () => {
			server.use(
				http.get(tenantUrl(), () =>
					problem({ type: "https://api.test/errors/tenant-not-found", title: "Not found" }, 404),
				),
			);

			let result = await tenantClient().fetchTenant(TENANT_ID);

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect((result.error as ManagementProblem).status).toBe(404);
		});

		test("decodes a domain attachment's hostname validation failure", async () => {
			server.use(
				http.post(tenantUrl("domains"), () =>
					problem(
						{
							type: "https://api.test/errors/validation",
							title: "Validation failed",
							errors: [
								{ pointer: "/hostname", code: "invalid_hostname", message: "Not a hostname." },
							],
						},
						422,
					),
				),
			);

			let result = await tenantClient().attachTenantDomain(TENANT_ID, {
				hostname: "not a hostname",
				kind: "custom",
			});

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect((result.error as ManagementProblem).errors[0]?.pointer).toBe("/hostname");
		});

		test("lists members and domains as plain arrays, since neither operation pages", async () => {
			server.use(
				http.get(tenantUrl("members"), () =>
					HttpResponse.json([
						{
							id: "mem_1",
							tenantId: TENANT_ID,
							subjectId: "sub_1",
							role: "owner",
							createdAt: 1,
							updatedAt: 1,
						},
					]),
				),
				http.get(tenantUrl("domains"), () =>
					HttpResponse.json([
						{
							id: "dom_1",
							tenantId: TENANT_ID,
							hostname: "acme.example.com",
							kind: "platform",
							status: "active",
							certificateStatus: null,
							verificationName: null,
							verificationValue: null,
							createdAt: 1,
							updatedAt: 1,
						},
					]),
				),
			);

			let client = tenantClient();
			let members = await client.listTenantMembers(TENANT_ID);
			let domains = await client.listTenantDomains(TENANT_ID);

			if (isFailure(members)) throw members.error;
			if (isFailure(domains)) throw domains.error;
			expect(Array.isArray(members.data)).toBe(true);
			expect(members.data).toHaveLength(1);
			expect(Array.isArray(domains.data)).toBe(true);
			expect(domains.data).toHaveLength(1);
		});

		test("reports a policy update's success with no value, from a 204 answer", async () => {
			server.use(http.post(tenantUrl("mfa-policy"), () => new HttpResponse(null, { status: 204 })));

			let result = await tenantClient().updateTenantMfaPolicy(TENANT_ID, { policy: "required" });

			if (isFailure(result)) throw result.error;
			expect(result.data).toBeUndefined();
		});
	});

	describe("versioning and generic failures", () => {
		test("names the configured API version and records the one the answer echoes", async () => {
			let sentVersion: string | null = null;

			server.use(
				http.get(tenantUrl(), ({ request }) => {
					sentVersion = request.headers.get("x-api-version");
					return HttpResponse.json(
						{
							id: TENANT_ID,
							name: "Acme",
							slug: "acme-4f9a",
							issuer: "https://acme.example.com",
							region: "wnam",
							status: "active",
							planSlug: "pro",
							subscriptionStatus: "active",
							currentPeriodEnd: null,
							cancelAtPeriodEnd: false,
							graceUntil: null,
							lapsedAt: null,
							createdAt: 1,
							updatedAt: 1,
						},
						{ headers: { "x-api-version": "2026-09-18" } },
					);
				}),
			);

			let client = tenantClient("2026-09-18");
			expect(client.apiVersionReceived).toBeNull();

			let result = await client.fetchTenant(TENANT_ID);

			if (isFailure(result)) throw result.error;
			expect(sentVersion).toBe("2026-09-18");
			expect(client.apiVersionReceived).toBe("2026-09-18");
		});

		test("falls back to a flat ManagementError for a non-2xx answer that is not a problem body", async () => {
			server.use(http.get(tenantUrl(), () => new HttpResponse(null, { status: 500 })));

			let result = await tenantClient().fetchTenant(TENANT_ID);

			if (isSuccess(result)) throw new Error("Expected a failure.");
			expect(result.error).toBeInstanceOf(ManagementError);
			expect(result.error).not.toBeInstanceOf(ManagementProblem);
			expect(ManagementError.is(result.error, ManagementErrorCode.ProviderFailed)).toBe(true);
		});
	});
});
