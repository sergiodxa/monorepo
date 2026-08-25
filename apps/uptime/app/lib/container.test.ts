/**
 * Smoke tests for the app service container (ADR-008): every service registered in
 * `./container` resolves to an instance of the right class without throwing. `env.*` is
 * an in-memory binding set, which is enough because every service — including
 * `IdTokenVerificationKeyService`, whose resolver only goes to the network once a
 * token needs a key — stores its config at construction time and defers I/O until
 * it's actually needed. Only the bindings the registrations read are supplied, so a
 * service that grows a new dependency fails here naming the binding it reached for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1Database, createEnv, createSendEmail } from "@pkg/cloudflare-mocks";
import { describe, expect, test, vi } from "vitest";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		DB: createD1Database(),
		EMAIL: createSendEmail(),
		POLAR_ACCESS_TOKEN: "test-polar-token",
		CLIENT_ID: "test-client-id",
		CLIENT_SECRET: "test-client-secret",
	}),
}));

let { AuthSDK } = await import("@pkg/auth-sdk");
let { Mailer } = await import("@pkg/mail");
let { PolarClient } = await import("@pkg/polar");
let { ServiceContainer } = await import("@pkg/service-container");
let { Database } = await import("remix/data-table");
let { IdTokenVerificationKeyService } = await import("~/app/services/id-token-verification-key");
let { container } = await import("./container");

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

	test("resolves an IdTokenVerificationKeyService singleton without a real network call", () => {
		let service = container.get(IdTokenVerificationKeyService);

		expect(service).toBeInstanceOf(IdTokenVerificationKeyService);
		expect(container.get(IdTokenVerificationKeyService)).toBe(service);
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
