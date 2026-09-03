/**
 * Tests the failure type's two guarantees: that a retry decision is derived
 * from the normalized code when a provider states none, and that an unknown
 * outcome is never advertised as safe to repeat.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { BillingError } from "./errors.js";

describe("BillingError", () => {
	test("keeps the platform's own code and the connection it failed against", () => {
		let error = new BillingError("no such customer", {
			code: "not_found",
			connection: "polar_main",
			providerCode: "ResourceNotFound",
		});

		expect(error.name).toBe("BillingError");
		expect(error.message).toBe("no such customer");
		expect(error.code).toBe("not_found");
		expect(error.connection).toBe("polar_main");
		expect(error.providerCode).toBe("ResourceNotFound");
	});

	test("reports no platform code when the response carried none", () => {
		let error = new BillingError("boom", { code: "invalid_response", connection: "memory" });

		expect(error.providerCode).toBeNull();
	});

	test("derives the retry decision from the code", () => {
		let transient = new BillingError("slow down", { code: "rate_limited", connection: "memory" });
		let permanent = new BillingError("nope", { code: "forbidden", connection: "memory" });

		expect(transient.retryable).toBe(true);
		expect(permanent.retryable).toBe(false);
	});

	test("lets a provider override a retry decision the code got wrong", () => {
		let error = new BillingError("conflicting write", {
			code: "conflict",
			connection: "memory",
			retryable: true,
		});

		expect(error.retryable).toBe(true);
	});

	test("refuses to call an unknown outcome retryable, however it is constructed", () => {
		let asked = new BillingError("timed out", {
			code: "unknown",
			connection: "memory",
			retryable: true,
		});

		let plain = new BillingError("timed out", { code: "unknown", connection: "memory" });

		expect(asked.retryable).toBe(false);
		expect(plain.retryable).toBe(false);
	});

	test("carries the wait a rate limit asked for, and nothing when none was named", () => {
		let stated = new BillingError("slow down", {
			code: "rate_limited",
			connection: "memory",
			retryAfter: 30,
		});

		let silent = new BillingError("slow down", { code: "rate_limited", connection: "memory" });

		expect(stated.retryAfter).toBe(30);
		expect(silent.retryAfter).toBeNull();
	});

	test("keeps the original error reachable as the cause", () => {
		let cause = new Error("socket hang up");
		let error = new BillingError("call failed", {
			code: "unknown",
			connection: "memory",
			cause,
		});

		expect(error.cause).toBe(cause);
	});
});
