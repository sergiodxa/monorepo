/**
 * Tests the two things nothing else can catch: a job that exists in the map but was never
 * mapped to a handler still accepts enqueues and silently never runs, and a cron a job
 * declares fires nothing unless `wrangler.jsonc` names the same expression.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { AnyJobDefinition } from "@sdxc/jobs";

import { describe, expect, test } from "vitest";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";

/** True for a named job, false for a group holding more of them. */
function isDefinition(value: unknown): value is AnyJobDefinition {
	if (typeof value !== "object" || value === null) return false;
	return typeof (value as { name?: unknown }).name === "string";
}

/** Every job the map declares, however deeply it is grouped. */
function leaves(tree: object): AnyJobDefinition[] {
	return Object.values(tree).flatMap((value: unknown) => {
		if (isDefinition(value)) return [value];
		return typeof value === "object" && value !== null ? leaves(value) : [];
	});
}

/**
 * The crons `wrangler.jsonc` declares. Read as text because the file is JSONC: the
 * `crons` array is sliced out and its comments dropped before it can be parsed.
 */
function configuredCrons(): string[] {
	let path = fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url));
	let match = /"crons"\s*:\s*\[[^\]]*\]/.exec(readFileSync(path, "utf8"));

	if (match === null) throw new Error("wrangler.jsonc declares no crons");

	let array = match[0]
		.slice(match[0].indexOf("["))
		.replaceAll(/\/\/[^\n]*/g, "")
		.replace(/,\s*\]$/, "]");

	return JSON.parse(array) as string[];
}

describe("dispatcher", () => {
	test("declares the same schedules as the worker's triggers", () => {
		expect([...dispatcher.crons].sort()).toEqual([...configuredCrons()].sort());
	});

	test("maps every job the map declares", () => {
		let declared = leaves(jobs);
		let mapped = dispatcher.mapped.map((job) => job.name);

		/** Guards the assertion below against a walk that quietly found nothing. */
		expect(declared.length).toBeGreaterThan(0);
		expect([...mapped].sort()).toEqual(declared.map((job) => job.name).sort());
	});
});
