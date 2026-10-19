/**
 * `sdxc stats`: lines of code per kind of code the app layout names, counted like `cloc`
 * without blank lines and comments, and the ratio of test code to app code. The layout gives
 * every kind its folder, so the table needs no configuration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import { listFiles } from "./doctor/files.js";

/** The folders the app layout keeps code in, which `stats` and `notes` read. */
export const PROJECT_FOLDERS = ["app", "bootstrap", "config", "database", "resources", "routes"];

/** The files counted: source, SQL and stylesheets, which hold code a reader maintains. */
const COUNTED = /\.(?:[cm]?[jt]sx?|sql|css)$/;

/** A test file, counted under Tests whatever folder it sits in. */
const TEST = /\.test\.[cm]?[jt]sx?$/;

/**
 * Each kind's folder, most specific first, so `app/mcp/resources` counts as MCP before `app`
 * counts the rest as other app code.
 */
const KINDS: readonly [string, string][] = [
	["Controllers", "app/http/controllers/"],
	["Middleware", "app/http/middleware/"],
	["Validators", "app/http/validators/"],
	["Jobs", "app/jobs/"],
	["Models", "app/models/"],
	["Services", "app/services/"],
	["Policies", "app/policies/"],
	["Initializers", "app/initializers/"],
	["MCP", "app/mcp/"],
	["Commands", "app/commands/"],
	["Emails", "app/emails/"],
	["Test helpers", "app/test/"],
	["Other app code", "app/"],
	["Entry points", "bootstrap/"],
	["Config", "config/"],
	["Migrations", "database/migrations/"],
	["Factories", "database/factories/"],
	["Other database code", "database/"],
	["Resources", "resources/"],
	["Routes", "routes/"],
];

/** One row of the table. */
export interface StatsRow {
	kind: string;
	files: number;
	/** Every line, blank and comment lines included. */
	lines: number;
	/** The lines left without blank lines and comments. */
	code: number;
}

/** What `sdxc stats` reports. */
export interface Stats {
	/** One row per kind that has files, in layout order, then Tests. */
	rows: StatsRow[];
	/** The code lines outside tests. */
	code: number;
	/** The code lines in tests. */
	tests: number;
}

/**
 * The lines of `text` that hold code: blank lines and comment lines are left out, a comment
 * being a line inside `/* … *\/` or starting with `//`, or with `--` in SQL.
 */
export function codeLines(text: string, sql: boolean): number {
	let count = 0;
	let inBlock = false;
	for (let raw of text.split("\n")) {
		let line = raw.trim();
		if (inBlock) {
			if (line.includes("*/")) {
				inBlock = false;
				if (line.slice(line.indexOf("*/") + 2).trim() !== "") count += 1;
			}
			continue;
		}
		if (line === "" || line.startsWith("//") || (sql && line.startsWith("--"))) continue;
		if (line.startsWith("/*") || line.startsWith("{/*")) {
			if (!line.includes("*/")) inBlock = true;
			continue;
		}
		count += 1;
	}
	return count;
}

/** Counts every code file under the project's layout folders, by kind. */
export async function projectStats(root: string): Promise<Stats> {
	let rows = new Map<string, StatsRow>();
	let add = (kind: string, lines: number, code: number) => {
		let row = rows.get(kind) ?? { kind, files: 0, lines: 0, code: 0 };
		row.files += 1;
		row.lines += lines;
		row.code += code;
		rows.set(kind, row);
	};
	for (let folder of PROJECT_FOLDERS) {
		for (let path of await listFiles(root, folder)) {
			if (!COUNTED.test(path)) continue;
			let text = await wrap(() => readFile(join(root, path), "utf8"));
			if (isFailure(text)) continue;
			let lines = text.data.split("\n").length - (text.data.endsWith("\n") ? 1 : 0);
			let code = codeLines(text.data, path.endsWith(".sql"));
			let kind = TEST.test(path)
				? "Tests"
				: (KINDS.find(([, prefix]) => path.startsWith(prefix))?.[0] ?? "Other");
			add(kind, lines, code);
		}
	}
	let order = [...KINDS.map(([kind]) => kind), "Other", "Tests"];
	let sorted = order.flatMap((kind) => {
		let row = rows.get(kind);
		return row === undefined ? [] : [row];
	});
	let tests = rows.get("Tests")?.code ?? 0;
	let code = sorted.reduce((sum, row) => sum + row.code, 0) - tests;
	return { rows: sorted, code, tests };
}

/** The table `sdxc stats` prints, with a total and the code to test ratio. */
export function formatStats(stats: Stats): string {
	let header: [string, string, string, string] = ["Kind", "Files", "Lines", "Code"];
	let total = stats.rows.reduce(
		(sum, row) => ({
			kind: "Total",
			files: sum.files + row.files,
			lines: sum.lines + row.lines,
			code: sum.code + row.code,
		}),
		{ kind: "Total", files: 0, lines: 0, code: 0 },
	);
	let cells = [...stats.rows, total].map(
		(row) => [row.kind, String(row.files), String(row.lines), String(row.code)] as const,
	);
	let widths = header.map((title, column) =>
		Math.max(title.length, ...cells.map((row) => row[column]?.length ?? 0)),
	);
	let line = (row: readonly string[]) =>
		row
			.map((cell, column) =>
				column === 0 ? cell.padEnd(widths[0] ?? 0) : cell.padStart(widths[column] ?? 0),
			)
			.join("  ")
			.trimEnd();
	let rule = widths.map((width) => "-".repeat(width)).join("  ");
	let body = cells.slice(0, -1).map(line);
	let ratio = stats.code === 0 ? "no app code" : `1:${(stats.tests / stats.code).toFixed(1)}`;
	return `${[line(header), rule, ...body, rule, line(cells.at(-1) ?? [])].join("\n")}\n\nCode: ${stats.code}  Tests: ${stats.tests}  Code to test ratio: ${ratio}\n`;
}
