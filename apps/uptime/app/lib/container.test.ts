/**
 * Smoke tests for the app service container (ADR-008): every registration resolves against
 * an in-memory binding set, since each service stores its config at construction and defers
 * I/O. Only the bindings a registration reads are supplied, so a new dependency fails here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	createD1Database,
	createEnv,
	createKVNamespace,
	createSendEmail,
} from "@pkg/cloudflare-mocks";
import { describe, expect, test, vi } from "vitest";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		DB: createD1Database(),
		EMAIL: createSendEmail(),
		KV: createKVNamespace(),
		CLIENT_ID: "test-client-id",
		CLIENT_SECRET: "test-client-secret",
	}),
	waitUntil: (promise: Promise<unknown>) => promise,
}));

let { ManagementClient } = await import("@pkg/auth/management-client");
let { Mailer } = await import("@pkg/mail");
let { ServiceContainer } = await import("@pkg/service-container");
let { Database } = await import("remix/data-table");
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

	test("resolves a Mailer singleton for the send paths with no request behind them", () => {
		let mailer = container.get(Mailer);

		expect(mailer).toBeInstanceOf(Mailer);
		expect(container.get(Mailer)).toBe(mailer);
	});

	test("resolves a ManagementClient singleton without a real network call", () => {
		let admin = container.get(ManagementClient);

		expect(admin).toBeInstanceOf(ManagementClient);
		expect(container.get(ManagementClient)).toBe(admin);
	});
});
