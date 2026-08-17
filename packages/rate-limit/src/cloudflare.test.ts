/**
 * Tests the binding adapter against a double: the outcome comes from the binding,
 * the limit and reset come from the declared metadata, `remaining` stays null
 * because the platform never reports it, and a rejecting binding is a failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@pkg/result";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { RateLimiterBinding } from "./cloudflare";

import { CloudflareAdapter } from "./cloudflare";
import { RateLimitError } from "./rate-limit-error";

/** An instant aligned to a 10 second window, so a case starts at a boundary. */
const WINDOW_START = 1_700_000_000_000;

/** A binding double that counts calls and answers from a fixed script of outcomes. */
function createBinding(outcomes: boolean[]): RateLimiterBinding & { keys: string[] } {
	let keys: string[] = [];
	return {
		keys,
		async limit({ key }) {
			keys.push(key);
			return { success: outcomes[keys.length - 1] ?? true };
		},
	};
}

/** A binding double that always rejects, standing in for an unavailable platform. */
function createFailingBinding(): RateLimiterBinding {
	return {
		async limit() {
			throw new Error("binding unavailable");
		},
	};
}

afterEach(() => {
	vi.useRealTimers();
});

describe("CloudflareAdapter", () => {
	test("allows while the binding succeeds and denies when it refuses", async () => {
		let binding = createBinding([true, true, false]);
		let adapter = new CloudflareAdapter(binding, { limit: 2, window: "10 seconds" });

		expect(unwrap(await adapter.consume("client")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("client")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("client")).allowed).toBe(false);
		expect(binding.keys).toEqual(["client", "client", "client"]);
	});

	test("reports the declared limit and never a remaining count", async () => {
		vi.setSystemTime(new Date(WINDOW_START + 3000));
		let adapter = new CloudflareAdapter(createBinding([true]), { limit: 20, window: "10 seconds" });

		let decision = unwrap(await adapter.consume("client"));

		expect(decision.limit).toBe(20);
		expect(decision.remaining).toBeNull();
	});

	test("computes reset and retryAfter from the declared window", async () => {
		vi.setSystemTime(new Date(WINDOW_START + 4000));
		let adapter = new CloudflareAdapter(createBinding([false]), {
			limit: 20,
			window: "10 seconds",
		});

		let decision = unwrap(await adapter.consume("client"));

		expect(decision.reset.getTime()).toBe(WINDOW_START + 10_000);
		expect(decision.retryAfter).toBe(6);
	});

	test("issues one binding call per unit of cost", async () => {
		let binding = createBinding([true, true, true]);
		let adapter = new CloudflareAdapter(binding, { limit: 10, window: "10 seconds" });

		expect(unwrap(await adapter.consume("client", 3)).allowed).toBe(true);
		expect(binding.keys).toHaveLength(3);
	});

	test("stops calling the binding at the first refusal", async () => {
		let binding = createBinding([true, false, true]);
		let adapter = new CloudflareAdapter(binding, { limit: 10, window: "10 seconds" });

		expect(unwrap(await adapter.consume("client", 5)).allowed).toBe(false);
		expect(binding.keys).toHaveLength(2);
	});

	test("reports a failure when the binding rejects", async () => {
		let adapter = new CloudflareAdapter(createFailingBinding(), {
			limit: 10,
			window: "10 seconds",
		});

		let result = await adapter.consume("client");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(RateLimitError);
		expect(result.error.backend).toBe("cloudflare");
		expect(result.error.key).toBe("client");
		expect(result.error.cause).toBeInstanceOf(Error);
	});

	test("reports a failure for reset, which the binding cannot do", async () => {
		let adapter = new CloudflareAdapter(createBinding([]), { limit: 10, window: "10 seconds" });

		let result = await adapter.reset("client");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.backend).toBe("cloudflare");
		expect(result.error.message).toContain("cannot reset");
	});

	test("exposes the declared policy", () => {
		let adapter = new CloudflareAdapter(createBinding([]), { limit: 20, window: "1 minute" });

		expect(adapter.limit).toBe(20);
		expect(adapter.window).toBe("1 minute");
	});
});
