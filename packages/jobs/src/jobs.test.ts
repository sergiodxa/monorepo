/**
 * Exercises the job map: the names it stamps from its keys, the declarations it carries
 * onto each definition, and the schedules it refuses to accept.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { InvalidCronExpression } from "@sdxc/cron";
import { describe, expect, expectTypeOf, test } from "vitest";

import { job, jobs } from "./index.js";

describe("jobs()", () => {
	test("names every leaf after the key it is filed under", () => {
		let map = jobs({ clean: job({ cron: "0 0 * * *" }), checkHttp: job() });

		expect(map.clean.name).toBe("clean");
		expect(map.checkHttp.name).toBe("checkHttp");
	});

	test("names a nested leaf after its dot-joined path", () => {
		let map = jobs({
			digests: { daily: job({ cron: "0 8 * * *" }), weekly: job({ cron: "0 9 * * 1" }) },
		});

		expect(map.digests.daily.name).toBe("digests.daily");
		expect(map.digests.weekly.name).toBe("digests.weekly");
	});

	test("carries the schedule and the meta onto the definition", () => {
		let map = jobs({ clean: job({ cron: "0 0 * * *", meta: { monitorId: "abc" } }) });

		expect(map.clean.cron).toBe("0 0 * * *");
		expect(map.clean.meta.monitorId).toBe("abc");
	});

	test("infers a declared meta as written, so a read off the map stays narrow", () => {
		let map = jobs({ clean: job({ meta: { monitorId: "abc", attempts: 3 } }) });

		expectTypeOf(map.clean.meta).toEqualTypeOf<{
			readonly monitorId: "abc";
			readonly attempts: 3;
		}>();
	});

	test("leaves meta undefined for a job that declares none", () => {
		let map = jobs({ clean: job({ cron: "0 0 * * *" }) });

		expect(map.clean.meta).toBeUndefined();
	});
});

describe("job()", () => {
	test("declares a schedule the platform would accept", () => {
		expect(() => job({ cron: "*/15 * * * *" })).not.toThrow();
	});

	test("refuses a field the platform would reject, naming where it is", () => {
		expect(() => job({ cron: "0 99 * * *" })).toThrow(InvalidCronExpression);
		expect(() => job({ cron: "0 99 * * *" })).toThrow(/hour/);
	});

	test("refuses an expression that is not five fields", () => {
		// @ts-expect-error -- too few fields is a type error before it is a thrown one
		expect(() => job({ cron: "invalid" })).toThrow(InvalidCronExpression);
	});
});
