/**
 * Exercises the job map: the names it stamps from its keys, the bodies its
 * definitions enqueue, and the single write a batch turns into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@pkg/types";

import * as s from "remix/data-schema";
import { describe, expect, test, vi } from "vitest";

import { job, jobs } from "./index";

function sender() {
	return vi.fn(async (_bodies: JSONValue[]) => {});
}

describe("jobs()", () => {
	test("names every leaf after the key it is filed under", () => {
		let map = jobs({ clean: job({ cron: "0 0 * * *" }), checkHttp: job() }, { send: sender() });

		expect(map.clean.name).toBe("clean");
		expect(map.checkHttp.name).toBe("checkHttp");
	});

	test("names a nested leaf after its dot-joined path", () => {
		let map = jobs(
			{ digests: { daily: job({ cron: "0 8 * * *" }), weekly: job({ cron: "0 9 * * 1" }) } },
			{ send: sender() },
		);

		expect(map.digests.daily.name).toBe("digests.daily");
		expect(map.digests.weekly.name).toBe("digests.weekly");
	});

	test("carries the schedule and the monitor onto the definition", () => {
		let map = jobs({ clean: job({ cron: "0 0 * * *", monitorId: "abc" }) }, { send: sender() });

		expect(map.clean.cron).toBe("0 0 * * *");
		expect(map.clean.monitorId).toBe("abc");
	});
});

describe("enqueue()", () => {
	test("writes the payload's fields alongside the job's name", async () => {
		let send = sender();
		let map = jobs({ checkHttp: job({ input: s.object({ monitorId: s.string() }) }) }, { send });

		await map.checkHttp.enqueue({ monitorId: "m1" });

		expect(send).toHaveBeenCalledWith([{ type: "checkHttp", monitorId: "m1" }]);
	});

	test("writes only the name for a job that declares no payload", async () => {
		let send = sender();
		let map = jobs({ clean: job({ cron: "0 0 * * *" }) }, { send });

		await map.clean.enqueue();

		expect(send).toHaveBeenCalledWith([{ type: "clean" }]);
	});

	test("keeps a payload from misrouting itself with a type of its own", async () => {
		let send = sender();
		let map = jobs({ clean: job({ input: s.object({ type: s.string() }) }) }, { send });

		await map.clean.enqueue({ type: "somethingElse" });

		expect(send).toHaveBeenCalledWith([{ type: "clean" }]);
	});
});

describe("enqueueMany()", () => {
	test("turns many payloads into one write", async () => {
		let send = sender();
		let map = jobs({ notify: job({ input: s.object({ id: s.string() }) }) }, { send });

		await map.notify.enqueueMany([{ id: "a" }, { id: "b" }]);

		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith([
			{ type: "notify", id: "a" },
			{ type: "notify", id: "b" },
		]);
	});

	test("writes nothing when there is nothing to enqueue", async () => {
		let send = sender();
		let map = jobs({ notify: job({ input: s.object({ id: s.string() }) }) }, { send });

		await map.notify.enqueueMany([]);

		expect(send).not.toHaveBeenCalled();
	});
});
