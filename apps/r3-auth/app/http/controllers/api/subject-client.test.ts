/**
 * Drives the client library relying parties read this server with against the router itself,
 * so the subject payload is parsed and the token grant is sent by the code every one of them
 * depends on. The library is pointed at this app's origin, and every request there is routed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DefaultBodyType, StrictRequest } from "msw";

import { AuthError } from "@pkg/auth/auth-error";
import { Issuer } from "@pkg/auth/issuer";
import { ManagementClient, SubjectNotFoundError } from "@pkg/auth/management-client";
import { ServiceClient } from "@pkg/auth/service-client";
import { isFailure } from "@pkg/result";
import { http, passthrough } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { ISSUER } from "~/app/config";
import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed } from "~/app/lib/test/seed";
import routes from "~/routes/web";

/**
 * The endpoints this server serves, written out here: the published document names the
 * production host on every endpoint, while a test drives the app instance in front of it.
 */
const METADATA: Issuer.Metadata = {
	issuer: ISSUER,
	authorization_endpoint: new URL(routes.authorize.index.href(), ORIGIN).href,
	token_endpoint: new URL(routes.oauth.token.href(), ORIGIN).href,
	jwks_uri: new URL(routes.wellKnown.jwks.href(), ORIGIN).href,
};

let app: TestApp;
let fixtures: Fixtures;

/**
 * Copies an intercepted request into a `Request` of this realm, which is the shape the router
 * reads. The headers travel as plain entries, since a body-derived `content-type` survives
 * interception as a raw-header record only plain entries carry through.
 *
 * @param request - The request the library sent.
 */
async function forwardable(request: StrictRequest<DefaultBodyType>): Promise<Request> {
	let headers = Object.fromEntries(request.headers);
	let hasBody = request.method !== "GET" && request.method !== "HEAD";

	return new Request(request.url, {
		method: request.method,
		headers,
		body: hasBody ? await request.arrayBuffer() : null,
	});
}

/**
 * Forwards every request aimed at this app's origin into its router, which is how the
 * library reaches the instance under test.
 */
let server = setupServer(
	http.all(`${ORIGIN}/*`, async ({ request }) => {
		if (!app) return passthrough();
		return await app.fetch(await forwardable(request));
	}),
);

/**
 * A service client holding the seeded client's credentials, which is where every
 * bearer credential in this file comes from.
 *
 * @param clientSecret - The secret to authenticate with, so a test may present one
 *   this server refuses.
 */
function serviceClient(clientSecret = fixtures.clientSecret): ServiceClient {
	let issuer = new Issuer(ORIGIN, { identifier: ISSUER, metadata: METADATA });
	return new ServiceClient(issuer, { clientId: fixtures.clientId, clientSecret });
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("the client library", () => {
	test("parses the subject payload this endpoint returns", async () => {
		let subject = await new ManagementClient(serviceClient()).fetchSubjectById(fixtures.subjectId);

		/**
		 * The library validates the payload itself, so reaching past this line already
		 * proves its shape; the assertions below pin the values it carried through.
		 */
		if (isFailure(subject)) throw subject.error;

		expect(subject.data.id).toBe(fixtures.subjectId);
		expect(subject.data.displayName).toBe("Jane Doe");
		expect(subject.data.username).toBe("jane");
		expect(subject.data.emailAddress).toBe("jane@example.com");
		expect(subject.data.avatar).toBe("https://example.com/jane.png");
		expect(subject.data.role).toBe("user");
		expect(subject.data.createdAt).toBeInstanceOf(Date);
		expect(subject.data.createdAt.getTime()).toBeGreaterThan(0);
		expect(subject.data.updatedAt).toBeInstanceOf(Date);
	});

	test("parses a payload served from the cache identically", async () => {
		let client = new ManagementClient(serviceClient());

		await client.fetchSubjectById(fixtures.subjectId);
		/** Lets the cache write settle, so the second call is answered from it. */
		await new Promise((resolve) => setTimeout(resolve, 0));

		let subject = await client.fetchSubjectById(fixtures.subjectId);
		if (isFailure(subject)) throw subject.error;
		expect(subject.data.displayName).toBe("Jane Doe");
		expect(subject.data.createdAt).toBeInstanceOf(Date);
	});

	test("reads an unknown subject as a record this server holds none of", async () => {
		let subject = await new ManagementClient(serviceClient()).fetchSubjectById(
			"00000000-0000-0000-0000-000000000000",
		);

		if (!isFailure(subject)) throw new Error("The read answered with a subject");
		expect(subject.error).toBeInstanceOf(SubjectNotFoundError);
	});

	test("grants a token this server's API accepts", async () => {
		let token = await serviceClient().token();

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.api.subject.href({ subjectId: fixtures.subjectId })}`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(200);
	});

	test("reports a client secret this server refuses", async () => {
		let client = new ManagementClient(serviceClient("not-the-secret"));

		await expect(client.fetchSubjectById(fixtures.subjectId)).rejects.toThrow(AuthError);
	});
});
