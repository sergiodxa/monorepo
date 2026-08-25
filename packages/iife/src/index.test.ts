/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { iife } from "./index";

describe(iife.name, () => {
	test("returns the computed value", () => {
		let value = iife(() => {
			let base = 10;
			let tax = 2;

			return base + tax;
		});

		expect(value).toBe(12);
	});

	test("runs side effects before returning", () => {
		let calls: string[] = [];

		let value = iife(() => {
			calls.push("ran");
			return calls.length;
		});

		expect(calls).toEqual(["ran"]);
		expect(value).toBe(1);
	});

	test("passes through promise results for async callbacks", async () => {
		let value = await iife(async () => {
			return "ready";
		});

		expect(value).toBe("ready");
	});
});
