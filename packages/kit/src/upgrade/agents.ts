/**
 * The sdxc section of a project's `AGENTS.md`: the lines between `<!-- sdxc:start … -->` and
 * `<!-- sdxc:end -->`, which `sdxc upgrade` rewrites from the release it installs. Everything
 * outside the markers belongs to the project and is kept byte for byte.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

/** The file agents read at the project root. */
export const AGENTS_FILE = "AGENTS.md";

/** Where a release ships the section, inside its `@sdxc/kit`. */
export const AGENTS_TEMPLATE = "templates/app/AGENTS.md";

/** What a start line begins with; the rest of its comment is the release's wording. */
const START_MARKER = "<!-- sdxc:start";

/** The whole end line. */
const END_MARKER = "<!-- sdxc:end -->";

/**
 * Where a project's `AGENTS.md` stands after a refresh: `refreshed` or `current` when it holds
 * one sdxc section, and otherwise why it was left as it is.
 */
export type AgentsStatus = "refreshed" | "current" | "missing" | "unmarked" | "unbalanced";

/** The outcome of replacing the section in one text. */
export interface Replaced {
	status: Extract<AgentsStatus, "refreshed" | "current" | "unmarked" | "unbalanced">;
	/** The new text, or the given one unchanged when there was nothing to replace. */
	text: string;
}

/** The line indexes of the one start and end marker, or why the text has no usable pair. */
function markers(
	lines: readonly string[],
): { start: number; end: number } | "unmarked" | "unbalanced" {
	let starts: number[] = [];
	let ends: number[] = [];
	for (let [index, line] of lines.entries()) {
		let trimmed = line.trim();
		if (trimmed.startsWith(START_MARKER)) starts.push(index);
		else if (trimmed === END_MARKER) ends.push(index);
	}
	if (starts.length === 0 && ends.length === 0) return "unmarked";
	let [start] = starts;
	let [end] = ends;
	if (starts.length !== 1 || ends.length !== 1 || start === undefined || end === undefined) {
		return "unbalanced";
	}
	return start < end ? { start, end } : "unbalanced";
}

/**
 * The section in `text`, its start and end lines included, with `\n` line endings. A text
 * without exactly one start line followed by one end line is a failure.
 */
export function managedSection(text: string): Result<string, Error> {
	let lines = text.replaceAll("\r\n", "\n").split("\n");
	let found = markers(lines);
	if (typeof found === "string") {
		return failure(new Error(`${AGENTS_FILE} has no single sdxc section (${found})`));
	}
	return success(lines.slice(found.start, found.end + 1).join("\n"));
}

/**
 * Replaces the section in `text` with `section`, written with the file's own line endings
 * (CRLF when it has any). Text without one balanced pair of markers comes back unchanged.
 */
export function replaceSection(text: string, section: string): Replaced {
	let lines = text.split("\n");
	let found = markers(lines);
	if (typeof found === "string") return { status: found, text };
	let ending = text.includes("\r\n") ? "\r" : "";
	let replacement = section.split("\n").map((line) => `${line}${ending}`);
	let replaced = [
		...lines.slice(0, found.start),
		...replacement,
		...lines.slice(found.end + 1),
	].join("\n");
	return { status: replaced === text ? "current" : "refreshed", text: replaced };
}

/** What refreshing a project's `AGENTS.md` comes to, worked out before anything is written. */
export interface AgentsPlan {
	status: AgentsStatus;
	/** The file's new text when `status` is `refreshed`, and `null` otherwise. */
	text: string | null;
}

/**
 * Works out the sdxc section of the `AGENTS.md` at `root` from the template of the `@sdxc/kit`
 * at `packageRoot`, writing nothing, so the caller writes only once the rest of its work holds.
 * A missing, unmarked or unbalanced file is left as it is, since the markers are how a project
 * opts in; a kit that ships no template answers `null`.
 */
export async function planAgentsFile(
	root: string,
	packageRoot: string,
): Promise<Result<AgentsPlan | null, Error>> {
	let template = await readOptional(join(packageRoot, AGENTS_TEMPLATE));
	if (isFailure(template)) return template;
	if (template.data === null) return success(null);
	let section = managedSection(template.data);
	if (isFailure(section)) return section;
	let current = await readOptional(join(root, AGENTS_FILE));
	if (isFailure(current)) return current;
	if (current.data === null) return success({ status: "missing", text: null });
	let replaced = replaceSection(current.data, section.data);
	return success({
		status: replaced.status,
		text: replaced.status === "refreshed" ? replaced.text : null,
	});
}

/** Writes the planned text to the `AGENTS.md` at `root`; a plan without one writes nothing. */
export async function writeAgentsFile(
	root: string,
	plan: AgentsPlan,
): Promise<Result<void, Error>> {
	let text = plan.text;
	if (text === null) return success(undefined);
	return wrap(() => writeFile(join(root, AGENTS_FILE), text));
}

/** The file at `path` as text, or `null` when there is none. */
async function readOptional(path: string): Promise<Result<string | null, Error>> {
	let read = await wrap(() => readFile(path, "utf8"));
	if (!isFailure(read)) return read;
	let code = "code" in read.error ? read.error.code : null;
	return code === "ENOENT" ? success(null) : read;
}
