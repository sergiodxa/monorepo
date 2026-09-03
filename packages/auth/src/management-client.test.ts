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
