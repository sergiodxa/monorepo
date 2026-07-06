/**
 * Behavioural tests for the platform-tenant bootstrap guard: it provisions the dogfooded
 * platform tenant (`/api/setup`) exactly once per isolate, passes the platform domain as
 * the issuer, does not cache a failed attempt (so the next request retries), and can be
 * reset between tests. The setup callback is injected, so no Durable Object is exercised.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { ensurePlatformProvisioned, resetPlatformBootstrap } from "./platform-bootstrap";

beforeEach(() => resetPlatformBootstrap());

describe("ensurePlatformProvisioned", () => {
	test("provisions the platform tenant with the platform domain as issuer", async () => {
		let issuers: string[] = [];
		await ensurePlatformProvisioned(async (issuer) => {
			issuers.push(issuer);
		}, "auth.example.test");

		expect(issuers).toEqual(["auth.example.test"]);
	});

	test("runs setup only once across repeated calls in the same isolate", async () => {
		let calls = 0;
		let setup = async () => {
			calls++;
		};

		await ensurePlatformProvisioned(setup, "auth.example.test");
		await ensurePlatformProvisioned(setup, "auth.example.test");
		await ensurePlatformProvisioned(setup, "auth.example.test");

		expect(calls).toBe(1);
	});

	test("shares one in-flight provisioning promise for concurrent callers", async () => {
		let calls = 0;
		let setup = async () => {
			calls++;
			await new Promise((resolve) => setTimeout(resolve, 5));
		};

		await Promise.all([
			ensurePlatformProvisioned(setup, "auth.example.test"),
			ensurePlatformProvisioned(setup, "auth.example.test"),
			ensurePlatformProvisioned(setup, "auth.example.test"),
		]);

		expect(calls).toBe(1);
	});

	test("does not cache a failed attempt; a later call retries", async () => {
		let calls = 0;
		let failingThenOk = async () => {
			calls++;
			if (calls === 1) throw new Error("DO unavailable");
		};

		await expect(ensurePlatformProvisioned(failingThenOk, "auth.example.test")).rejects.toThrow(
			"DO unavailable",
		);

		// The failed attempt must not be memoized: the next call re-runs setup.
		await ensurePlatformProvisioned(failingThenOk, "auth.example.test");
		expect(calls).toBe(2);
	});

	test("resetPlatformBootstrap clears the memo so setup runs again", async () => {
		let calls = 0;
		let setup = async () => {
			calls++;
		};

		await ensurePlatformProvisioned(setup, "auth.example.test");
		resetPlatformBootstrap();
		await ensurePlatformProvisioned(setup, "auth.example.test");

		expect(calls).toBe(2);
	});
});
