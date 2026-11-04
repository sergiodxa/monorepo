/**
 * HTTP sampling helpers: percentiles and budget checks against a local server.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createServer } from "node:http";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { assertHttpBudgets, percentile, sampleHttp } from "./http.js";

describe("percentile", () => {
	test("returns null for an empty list", () => {
		expect(percentile([], 50)).toBeNull();
	});

	test("interpolates between ranks", () => {
		expect(percentile([10, 20, 30, 40], 50)).toBe(25);
		expect(percentile([10], 99)).toBe(10);
	});
});

describe("sampleHttp", () => {
	let base = "";
	let server: ReturnType<typeof createServer>;

	beforeAll(async () => {
		server = createServer((_req, res) => {
			res.writeHead(200, { "content-type": "text/plain" });
			res.end("ok");
		});
		await new Promise<void>((resolve) => {
			server.listen(0, "127.0.0.1", () => resolve());
		});
		let address = server.address();
		if (address === null || typeof address === "string") throw new Error("no port");
		base = `http://127.0.0.1:${address.port}/`;
	});

	afterAll(async () => {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	});

	test("collects successful samples against a local server", async () => {
		let report = await sampleHttp({
			url: base,
			requests: 8,
			concurrency: 4,
			timeoutMs: 2_000,
		});
		expect(report.ok).toBe(8);
		expect(report.failures).toBe(0);
		expect(report.p50).not.toBeNull();
		expect(isSuccess(assertHttpBudgets(report, { p99: 5_000 }))).toBe(true);
	});

	test("fails a budget that the samples miss", async () => {
		let report = await sampleHttp({
			url: base,
			requests: 4,
			concurrency: 2,
			timeoutMs: 2_000,
		});
		let checked = assertHttpBudgets(report, { p50: 0 });
		expect(isFailure(checked)).toBe(true);
		if (isFailure(checked)) expect(checked.error.field).toBe("p50");
		else expect.unreachable();
		expect(unwrap(assertHttpBudgets(report, { mean: 60_000 })).ok).toBe(4);
	});
});
