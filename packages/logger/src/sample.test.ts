/**
 * Tests for the tail sampler: the default keeps everything, failures are kept whatever the
 * rate, and `slowerThanMs` and `keep` each exempt a log from the rate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { shouldKeep } from "./sample.js";

const NO_FIELDS = {};

describe(shouldKeep, () => {
	test("keeps everything with no options and with the default rate", () => {
		expect(shouldKeep(undefined, "ok", NO_FIELDS, 1, () => 0.99)).toBe(true);
		expect(shouldKeep({}, "ok", NO_FIELDS, 1, () => 0.99)).toBe(true);
	});

	test("keeps a degraded or failed log whatever the rate", () => {
		expect(shouldKeep({ rate: 0 }, "degraded", NO_FIELDS, 1)).toBe(true);
		expect(shouldKeep({ rate: 0 }, "error", NO_FIELDS, 1)).toBe(true);
	});

	test("keeps an ok log by rate", () => {
		expect(shouldKeep({ rate: 0.05 }, "ok", NO_FIELDS, 1, () => 0.04)).toBe(true);
		expect(shouldKeep({ rate: 0.05 }, "ok", NO_FIELDS, 1, () => 0.05)).toBe(false);
	});

	test("keeps a slow ok log regardless of rate", () => {
		expect(shouldKeep({ rate: 0, slowerThanMs: 1000 }, "ok", NO_FIELDS, 1000)).toBe(true);
		expect(shouldKeep({ rate: 0, slowerThanMs: 1000 }, "ok", NO_FIELDS, 999)).toBe(false);
	});

	test("keeps an ok log the keep predicate claims, which is how a kind is exempted", () => {
		let keep = (fields: Readonly<Record<string, unknown>>) => fields.kind !== "job";
		expect(shouldKeep({ rate: 0, keep }, "ok", { kind: "request" }, 1)).toBe(true);
		expect(shouldKeep({ rate: 0, keep }, "ok", { kind: "job" }, 1)).toBe(false);
	});
});
