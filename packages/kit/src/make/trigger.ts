/**
 * The Worker trigger behind a scheduled job: a cron job runs only when a trigger delivers its
 * exact expression, so `make job --cron` adds `triggers.scheduled(…)` to `cloudflare.config.ts`
 * and `destroy job` takes it out once no other job runs on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Token } from "@sdxc/codemod";

import { addElement, tokenize } from "@sdxc/codemod";
import { isFailure, wrap } from "@sdxc/result";

import { normalized, TRIGGER_FILES, triggerCrons } from "../schedule.js";

import type { FileEdit } from "./declare.js";

import { literal } from "./generate.js";
import { ensureImport } from "./imports.js";

/** The file `make` adds triggers to; the others in `TRIGGER_FILES` are edited by hand. */
const CONFIG = "cloudflare.config.ts";

/** What scheduling `cron` takes: the edit to `cloudflare.config.ts`, or a note to print. */
export interface TriggerPlan {
	edit: FileEdit | null;
	note: string | null;
}

/** The first of `TRIGGER_FILES` in the project, or `null` when it has none. */
async function triggerFile(root: string): Promise<{ path: string; source: string } | null> {
	for (let path of TRIGGER_FILES) {
		let read = await wrap(() => readFile(join(root, path), "utf8"));
		if (!isFailure(read)) return { path, source: read.data };
	}
	return null;
}

/** The note asking the user to add or remove `cron`'s trigger in `file`, saying why. */
function manualNote(action: "Add" | "Remove", file: string, cron: string, reason: string): string {
	let [where, line] =
		file === CONFIG
			? ["worker.triggers", `triggers.scheduled({ schedule: ${literal(cron)} }),`]
			: ["triggers.crons", literal(cron)];
	return `${action} its trigger by hand, since ${reason}:\nIn ${file}, in ${where}:\n  ${line}\n`;
}

/**
 * Adds `triggers.scheduled({ schedule: cron })` to the `worker.triggers` list of
 * `cloudflare.config.ts` unless a trigger already delivers the same schedule. A project
 * configured in `wrangler.jsonc`, or whose config has no such list, gets a note instead, and a
 * project with no Worker configuration at all gets neither.
 */
export async function planTrigger(root: string, cron: string): Promise<TriggerPlan> {
	let none = { edit: null, note: null };
	let existing = await triggerCrons(root);
	if (existing.some((entry) => normalized(entry.cron) === normalized(cron))) return none;
	let file = await triggerFile(root);
	if (file === null) return none;
	if (file.path !== CONFIG) {
		return {
			edit: null,
			note: manualNote("Add", file.path, cron, `${file.path} configures the Worker`),
		};
	}
	let missing = {
		edit: null,
		note: manualNote("Add", CONFIG, cron, `${CONFIG} has no worker.triggers list`),
	};
	let imported = ensureImport(
		CONFIG,
		file.source,
		{ kind: "named", name: "triggers" },
		(specifier) => specifier === "cf/config",
		"cf/config",
		"triggers",
	);
	if (isFailure(imported)) return missing;
	let added = addElement(CONFIG, imported.data.source, {
		call: "defineConfig",
		path: ["worker", "triggers"],
		value: `${imported.data.local}.scheduled({ schedule: ${literal(cron)} })`,
	});
	if (isFailure(added)) return missing;
	return { edit: { path: CONFIG, before: file.source, after: added.data.source }, note: null };
}

/**
 * The source range of each `triggers.scheduled({ schedule: … })` entry in `tokens` whose
 * schedule is `cron`, widened over the JSDoc above it and one comma beside it.
 */
function scheduledEntries(
	source: string,
	tokens: readonly Token[],
	cron: string,
): Array<[number, number]> {
	let ranges: Array<[number, number]> = [];
	let code = tokens.filter((token) => token.type !== "comment");
	let is = (token: Token | undefined, value: string) => token?.value === value;
	for (let index = 0; index < code.length; index += 1) {
		let start = code[index] as Token;
		if (start.type !== "identifier" || is(code[index - 1], ".")) continue;
		if (
			!is(code[index + 1], ".") ||
			!is(code[index + 2], "scheduled") ||
			!is(code[index + 3], "(")
		) {
			continue;
		}
		let depth = 0;
		let close = index + 3;
		for (; close < code.length; close += 1) {
			let value = code[close]?.value;
			if (value === "(" || value === "{" || value === "[") depth += 1;
			if (value === ")" || value === "}" || value === "]") depth -= 1;
			if (depth === 0) break;
		}
		let inside = code.slice(index + 4, close);
		let at = inside.findIndex(
			(token, offset) => token.value === "schedule" && is(inside[offset + 1], ":"),
		);
		let schedule = at === -1 ? undefined : inside[at + 2];
		if (schedule?.type !== "string") continue;
		if (normalized(schedule.value.slice(1, -1)) !== normalized(cron)) continue;
		let from = start.start;
		let to = (code[close] as Token).end;
		let comments = tokens.filter((token) => token.type === "comment" && token.end <= from);
		for (let comment of comments.reverse()) {
			if (source.slice(comment.end, from).trim() !== "") break;
			from = comment.start;
		}
		let after = code[close + 1];
		let before = code[index - 1];
		if (is(after, ","))
			to =
				(after as Token).end +
				(/^[ \t]*/.exec(source.slice((after as Token).end))?.[0].length ?? 0);
		else if (is(before, ",")) from = Math.min(from, (before as Token).start);
		ranges.push([from, to]);
		index = close;
	}
	return ranges;
}

/** `source` without `[from, to)`, and without the line that range leaves empty. */
function cut(source: string, from: number, to: number): string {
	let lineStart = source.lastIndexOf("\n", from - 1) + 1;
	let lineEnd = source.indexOf("\n", to);
	let end = lineEnd === -1 ? source.length : lineEnd;
	if (source.slice(lineStart, from).trim() === "" && source.slice(to, end).trim() === "") {
		return source.slice(0, lineStart) + source.slice(Math.min(end + 1, source.length));
	}
	return source.slice(0, from) + source.slice(to);
}

/**
 * `source`, the text of `cloudflare.config.ts`, without its scheduled triggers for `cron`, or
 * `null` when it has none or does not scan.
 */
export function removeTrigger(source: string, cron: string): string | null {
	let tokens = tokenize(CONFIG, source);
	if (isFailure(tokens)) return null;
	let ranges = scheduledEntries(source, tokens.data, cron);
	if (ranges.length === 0) return null;
	return ranges.reduceRight((text, [from, to]) => cut(text, from, to), source);
}

/**
 * What unscheduling `cron` takes once no remaining job runs on it: the edit to
 * `cloudflare.config.ts`, and a note for each other file whose trigger still delivers it.
 */
export async function planUntrigger(root: string, cron: string): Promise<TriggerPlan> {
	let read = await wrap(() => readFile(join(root, CONFIG), "utf8"));
	let source = isFailure(read) ? null : read.data;
	let removed = source === null ? null : removeTrigger(source, cron);
	let elsewhere = (await triggerCrons(root)).find(
		(entry) =>
			normalized(entry.cron) === normalized(cron) && (entry.file !== CONFIG || removed === null),
	);
	let note =
		elsewhere === undefined
			? null
			: manualNote("Remove", elsewhere.file, cron, "no other job runs on its schedule");
	let edit =
		source === null || removed === null ? null : { path: CONFIG, before: source, after: removed };
	return { edit, note };
}
