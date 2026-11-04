/**
 * Tests for memory size parsing and the memory pool's acquire/release ordering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { MemoryPool, parseMemorySize } from "./memory.js";

describe("parseMemorySize", () => {
	test("parses GB, MB, KB and bare bytes", () => {
		expect(parseMemorySize("2GB")).toMatchObject({ status: "success", data: 2 * 1024 ** 3 });
		expect(parseMemorySize("512MB")).toMatchObject({ status: "success", data: 512 * 1024 ** 2 });
		expect(parseMemorySize("1.5GiB")).toMatchObject({
			status: "success",
			data: Math.floor(1.5 * 1024 ** 3),
		});
		expect(parseMemorySize("1024")).toMatchObject({ status: "success", data: 1024 });
	});

	test("rejects a size it cannot read", () => {
		let parsed = parseMemorySize("plenty");
		expect(isFailure(parsed)).toBe(true);
	});
});

describe("MemoryPool", () => {
	test("a reservation above the limit runs alone", async () => {
		let pool = new MemoryPool(100);
		let order: string[] = [];
		let first = pool.acquire(150).then(async (release) => {
			order.push("heavy");
			await Promise.resolve();
			release();
		});
		let second = pool.acquire(50).then((release) => {
			order.push("light");
			release();
		});
		await Promise.all([first, second]);
		expect(order).toEqual(["heavy", "light"]);
	});

	test("zero bytes take nothing", async () => {
		let pool = new MemoryPool(10);
		let release = await pool.acquire(0);
		let other = await pool.acquire(10);
		release();
		other();
		expect(isSuccess(parseMemorySize("1B"))).toBe(true);
	});
});
