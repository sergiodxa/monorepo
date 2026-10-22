/**
 * The `duplication` check: identical blocks of at least `doctor.duplication.minLines` code
 * lines (blank and comments stripped) appear in more than one module, so agents extract shared
 * helpers instead of pasting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import { PROJECT_FOLDERS } from "../stats.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";
import { isAppSource, listFiles } from "./files.js";

/** One occurrence of a duplicated block. */
interface BlockHit {
	file: string;
	/** 1-based line of the first code line in the block. */
	line: number;
}

/**
 * Warns when the same normalised code block of `minLines` or more appears in two places.
 */
export const duplicationCheck: Check = {
	name: "duplication",
	async run(context): Promise<CheckResult> {
		let minLines = context.config.doctor.duplication.minLines;
		let blocks = new Map<string, BlockHit[]>();
		let files = 0;
		for (let folder of PROJECT_FOLDERS) {
			for (let file of (await listFiles(context.root, folder)).filter(isAppSource)) {
				files += 1;
				let source = await wrap(() => readFile(join(context.root, file), "utf8"));
				if (isFailure(source)) continue;
				for (let block of codeBlocks(file, source.data, minLines)) {
					let hits = blocks.get(block.key) ?? [];
					hits.push({ file: block.file, line: block.line });
					blocks.set(block.key, hits);
				}
			}
		}
		if (files === 0) return skipped("No app source to scan for duplication");
		let findings = [...blocks.values()]
			.filter((hits) => uniqueFiles(hits).length > 1)
			.flatMap((hits) => {
				let places = uniqueFiles(hits)
					.map((hit) => `${hit.file}:${hit.line}`)
					.sort();
				return [`duplicate block at ${places.join(" and ")}`];
			})
			.sort();
		if (findings.length === 0) {
			return passed(`No duplicated blocks of ${minLines}+ code lines`);
		}
		return {
			status: "warn",
			message:
				findings.length === 1
					? "Found 1 duplicated code block"
					: `Found ${findings.length} duplicated code blocks`,
			findings,
			fix: `Extract a shared helper, or raise doctor.duplication.minLines in .config/sdxc.jsonc`,
		};
	},
};

/** Sliding windows of `minLines` consecutive code lines, keyed by their joined text. */
export function codeBlocks(
	file: string,
	source: string,
	minLines: number,
): Array<{ key: string; file: string; line: number }> {
	let code: Array<{ line: number; text: string }> = [];
	let inBlock = false;
	let lines = source.split("\n");
	for (let index = 0; index < lines.length; index++) {
		let raw = lines[index]!;
		let trimmed = raw.trim();
		if (inBlock) {
			if (trimmed.includes("*/")) inBlock = false;
			continue;
		}
		if (trimmed === "" || trimmed.startsWith("//")) continue;
		if (trimmed.startsWith("/*") || trimmed.startsWith("{/*")) {
			if (!trimmed.includes("*/")) inBlock = true;
			continue;
		}
		code.push({ line: index + 1, text: normalize(trimmed) });
	}
	let blocks: Array<{ key: string; file: string; line: number }> = [];
	for (let start = 0; start + minLines <= code.length; start++) {
		let slice = code.slice(start, start + minLines);
		let key = slice.map((line) => line.text).join("\n");
		blocks.push({ key, file, line: slice[0]!.line });
	}
	return blocks;
}

/** Collapses whitespace so indent-only differences do not hide a paste. */
function normalize(line: string): string {
	return line.replace(/\s+/g, " ");
}

/** One hit per file (first line wins). */
function uniqueFiles(hits: readonly BlockHit[]): BlockHit[] {
	let seen = new Set<string>();
	let unique: BlockHit[] = [];
	for (let hit of hits) {
		if (seen.has(hit.file)) continue;
		seen.add(hit.file);
		unique.push(hit);
	}
	return unique;
}
