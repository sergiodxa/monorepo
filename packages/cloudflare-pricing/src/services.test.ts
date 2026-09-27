/**
 * Tests for the service modules: that every one names the Cloudflare docs page its prices
 * come from and the date they were checked, and that the prices consumers derive cents from
 * match known per-unit figures — storage per GB-day included, where a 100x slip is easiest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import * as AnalyticsEngine from "./analytics-engine.js";
import * as D1 from "./d1.js";
import * as DurableObjects from "./durable-objects.js";
import * as EmailService from "./email-service.js";
import * as KV from "./kv.js";
import { centsPerGbDay, centsPerUnit } from "./meter.js";
import * as Queues from "./queues.js";
import * as R2 from "./r2.js";
import * as Workers from "./workers.js";

/** Every service module, by the name its README row uses. */
const SERVICES = {
	AnalyticsEngine,
	D1,
	DurableObjects,
	EmailService,
	KV,
	Queues,
	R2,
	Workers,
};

describe.each(Object.entries(SERVICES))("%s", (_name, service) => {
	test("names its official Cloudflare pricing page", () => {
		expect(service.PRICING_DOCS_URL).toMatch(/^https:\/\/developers\.cloudflare\.com\/.+\/$/);
	});

	test("carries the ISO date its prices were last verified", () => {
		expect(service.PRICES_VERIFIED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(Number.isNaN(Date.parse(service.PRICES_VERIFIED_ON))).toBe(false);
	});
});

describe("derived cents per unit", () => {
	test("Workers", () => {
		expect(centsPerUnit(Workers.REQUESTS)).toBeCloseTo(3e-5, 15);
		expect(centsPerUnit(Workers.CPU_MS)).toBeCloseTo(2e-6, 15);
	});

	test("D1 prices reads and writes at different rates", () => {
		expect(centsPerUnit(D1.ROWS_READ)).toBeCloseTo(1e-7, 17);
		expect(centsPerUnit(D1.ROWS_WRITTEN)).toBeCloseTo(1e-4, 15);
	});

	test("D1 storage is 2.5 cents per GB-day", () => {
		expect(centsPerGbDay(D1.STORAGE)).toBeCloseTo(2.5, 10);
	});

	test("KV", () => {
		expect(centsPerUnit(KV.READS)).toBeCloseTo(5e-5, 15);
		expect(centsPerUnit(KV.WRITES)).toBeCloseTo(5e-4, 15);
		expect(centsPerUnit(KV.DELETES)).toBeCloseTo(5e-4, 15);
		expect(centsPerUnit(KV.LISTS)).toBeCloseTo(5e-4, 15);
	});

	test("KV storage is 1.667 cents per GB-day", () => {
		expect(centsPerGbDay(KV.STORAGE)).toBeCloseTo(1.667, 3);
	});

	test("Durable Objects", () => {
		expect(centsPerUnit(DurableObjects.REQUESTS)).toBeCloseTo(1.5e-5, 15);
		expect(centsPerUnit(DurableObjects.SQLITE_ROWS_READ)).toBeCloseTo(1e-7, 17);
		expect(centsPerUnit(DurableObjects.SQLITE_ROWS_WRITTEN)).toBeCloseTo(1e-4, 15);
		expect(centsPerGbDay(DurableObjects.SQLITE_STORAGE)).toBeCloseTo(0.667, 3);
	});

	test("Durable Object duration bills 128 MB as 0.128 GB", () => {
		expect(centsPerUnit(DurableObjects.DURATION)).toBeCloseTo(1.25e-3, 15);
		expect(DurableObjects.centsPerActiveMs()).toBeCloseTo(1.6e-7, 17);
	});

	test("Queues", () => {
		expect(centsPerUnit(Queues.OPERATIONS)).toBeCloseTo(4e-5, 15);
	});

	test("Analytics Engine", () => {
		expect(centsPerUnit(AnalyticsEngine.DATA_POINTS_WRITTEN)).toBeCloseTo(2.5e-5, 15);
		expect(centsPerUnit(AnalyticsEngine.READ_QUERIES)).toBeCloseTo(1e-4, 15);
	});

	test("Email Service", () => {
		expect(centsPerUnit(EmailService.EMAILS_SENT)).toBeCloseTo(3.5e-2, 15);
	});

	test("R2", () => {
		expect(centsPerUnit(R2.CLASS_A_OPERATIONS)).toBeCloseTo(4.5e-4, 15);
		expect(centsPerUnit(R2.CLASS_B_OPERATIONS)).toBeCloseTo(3.6e-5, 15);
		expect(centsPerGbDay(R2.STORAGE)).toBeCloseTo(0.05, 10);
	});
});
