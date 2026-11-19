/**
 * Holds the reveal model to its contract without a DOM: a line waits, types once started,
 * completes on request, and reports itself revealed once, announcing each step with `change`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import { RevealModel } from "./reveal.js";

describe(RevealModel, () => {
	test("moves a line from waiting to typing to revealed", () => {
		let reveal = new RevealModel(40);
		let changed = vi.fn();
		reveal.addEventListener("change", changed);
		reveal.begin("line-1");
		expect(reveal.line).toBe("line-1");
		expect(reveal.status).toBe("waiting");
		reveal.reveal();
		expect(reveal.status).toBe("waiting");
		reveal.start();
		expect(reveal.status).toBe("typing");
		reveal.reveal();
		expect(reveal.status).toBe("revealed");
		expect(reveal.complete).toBe(true);
		expect(changed).toHaveBeenCalledTimes(3);
	});

	test("asks for the rest of a line once, and only while there is one", () => {
		let reveal = new RevealModel();
		reveal.finish();
		expect(reveal.complete).toBe(false);
		reveal.begin("line-1");
		reveal.start();
		reveal.finish();
		reveal.finish();
		expect(reveal.complete).toBe(true);
		expect(reveal.status).toBe("typing");
	});

	test("starts a restored or skipped line complete, and clears between lines", () => {
		let reveal = new RevealModel();
		reveal.begin("line-1", true);
		expect(reveal.complete).toBe(true);
		reveal.clear();
		expect(reveal.line).toBeUndefined();
		expect(reveal.status).toBe("idle");
	});

	test("announces a new speed", () => {
		let reveal = new RevealModel(40);
		let changed = vi.fn();
		reveal.addEventListener("change", changed);
		reveal.speed = 40;
		reveal.speed = 0;
		expect(reveal.speed).toBe(0);
		expect(changed).toHaveBeenCalledOnce();
	});
});
