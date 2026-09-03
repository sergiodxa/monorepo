/**
 * The two things about the dispatcher that no other test can catch, because both failures
 * are silent: a declared job nothing maps a handler for is a message class that reaches
 * the dead-letter queue, and a schedule `wrangler.jsonc` does not trigger is a job that
 * simply never runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";

/**
 * The `crons` array out of `wrangler.jsonc`. It is JSONC, so the array is pulled out as
 * text, its line comments dropped, and its trailing comma removed before parsing.
 *
 * @returns Every cron expression the deployed Worker is triggered on.
 */
function configuredCrons(): string[] {
	let source = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
	let [entry] = /"crons"\s*:\s*\[[\s\S]*?]/.exec(source) ?? [];

	if (entry === undefined) throw new Error("wrangler.jsonc declares no crons");

	let json = entry.replaceAll(/\/\/[^\n]*/g, "").replace(/,(\s*])/, "$1");

	return (JSON.parse(`{${json}}`) as { crons: string[] }).crons;
}

describe("dispatcher", () => {
	test("maps a handler for every job the map declares", () => {
		let declared = Object.values(jobs).map((job) => job.name);
		let mapped = dispatcher.mapped.map((job) => job.name);

		expect([...mapped].sort()).toEqual([...declared].sort());
	});

	test("declares exactly the schedules wrangler.jsonc triggers", () => {
		expect([...dispatcher.crons].sort()).toEqual([...configuredCrons()].sort());
	});
});
