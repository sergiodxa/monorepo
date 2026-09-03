/**
 * Tests of the billing platform this app is configured with: that the Secrets Store
 * token reaches Polar as a bearer credential without being read before the first call
 * that bills, with the local fallback told apart from a failure. The Workers bindings
 * are mocked before the module is imported, and Polar is intercepted with MSW so the
 * token is asserted on a real request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv, createSecretsStoreSecret } from "@pkg/cloudflare-mocks";
import { unwrap } from "@pkg/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

/** The Polar endpoint the billing call under test reaches. */
const CUSTOMERS_URL = "https://api.polar.sh/v1/customers/";

/** The value the faked Secrets Store binding answers with, unless a test fails it. */
const STORE_TOKEN = "polar_at_from_store";

/** A created customer as Polar returns one, in the shape the provider reads back. */
const POLAR_CUSTOMER = {
	id: "cus_1",
	created_at: "2026-08-08T00:00:00Z",
	email: "jane@example.com",
	name: null,
	external_id: "subject-1",
	metadata: {},
};

/** The Secrets Store binding the billing token is read from; its answer is swapped per test. */
let accessToken = createSecretsStoreSecret({
	name: "POLAR_ACCESS_TOKEN",
	value: STORE_TOKEN,
});

/** The plain local-development variable, absent unless a test sets it. */
let localToken: string | undefined;

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		POLAR_ACCESS_TOKEN: accessToken,
		/**
		 * A getter because a test sets the fallback after `env` is already captured; the
		 * bindings are carried over as descriptors, so this is re-read on every access.
		 */
		get POLAR_ACCESS_TOKEN_LOCAL(): string | undefined {
			return localToken;
		},
	}),
	waitUntil: () => {},
}));

let { polar, readPolarAccessToken } = await import("~/app/lib/billing");

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

beforeEach(() => {
	accessToken.reset();
	localToken = undefined;
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("the Polar access token", () => {
	test("comes from the Secrets Store binding", async () => {
		expect(await readPolarAccessToken()).toBe(STORE_TOKEN);
	});

	test("falls back to the local variable when the binding cannot be read", async () => {
		accessToken.fail();
		localToken = "polar_at_local";

		expect(await readPolarAccessToken()).toBe("polar_at_local");
	});

	test("reports the binding's failure when there is no local variable", async () => {
		accessToken.fail();

		await expect(readPolarAccessToken()).rejects.toThrow(`Secret "POLAR_ACCESS_TOKEN" not found`);
	});
});

describe("the billing platform", () => {
	test("sends the token from the binding to Polar as a bearer credential", async () => {
		let authorizations: Array<string | null> = [];

		server.use(
			http.post(CUSTOMERS_URL, ({ request }) => {
				authorizations.push(request.headers.get("authorization"));
				return HttpResponse.json(POLAR_CUSTOMER, { status: 201 });
			}),
		);

		let customer = await unwrap(
			polar.customers.create({ email: "jane@example.com", externalId: "subject-1" }),
		);

		expect(customer.externalId).toBe("subject-1");
		expect(authorizations).toEqual([`Bearer ${STORE_TOKEN}`]);
	});
});
