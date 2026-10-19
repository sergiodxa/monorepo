/**
 * How `sdxc schedule` reads scheduled jobs and Worker triggers and pairs them up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { formatSchedule, listSchedule } from "./schedule.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	await Promise.all(DIRECTORIES.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The instant every next run is counted from. */
const NOW = new Date("2026-10-19T12:30:00Z");

/** A project with `files`, relative to its root. */
async function project(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-schedule-"));
	DIRECTORIES.push(root);
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** Job declarations with a nested scheduled job, a top-level one and one with input. */
const JOBS = [
	'import { job, jobs } from "@sdxc/jobs";',
	'import * as s from "remix/data-schema";',
	"",
	"export default jobs({",
	'\treports: { daily: job({ cron: "0 8 * * *" }) },',
	'\tdigest: job({ cron: "0 9 * * MON-FRI" }),',
	"\tsend: job({ input: s.object({}) }),",
	"});",
	"",
].join("\n");

describe("listSchedule", () => {
	test("pairs each scheduled job with the trigger that fires its expression", async () => {
		let root = await project({
			"app/jobs/index.ts": JOBS,
			"cloudflare.config.ts": [
				"export default defineConfig({",
				'\ttriggers: [triggers.scheduled({ schedule: "0 9 * * 1-5" }), triggers.scheduled({ schedule: "0 5 * * 1" })],',
				"});",
				"",
			].join("\n"),
		});

		let listing = await listSchedule(root, NOW);

		expect(listing).toEqual({
			jobs: [
				{
					job: "reports.daily",
					cron: "0 8 * * *",
					next: "2026-10-20T08:00:00.000Z",
					trigger: null,
				},
				{
					job: "digest",
					cron: "0 9 * * MON-FRI",
					next: "2026-10-20T09:00:00.000Z",
					trigger: "cloudflare.config.ts",
				},
			],
			unused: [{ cron: "0 5 * * 1", file: "cloudflare.config.ts" }],
		});
		let printed = formatSchedule(listing);
		expect(printed).toContain('none; add triggers.scheduled({ schedule: "0 8 * * *" })');
		expect(printed).toContain('cloudflare.config.ts fires "0 5 * * 1", which no job declares');
	});

	test("reads the crons of a wrangler.jsonc", async () => {
		let root = await project({
			"app/jobs/index.ts": JOBS,
			"wrangler.jsonc": '{\n\t"triggers": { "crons": ["0 8 * * *"] }\n}\n',
		});

		let listing = await listSchedule(root, NOW);

		expect(listing.jobs[0]?.trigger).toBe("wrangler.jsonc");
	});

	test("says how to write a scheduled job when the project has none", async () => {
		let root = await project({});

		expect(formatSchedule(await listSchedule(root, NOW))).toContain(
			'sdxc make job <name> --cron "<expression>" writes one',
		);
	});
});
