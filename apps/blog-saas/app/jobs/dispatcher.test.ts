/**
 * Tests that the dispatcher and the deployed configuration agree: every declared job has
 * a handler mapped onto it, and every schedule the map declares is a trigger the worker
 * actually receives. A job that fails either check is silence at 01:00, which no runtime
 * error reports.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyJobDefinition } from "@sdxc/jobs";

import { createEnv } from "@sdxc/cloudflare-mocks";
import { describe, expect, test, vi } from "vitest";

import config from "../../cloudflare.config";

/**
 * Installed above the dynamic imports below, since the dispatcher's middleware read
 * `env` when the module they live in is loaded. No binding is touched by either check.
 */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({}),
	DurableObject: class {},
}));

let jobs = (await import("~/app/jobs")).default;
let { dispatcher } = await import("./dispatcher");

/** True for a named job, false for a group holding more of them. */
function isJob(value: unknown): value is AnyJobDefinition {
	if (typeof value !== "object" || value === null) return false;
	return "name" in value && typeof value.name === "string";
}

/**
 * Every job the map declares, however deeply it is grouped.
 *
 * @param node The map, or one group inside it.
 * @returns The definitions found under it.
 */
function declaredJobs(node: object): AnyJobDefinition[] {
	return Object.values(node).flatMap((value: unknown) =>
		isJob(value) ? [value] : declaredJobs(value as object),
	);
}

/**
 * The schedules the deployed worker is actually triggered on, taken from the scheduled
 * triggers of `cloudflare.config.ts`, so the assertion reads the same config the deploy does.
 *
 * @returns The configured cron expressions.
 */
function configuredCrons(): string[] {
	return config.worker.triggers.flatMap((trigger) =>
		trigger.type === "scheduled" ? [trigger.schedule] : [],
	);
}

describe("the job dispatcher", () => {
	test("maps a handler onto every declared job", () => {
		let declared = declaredJobs(jobs).map((job) => job.name);
		let mapped = dispatcher.mapped.map((job) => job.name);

		expect([...declared].sort()).toEqual([...mapped].sort());
	});

	test("declares the same schedules the worker is triggered on", () => {
		expect([...dispatcher.crons].sort()).toEqual([...configuredCrons()].sort());
	});
});
