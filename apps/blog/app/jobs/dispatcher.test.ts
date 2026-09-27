/**
 * Tests that the dispatcher and the deployed configuration agree: every declared job
 * has a handler mapped onto it, and every schedule the map declares is a trigger the
 * worker receives. A job failing either check never runs, and nothing reports it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { AnyJobDefinition } from "@sdxc/jobs";

import { describe, expect, test } from "vitest";

import jobs from "~/app/jobs";

import { dispatcher } from "./dispatcher";

/** True for a named job, false for a group holding more of them. */
function isJob(value: unknown): value is AnyJobDefinition {
	if (typeof value !== "object" || value === null) return false;
	return "name" in value && typeof value.name === "string";
}

/**
 * Every job the map declares, however deeply it is grouped.
 *
 * @param node The map, or one group inside it.
 */
function declaredJobs(node: object): AnyJobDefinition[] {
	return Object.values(node).flatMap((value: unknown) => {
		if (isJob(value)) return [value];
		if (typeof value === "object" && value !== null) return declaredJobs(value);
		return [];
	});
}

/**
 * The schedules the deployed worker is triggered on, sliced out of the same JSONC file
 * the deploy reads; a config declaring no `crons` has none.
 */
function configuredCrons(): string[] {
	let path = fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url));
	let match = /"crons"\s*:\s*\[([^\]]*)\]/.exec(readFileSync(path, "utf8"));
	if (match?.[1] === undefined) return [];

	let entries = match[1].replaceAll(/\/\/[^\n]*/g, "").replace(/,\s*$/, "");
	return JSON.parse(`[${entries}]`) as string[];
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
