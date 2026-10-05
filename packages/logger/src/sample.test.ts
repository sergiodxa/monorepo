/**
 * Tests for the tail sampler: the default keeps everything, failures are kept whatever the
 * rate, and `slowerThanMs` and `keep` each exempt a log from the rate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRandom } from "@sdxc/random";
import { describe, expect, test } from "vitest";

import type { Sample } from "./sample.js";

import { exemption, shouldKeep } from "./sample.js";

const NO_FIELDS = {};

describe(shouldKeep, () => {
	test("keeps everything with no options and with the default rate", () => {
		let random = createRandom("logger-default");
		for (let index = 0; index < 100; index++) {
			expect(shouldKeep(undefined, "ok", NO_FIELDS, 1, random)).toBe(true);
			expect(shouldKeep({}, "ok", NO_FIELDS, 1, random)).toBe(true);
		}
	});

	test("keeps a degraded or failed log whatever the rate", () => {
		expect(shouldKeep({ rate: 0 }, "degraded", NO_FIELDS, 1)).toBe(true);
		expect(shouldKeep({ rate: 0 }, "error", NO_FIELDS, 1)).toBe(true);
	});

	test("keeps roughly the sampled fraction of ok logs", () => {
		let random = createRandom("logger-rate");
		let kept = 0;
		for (let index = 0; index < 10_000; index++) {
			if (shouldKeep({ rate: 0.1 }, "ok", NO_FIELDS, 5, random)) kept++;
		}

		expect(kept).toBeGreaterThan(900);
		expect(kept).toBeLessThan(1100);
	});

	test("drops every ok log at a rate of zero and keeps every one at a rate of one", () => {
		let random = createRandom("logger-bounds");
		for (let index = 0; index < 100; index++) {
			expect(shouldKeep({ rate: 0 }, "ok", NO_FIELDS, 1, random)).toBe(false);
			expect(shouldKeep({ rate: 1 }, "ok", NO_FIELDS, 1, random)).toBe(true);
		}
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

	test("keeps an ok log a keep condition holds for, written as data", () => {
		let keep: Sample.Condition = {
			op: "any",
			of: [
				{ op: "eq", field: "kind", value: "job" },
				{ op: "gte", field: "status", value: 500 },
			],
		};

		expect(shouldKeep({ rate: 0, keep }, "ok", { kind: "job" }, 1)).toBe(true);
		expect(shouldKeep({ rate: 0, keep }, "ok", { kind: "request", status: 503 }, 1)).toBe(true);
		expect(shouldKeep({ rate: 0, keep }, "ok", { kind: "request", status: 200 }, 1)).toBe(false);
		expect(shouldKeep({ rate: 0, keep }, "ok", { kind: "request" }, 1)).toBe(false);
	});

	test("reads a flattened field through its dotted path", () => {
		let keep: Sample.Condition = { op: "eq", field: "tenant.id", value: "acme" };

		expect(shouldKeep({ rate: 0, keep }, "ok", { "tenant.id": "acme" }, 1)).toBe(true);
		expect(shouldKeep({ rate: 0, keep }, "ok", { "tenant.id": "other" }, 1)).toBe(false);
		expect(shouldKeep({ rate: 0, keep }, "ok", { tenant: "acme", "tenant.id": "acme" }, 1)).toBe(
			false,
		);
	});

	test("keeps every log when a keep condition does not compile", () => {
		let keep: Sample.Condition = { op: "matches", field: "path", pattern: "(" };

		expect(shouldKeep({ rate: 0, keep }, "ok", { path: "/" }, 1)).toBe(true);
	});

	test("compiles a keep condition once however many logs read it", () => {
		let keep: Sample.Condition = { op: "eq", field: "kind", value: "job" };

		expect(exemption(keep)).toBe(exemption(keep));
	});
});
