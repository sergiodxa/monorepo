/**
 * `sdxc schedule`: every scheduled job `app/jobs/index.ts` declares, when it runs next, and the
 * Worker trigger that fires it. A cron job runs only when a trigger delivers its exact
 * expression, so a job no trigger fires, and a trigger no job takes, are both shown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Schedule } from "@sdxc/cron";
import { isFailure, wrap } from "@sdxc/result";

import type { Node, ObjectNode } from "./routes/parse.js";

import { Project } from "./routes/modules.js";

/** The module `sdxc make job` declares jobs in. */
const JOBS_MODULE = "app/jobs/index.ts";

/** The files a Worker's cron triggers are declared in, `cloudflare.config.ts` first. */
export const TRIGGER_FILES = ["cloudflare.config.ts", "wrangler.jsonc", "wrangler.json"];

/** One scheduled job. */
export interface ScheduledJob {
	/** Its key path in the declarations, `reports.daily`. */
	job: string;
	cron: string;
	/** The next run after now, in UTC; `null` when the expression does not parse. */
	next: string | null;
	/** The file whose trigger delivers this expression, or `null` when none does. */
	trigger: string | null;
}

/** What `sdxc schedule` reports. */
export interface ScheduleListing {
	jobs: ScheduledJob[];
	/** Each trigger expression no job declares, with the file it is in. */
	unused: Array<{ cron: string; file: string }>;
}

/** Every `job({ cron })` under `node`, a `jobs({ … })` object, with its key path. */
function cronJobs(
	node: ObjectNode,
	path: string[],
	job: string,
): Array<{ job: string; cron: string }> {
	let found: Array<{ job: string; cron: string }> = [];
	for (let entry of node.entries) {
		if ("spread" in entry) continue;
		let { value } = entry;
		if (value.kind === "object") found.push(...cronJobs(value, [...path, entry.key], job));
		if (value.kind !== "call" || value.callee.kind !== "identifier" || value.callee.name !== job) {
			continue;
		}
		let options = value.args[0]?.node;
		if (options?.kind !== "object") continue;
		let cron = options.entries.find(
			(option): option is { key: string; value: Node } =>
				!("spread" in option) && option.key === "cron",
		)?.value;
		if (cron?.kind === "string")
			found.push({ job: [...path, entry.key].join("."), cron: cron.value });
	}
	return found;
}

/** The scheduled jobs the project's job declarations hold, in source order. */
export async function declaredJobs(root: string): Promise<Array<{ job: string; cron: string }>> {
	let project = new Project(root);
	let module = await project.load(JOBS_MODULE);
	if (module === null) return [];
	let exported = await project.exported(module, "default");
	if (exported === null) return [];
	let node = exported.node;
	if (node.kind === "identifier") {
		let binding = await project.bind(exported.module, node.name);
		if (binding.kind !== "local") return [];
		node = binding.node;
	}
	if (node.kind !== "call") return [];
	let declarations = node.args[0]?.node;
	if (declarations?.kind !== "object") return [];
	let job =
		[...exported.module.imports].find(([, imported]) => imported.imported === "job")?.[0] ?? "job";
	return cronJobs(declarations, [], job);
}

/** Every cron expression a trigger file declares, by file. */
export async function triggerCrons(root: string): Promise<Array<{ cron: string; file: string }>> {
	let crons: Array<{ cron: string; file: string }> = [];
	for (let file of TRIGGER_FILES) {
		let text = await wrap(() => readFile(join(root, file), "utf8"));
		if (isFailure(text)) continue;
		let pattern = file.endsWith(".ts")
			? /triggers\.scheduled\(\s*\{\s*schedule:\s*["'`]([^"'`]+)["'`]/g
			: /"crons"\s*:\s*\[([^\]]*)\]/g;
		for (let match of text.data.matchAll(pattern)) {
			let found = file.endsWith(".ts")
				? [match[1] ?? ""]
				: [...(match[1] ?? "").matchAll(/"([^"]+)"/g)].map((entry) => entry[1] ?? "");
			for (let cron of found) crons.push({ cron, file });
		}
	}
	return crons;
}

/** `cron` as `@sdxc/cron` prints it, so `0 9 * * MON-FRI` and `0 9 * * 1-5` compare equal. */
export function normalized(cron: string): string {
	let parsed = Schedule.parse(cron);
	return isFailure(parsed) ? cron.trim() : parsed.data.toString();
}

/** Lists the project's scheduled jobs and triggers, the next runs counted from `now`. */
export async function listSchedule(root: string, now: Date = new Date()): Promise<ScheduleListing> {
	let triggers = await triggerCrons(root);
	let jobs = (await declaredJobs(root)).map(({ job, cron }) => {
		let parsed = Schedule.parse(cron);
		let next = isFailure(parsed)
			? null
			: parsed.data.next({ from: now, timeZone: "UTC" }).toISOString();
		let trigger =
			triggers.find((entry) => normalized(entry.cron) === normalized(cron))?.file ?? null;
		return { job, cron, next, trigger };
	});
	let taken = new Set(jobs.map((job) => normalized(job.cron)));
	return { jobs, unused: triggers.filter((entry) => !taken.has(normalized(entry.cron))) };
}

/** The listing as a table, then a line per trigger no job takes. */
export function formatSchedule(listing: ScheduleListing): string {
	if (listing.jobs.length === 0 && listing.unused.length === 0) {
		return `No scheduled jobs in ${JOBS_MODULE}; sdxc make job <name> --cron "<expression>" writes one.\n`;
	}
	let rows = listing.jobs.map((job) => [
		job.job,
		job.cron,
		job.next === null ? "invalid expression" : `${job.next.slice(0, 16).replace("T", " ")} UTC`,
		job.trigger ?? `none; add triggers.scheduled({ schedule: ${JSON.stringify(job.cron)} })`,
	]);
	let header = ["Job", "Schedule", "Next run", "Trigger"];
	let widths = header.map((title, column) =>
		Math.max(title.length, ...rows.map((row) => row[column]?.length ?? 0)),
	);
	let line = (row: readonly string[]) =>
		row
			.map((cell, column) => cell.padEnd(widths[column] ?? 0))
			.join("  ")
			.trimEnd();
	let lines = rows.length === 0 ? [] : [line(header), ...rows.map(line)];
	for (let entry of listing.unused) {
		lines.push(`${entry.file} fires ${JSON.stringify(entry.cron)}, which no job declares`);
	}
	return `${lines.join("\n")}\n`;
}
