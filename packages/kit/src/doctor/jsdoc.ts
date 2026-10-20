/**
 * The `jsdoc` check: every comment in the app's source is a JSDoc block whose description stays
 * within three prose lines, so an edit cannot leave a long narrative or a `//` aside beside the
 * code it describes. Tags are left out of the line budget; `@param`, `@returns` and `@throws`
 * stay on one line, and `@description` is refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { tokenize } from "@sdxc/codemod";
import { isFailure, wrap } from "@sdxc/result";

import { PROJECT_FOLDERS } from "../stats.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";
import { isAppSource, listFiles } from "./files.js";

/** Tags whose description must stay on the same line as the tag. */
const ONE_LINE_TAGS = new Set([
	"param",
	"arg",
	"argument",
	"returns",
	"return",
	"throws",
	"exception",
]);

/** Tags that belong in the comment's prose, not as a block tag. */
const BANNED_TAGS = new Set(["description", "desc"]);

/**
 * Tooling directives the repository keeps as the only non-JSDoc comments, matched on the
 * comment body after its markers.
 */
const TOOLING =
	/(?:@ts-(?:expect-error|ignore|nocheck)\b|oxlint-disable(?:-next-line)?\b|biome-ignore\b|eslint-disable(?:-next-line)?\b|prettier-ignore\b|@jsxImportSource\b|@vitest-environment\b|v8 ignore\b|c8 ignore\b|istanbul ignore\b|#__PURE__\b|\/?\s*<reference\b)/;

/** The most prose lines a JSDoc description may hold. */
export const MAX_DESCRIPTION_LINES = 3;

/** One finding the check reports for a comment. */
export interface JsdocFinding {
	/** The file, relative to the project root. */
	file: string;
	/** The 1-based line the comment starts on. */
	line: number;
	/** What is wrong with the comment. */
	message: string;
}

/**
 * Warns on each non-JSDoc comment that is not a tooling directive, each description longer than
 * three prose lines, each banned `@description`, and each `@param` / `@returns` / `@throws` that
 * spills onto a second line.
 */
export const jsdocCheck: Check = {
	name: "jsdoc",
	async run(context): Promise<CheckResult> {
		let findings: string[] = [];
		let files = 0;
		for (let folder of PROJECT_FOLDERS) {
			for (let file of (await listFiles(context.root, folder)).filter(isAppSource)) {
				files += 1;
				let source = await wrap(() => readFile(join(context.root, file), "utf8"));
				if (isFailure(source)) continue;
				for (let finding of inspectComments(file, source.data)) {
					findings.push(`${finding.file}:${finding.line}: ${finding.message}`);
				}
			}
		}
		if (files === 0) return skipped("No app source to read for comments");
		if (findings.length === 0) {
			return passed("Every comment is JSDoc within three description lines");
		}
		return {
			status: "warn",
			message:
				findings.length === 1
					? "Found 1 comment outside the JSDoc rules"
					: `Found ${findings.length} comments outside the JSDoc rules`,
			findings,
			fix: "Write comments as /** … */, keep the description to 3 lines, put @param/@returns/@throws on one line, and drop @description",
		};
	},
};

/**
 * Every rule breach in `source`, in source order. A file the scanner cannot tokenize is left
 * alone so the type checker names the syntax error.
 *
 * @param file - Path reported in each finding.
 * @param source - The module's text.
 */
export function inspectComments(file: string, source: string): JsdocFinding[] {
	let tokens = tokenize(file, source);
	if (isFailure(tokens)) return [];
	let findings: JsdocFinding[] = [];
	for (let token of tokens.data) {
		if (token.type !== "comment") continue;
		let line = lineOf(source, token.start);
		let value = token.value;
		if (value.startsWith("#!")) continue;
		if (isJsdoc(value)) {
			findings.push(...inspectJsdoc(file, line, value));
			continue;
		}
		if (isToolingDirective(value)) continue;
		let kind = value.startsWith("//") ? "//" : "/* … */";
		findings.push({
			file,
			line,
			message: `${kind} comment; write JSDoc (/** … */) or a tooling directive`,
		});
	}
	return findings;
}

/**
 * Whether `value` is a JSDoc block (`/** … *\/`), the only comment shape a symbol may carry.
 */
export function isJsdoc(value: string): boolean {
	return value.startsWith("/**");
}

/**
 * Whether `value` is a shebang, a triple-slash reference, or a tooling directive the repository
 * keeps as the only non-JSDoc comments.
 */
export function isToolingDirective(value: string): boolean {
	if (value.startsWith("#!")) return true;
	return TOOLING.test(value);
}

/**
 * Findings inside one JSDoc block: a description longer than three prose lines, a banned
 * `@description`, or a one-line tag that continues onto further lines.
 */
function inspectJsdoc(file: string, line: number, value: string): JsdocFinding[] {
	let blocks = splitBlocks(commentLines(value));
	let findings: JsdocFinding[] = [];
	let prose = (blocks[0] ?? []).filter((entry) => entry.trim() !== "");
	if (prose.length > MAX_DESCRIPTION_LINES) {
		findings.push({
			file,
			line,
			message: `description has ${prose.length} lines; keep it to ${MAX_DESCRIPTION_LINES}`,
		});
	}
	for (let tagLines of blocks.slice(1)) {
		let first = tagLines[0] ?? "";
		let match = /^@(\S+)/.exec(first);
		let name = match?.[1] ?? "";
		if (BANNED_TAGS.has(name)) {
			findings.push({
				file,
				line,
				message: `@${name} is not allowed; put the prose before the tags`,
			});
		}
		if (ONE_LINE_TAGS.has(name) && tagLines.slice(1).some((entry) => entry.trim() !== "")) {
			findings.push({
				file,
				line,
				message: `@${name} spans ${tagLines.filter((entry) => entry.trim() !== "").length} lines; keep it on one line`,
			});
		}
	}
	return findings;
}

/**
 * Strip the comment markers and the per-line `*` gutter, keeping relative indentation that a
 * fenced `@example` may need.
 */
function commentLines(raw: string): string[] {
	let text = raw.trim();
	if (text.startsWith("/**")) text = text.slice(3);
	else if (text.startsWith("/*")) text = text.slice(2);
	if (text.endsWith("*/")) text = text.slice(0, -2);
	return text.split("\n").map((entry) => entry.replace(/^[ \t]*\*? ?/, "").trimEnd());
}

/**
 * Cut the lines at every block tag that starts a line outside a fenced code block, so the first
 * group is the description and each later group is one tag.
 */
function splitBlocks(lines: string[]): string[][] {
	let blocks: string[][] = [[]];
	let fence: string | null = null;
	for (let line of lines) {
		let fenced = /^\s*(```+|~~~+)/.exec(line);
		if (fenced?.[1]) {
			if (fence === null) fence = fenced[1][0] ?? null;
			else if (fenced[1].startsWith(fence)) fence = null;
		}
		if (fence === null && /^@\S/.test(line)) blocks.push([line]);
		else blocks.at(-1)?.push(line);
	}
	return blocks;
}

/** The 1-based line number of `offset` in `source`. */
function lineOf(source: string, offset: number): number {
	let line = 1;
	for (let index = 0; index < offset; index++) {
		if (source.charCodeAt(index) === 10) line += 1;
	}
	return line;
}
