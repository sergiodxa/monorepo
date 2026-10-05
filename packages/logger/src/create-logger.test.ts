/**
 * Tests for the configured logger: every log it opens carries the worker's service,
 * environment, version, sampler, and sink.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { createLogger } from "./create-logger.js";

describe(createLogger, () => {
	test("opens logs carrying the configuration", async () => {
		let records: Record<string, unknown>[] = [];
		let logger = createLogger({
			service: "uptime",
			environment: "test",
			version: "abc",
			sink: (record) => void records.push(record),
		});

		await logger.open("cron", { cron: { expression: "* * * * *" } }).run(() => {});

		expect(records[0]).toMatchObject({
			service: "uptime",
			environment: "test",
			version: "abc",
			kind: "cron",
			"cron.expression": "* * * * *",
			outcome: "ok",
		});
	});

	test("applies the sampler to every log it opens", () => {
		let records: Record<string, unknown>[] = [];
		let logger = createLogger({
			service: "uptime",
			sample: { rate: 0 },
			sink: (record) => void records.push(record),
		});

		logger.open("request").emit();
		logger.open("request").fail(new Error("x")).emit();

		expect(records).toHaveLength(1);
	});

	test("exempts the logs a keep condition holds for", () => {
		let records: Record<string, unknown>[] = [];
		let logger = createLogger({
			service: "uptime",
			sample: { rate: 0, keep: { op: "eq", field: "kind", value: "job" } },
			sink: (record) => void records.push(record),
		});

		logger.open("request").emit();
		logger.open("job").emit();

		expect(records).toEqual([expect.objectContaining({ kind: "job" })]);
	});
});
