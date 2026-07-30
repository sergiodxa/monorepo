/**
 * Tests the reference counting behavior: budget spent until the limit, denial once
 * it is gone, a full budget after the window rolls over, and keys that never share
 * a counter. The clock is pinned so the window boundary is exact, not timing-based.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, setSystemTime, test } from "bun:test";

import { isSuccess, unwrap } from "@pkg/result";

import { MemoryAdapter } from "./memory";

/** An instant aligned to a 10 second window, so a case starts at a boundary. */
const WINDOW_START = 1_700_000_000_000;

afterEach(() => {
	setSystemTime();
});

describe("MemoryAdapter", () => {
	test("allows up to the limit and denies the next attempt", async () => {
		setSystemTime(new Date(WINDOW_START));
		let adapter = new MemoryAdapter({ limit: 2, window: "10 seconds" });

		expect(unwrap(await adapter.consume("ip")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("ip")).allowed).toBe(true);

		let denied = unwrap(await adapter.consume("ip"));
		expect(denied.allowed).toBe(false);
		expect(denied.remaining).toBe(0);
		expect(denied.limit).toBe(2);
	});

	test("reports the budget left and the window's reset", async () => {
		setSystemTime(new Date(WINDOW_START + 3000));
		let adapter = new MemoryAdapter({ limit: 10, window: "10 seconds" });

		let decision = unwrap(await adapter.consume("ip"));

		expect(decision.remaining).toBe(9);
		expect(decision.reset.getTime()).toBe(WINDOW_START + 10_000);
		expect(decision.retryAfter).toBe(7);
	});

	test("starts a fresh budget once the window rolls over", async () => {
		setSystemTime(new Date(WINDOW_START));
		let adapter = new MemoryAdapter({ limit: 1, window: "10 seconds" });

		expect(unwrap(await adapter.consume("ip")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("ip")).allowed).toBe(false);

		setSystemTime(new Date(WINDOW_START + 10_000));
		let rolled = unwrap(await adapter.consume("ip"));

		expect(rolled.allowed).toBe(true);
		expect(rolled.remaining).toBe(0);
		expect(rolled.reset.getTime()).toBe(WINDOW_START + 20_000);
	});

	test("does not spend budget on a denied attempt", async () => {
		setSystemTime(new Date(WINDOW_START));
		let adapter = new MemoryAdapter({ limit: 1, window: "10 seconds" });

		await adapter.consume("ip");
		await adapter.consume("ip");
		await adapter.consume("ip");

		expect(unwrap(await adapter.consume("ip")).remaining).toBe(0);
	});

	test("counts each key against its own budget", async () => {
		setSystemTime(new Date(WINDOW_START));
		let adapter = new MemoryAdapter({ limit: 1, window: "10 seconds" });

		expect(unwrap(await adapter.consume("first")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("second")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("first")).allowed).toBe(false);
	});

	test("spends the requested cost in one attempt", async () => {
		setSystemTime(new Date(WINDOW_START));
		let adapter = new MemoryAdapter({ limit: 10, window: "10 seconds" });

		expect(unwrap(await adapter.consume("ip", 4)).remaining).toBe(6);
		expect(unwrap(await adapter.consume("ip", 6)).remaining).toBe(0);
		expect(unwrap(await adapter.consume("ip", 1)).allowed).toBe(false);
	});

	test("denies a cost that cannot fit in an empty budget", async () => {
		setSystemTime(new Date(WINDOW_START));
		let adapter = new MemoryAdapter({ limit: 3, window: "10 seconds" });

		let decision = unwrap(await adapter.consume("ip", 4));

		expect(decision.allowed).toBe(false);
		expect(decision.remaining).toBe(3);
	});

	test("reset clears one key's counter and leaves the others", async () => {
		setSystemTime(new Date(WINDOW_START));
		let adapter = new MemoryAdapter({ limit: 1, window: "10 seconds" });

		await adapter.consume("first");
		await adapter.consume("second");

		expect(isSuccess(await adapter.reset("first"))).toBe(true);
		expect(unwrap(await adapter.consume("first")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("second")).allowed).toBe(false);
	});

	test("clear empties every counter", async () => {
		setSystemTime(new Date(WINDOW_START));
		let adapter = new MemoryAdapter({ limit: 1, window: "10 seconds" });

		await adapter.consume("first");
		await adapter.consume("second");
		adapter.clear();

		expect(unwrap(await adapter.consume("first")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("second")).allowed).toBe(true);
	});

	test("exposes the policy it was configured with", () => {
		let adapter = new MemoryAdapter({ limit: 25, window: "1 minute" });

		expect(adapter.limit).toBe(25);
		expect(adapter.window).toBe("1 minute");
	});
});
