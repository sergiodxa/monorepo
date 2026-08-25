/**
 * Tests of the app container's registrations: that a send path with no request behind it
 * resolves a mailer carrying the app's sender identity, and that the billing client puts
 * the Secrets Store token on the wire, with the local fallback told apart from a failure.
 * The Workers bindings are mocked before the container is imported so the registrations
 * read them, and Polar is intercepted with MSW so the token is asserted on a real request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv, createSecretsStoreSecret } from "@pkg/cloudflare-mocks";
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { PolarClient } from "@pkg/polar";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import { MailTransport } from "~/app/services/mail-transport";

/** The Polar endpoint the billing call under test reaches. */
const CUSTOMERS_URL = "https://api.polar.sh/v1/customers/";

/** The value the faked Secrets Store binding answers with, unless a test fails it. */
const STORE_TOKEN = "polar_at_from_store";

/**
 * A created customer as Polar returns one. Every field is present because the client's
 * SDK validates the response body, and a partial one would fail the test for a reason
 * unrelated to the token being asserted.
 */
const POLAR_CUSTOMER = {
	id: "cus_1",
	type: "individual",
	created_at: "2026-08-08T00:00:00Z",
	modified_at: null,
	metadata: {},
	external_id: null,
	email: "jane@example.com",
	email_verified: false,
	name: null,
	billing_address: null,
	tax_id: null,
	organization_id: "org_1",
	deleted_at: null,
	avatar_url: "https://avatars.example.com/jane.png",
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

let { container, readPolarAccessToken } = await import("~/app/lib/container");

let transport = new MemoryTransport();
let mailer: Mailer;

let server = setupServer();

beforeAll(() => {
	server.listen({ onUnhandledRequest: "error" });

	container.instance(MailTransport, transport);
	mailer = container.get(Mailer);
});

beforeEach(() => {
	accessToken.reset();
	localToken = undefined;
});

afterEach(() => {
	server.resetHandlers();
});

afterAll(() => {
	server.close();
});

describe("the background mailer", () => {
	test("resolves from the container", () => {
		expect(mailer).toBeInstanceOf(Mailer);
	});

	test("sends with the app's sender identity", async () => {
		let result = await mailer.send({
			to: { email: "jane@example.com" },
			subject: "A subject",
			html: "<p>A body.</p>",
		});

		expect(result.status).toBe("success");
		expect(transport.last?.from).toEqual(MAIL_FROM);
		expect(transport.last?.replyTo).toEqual([MAIL_REPLY_TO]);
	});
});

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

describe("the billing client", () => {
	test("resolves as a singleton without reading the secret", () => {
		let client = container.get(PolarClient);

		expect(client).toBeInstanceOf(PolarClient);
		expect(container.get(PolarClient)).toBe(client);
		expect(accessToken.reads).toBe(0);
	});

	test("sends the token from the binding to Polar as a bearer credential", async () => {
		let authorizations: Array<string | null> = [];

		server.use(
			http.post(CUSTOMERS_URL, ({ request }) => {
				authorizations.push(request.headers.get("authorization"));
				return HttpResponse.json(POLAR_CUSTOMER, { status: 201 });
			}),
		);

		await container.get(PolarClient).createCustomer("jane@example.com");

		expect(authorizations).toEqual([`Bearer ${STORE_TOKEN}`]);
		expect(accessToken.reads).toBe(1);
	});
});
