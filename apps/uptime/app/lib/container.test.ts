/**
 * Smoke tests for the app service container (ADR-008): every service registered in
 * `./container` resolves to an instance of the right class without throwing. Real
 * `env.*` bindings are replaced with fakes since `Database`/`PolarClient`/`Mailer`/
 * `AuthSDK` only store their config at construction time rather than
 * performing I/O eagerly. `IdTokenVerificationKeyService` is the one exception — it
 * fires a real outbound fetch from a class field initializer, so `globalThis.fetch`
 * is stubbed for that resolution and its promise is drained to avoid an unhandled
 * rejection leaking into other tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, mock, test } from "bun:test";

mock.module("cloudflare:workers", () => ({
	env: {
		DB: "fake-d1",
		EMAIL: { send: async () => ({ messageId: "test-message-id" }) },
		POLAR_ACCESS_TOKEN: "test-polar-token",
		CLIENT_ID: "test-client-id",
		CLIENT_SECRET: "test-client-secret",
	},
}));

let { AuthSDK } = await import("@pkg/auth-sdk");
let { Mailer } = await import("@pkg/mail");
let { PolarClient } = await import("@pkg/polar");
let { ServiceContainer } = await import("@pkg/service-container");
let { Database } = await import("remix/data-table");
let { IdTokenVerificationKeyService } = await import("~/app/services/id-token-verification-key");
let { container } = await import("./container");

let originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("container", () => {
	test("is a ServiceContainer instance", () => {
		expect(container).toBeInstanceOf(ServiceContainer);
	});

	test("resolves a Database singleton backed by the D1 adapter", () => {
		let db = container.get(Database);

		expect(db).toBeInstanceOf(Database);
		expect(container.get(Database)).toBe(db);
	});

	test("resolves a PolarClient singleton", () => {
		let client = container.get(PolarClient);

		expect(client).toBeInstanceOf(PolarClient);
		expect(container.get(PolarClient)).toBe(client);
	});

	test("resolves an IdTokenVerificationKeyService singleton without a real network call", async () => {
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ keys: [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})) as unknown as typeof fetch;

		let service = container.get(IdTokenVerificationKeyService);

		expect(service).toBeInstanceOf(IdTokenVerificationKeyService);
		expect(container.get(IdTokenVerificationKeyService)).toBe(service);

		/** Drains the eagerly-fired JWKS fetch promise so it can't reject unhandled later. */
		await service.value.catch(() => {});
	});

	test("resolves a Mailer singleton for the send paths with no request behind them", () => {
		let mailer = container.get(Mailer);

		expect(mailer).toBeInstanceOf(Mailer);
		expect(container.get(Mailer)).toBe(mailer);
	});

	test("resolves an AuthSDK singleton", () => {
		let sdk = container.get(AuthSDK);

		expect(sdk).toBeInstanceOf(AuthSDK);
		expect(container.get(AuthSDK)).toBe(sdk);
	});
});
