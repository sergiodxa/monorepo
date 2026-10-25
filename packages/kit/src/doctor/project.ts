/**
 * Runs the checks a project defines in its `doctor.checks` folder. They load in a child process
 * of the project's own runtime, so a check imports what the app imports, and whatever a check
 * does, a throw, a bad export or a hang, comes back as a failed report beside the others.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { AnyCommandContext } from "@sdxc/cli";

import { iife } from "@sdxc/iife";
import { isFailure, wrap } from "@sdxc/result";

import type { Config } from "../config.js";
import type { RouteEntry } from "../routes/index.js";

import type { CheckReport, CheckStatus } from "./check.js";

/** The prefix of the line the runner prints its reports on, apart from anything a check logs. */
const MARKER = "sdxc-doctor-checks:";

/** A check module: TypeScript or JavaScript, its tests and declaration files left out. */
const CHECK_FILE = /^(?!.*\.test\.[cm]?[jt]s$)(?!.*\.d\.[cm]?ts$).+\.[cm]?[jt]s$/;

/** What a project check may be named: lowercase words joined by dashes. */
export const CHECK_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** How long one check may run before it is reported as failed. */
export const CHECK_TIMEOUT_MS = 30_000;

/** Every status a check may answer. */
const STATUSES: ReadonlySet<string> = new Set<CheckStatus>(["pass", "warn", "fail", "skip"]);

/**
 * The runner, evaluated by the project's runtime from the project root. It reads its input from
 * stdin, imports each check module, runs every selected check against a read-only context with
 * a time limit, and prints one entry per check, or per module that failed to load, on a marked line.
 */
const RUNNER = `
import { readFile, readdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
const root = input.root;
const inside = (path) => {
	const full = resolve(root, String(path));
	const rel = relative(root, full);
	if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(path + " is outside the project");
	return full;
};
const describe = (error) => (error instanceof Error ? error.stack ?? error.message : String(error));
const context = Object.freeze({
	root,
	manifest: input.manifest,
	config: input.config,
	routes: input.routes,
	async readFile(path) {
		try {
			return await readFile(inside(path), "utf8");
		} catch (error) {
			if (error?.code === "ENOENT") return null;
			throw error;
		}
	},
	async exists(path) {
		try {
			await stat(inside(path));
			return true;
		} catch {
			return false;
		}
	},
	async files(folder) {
		const found = [];
		const visit = async (dir) => {
			let entries;
			try {
				entries = await readdir(dir, { withFileTypes: true });
			} catch {
				return;
			}
			for (const entry of entries) {
				if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
				const full = join(dir, entry.name);
				if (entry.isDirectory()) await visit(full);
				else if (entry.isFile()) found.push(relative(root, full).split(sep).join("/"));
			}
		};
		await visit(inside(folder));
		return found.sort();
	},
});
const NAME = new RegExp(input.namePattern);
const taken = new Map(input.builtIn.map((name) => [name, "a built-in check"]));
const selected = (name) =>
	(input.only.length === 0 || input.only.includes(name)) && !input.skip.includes(name);
const reports = [];
for (const file of input.files) {
	let checks;
	try {
		const module = await import(pathToFileURL(join(root, file)).href);
		checks = Array.isArray(module.default) ? module.default : [module.default];
	} catch (error) {
		reports.push({ file, name: null, error: "Could not load " + file + ": " + describe(error) });
		continue;
	}
	for (const check of checks) {
		if (check === null || typeof check !== "object" || typeof check.run !== "function") {
			reports.push({ file, name: null, error: file + " default-exports no check; export defineCheck({ name, run }) or a list of them" });
			continue;
		}
		const name = check.name;
		if (typeof name !== "string" || !NAME.test(name)) {
			reports.push({ file, name: null, error: file + " exports a check named " + JSON.stringify(name) + "; a name is lowercase words joined by dashes" });
			continue;
		}
		if (taken.has(name)) {
			reports.push({ file, name, error: "The name " + name + " is taken by " + taken.get(name) });
			continue;
		}
		taken.set(name, file);
		if (!selected(name)) {
			reports.push({ file, name, selected: false });
			continue;
		}
		let timer;
		try {
			const result = await Promise.race([
				Promise.resolve().then(() => check.run(context)),
				new Promise((_, reject) => {
					timer = setTimeout(() => reject(new Error("Did not finish within " + input.timeout + " ms")), input.timeout);
				}),
			]);
			reports.push({ file, name, result });
		} catch (error) {
			reports.push({ file, name, error: describe(error) });
		} finally {
			clearTimeout(timer);
		}
	}
}
process.stdout.write("\\n${MARKER}" + JSON.stringify(reports) + "\\n");
process.exit(0);
`;

/** Which checks a run reports, by name; an empty `only` selects every check. */
export interface Selection {
	only: readonly string[];
	skip: readonly string[];
}

/** Whether `selection` reports the check called `name`. */
export function selects(selection: Selection, name: string): boolean {
	return (
		(selection.only.length === 0 || selection.only.includes(name)) && !selection.skip.includes(name)
	);
}

/** What the project checks run with. */
export interface ProjectChecksOptions {
	root: string;
	/** The runtime `sdxc run` uses for the project, which imports the check modules. */
	runtime: "bun" | "node";
	/** `package.json` as written. */
	manifest: Record<string, unknown>;
	config: Config;
	/** The project's routes, computed once the folder holds a check. */
	routes(): Promise<RouteEntry[]>;
	/** The built-in checks' names, which a project check may not take. */
	builtIn: readonly string[];
	selection: Selection;
}

/** What the project checks reported, and the name of every check they define. */
export interface ProjectChecksRun {
	reports: CheckReport[];
	names: string[];
}

/** One entry the runner prints. */
interface RunnerEntry {
	file: string;
	name: string | null;
	selected?: boolean;
	result?: unknown;
	error?: string;
}

/**
 * The check modules in `folder`, relative to the project root and sorted; a missing folder
 * holds none.
 */
export async function checkFiles(root: string, folder: string): Promise<string[]> {
	let entries = await wrap(() => readdir(join(root, folder), { withFileTypes: true }));
	if (isFailure(entries)) return [];
	return entries.data
		.filter((entry) => entry.isFile() && CHECK_FILE.test(entry.name))
		.map((entry) => `${folder}/${entry.name}`)
		.sort();
}

/**
 * Runs every selected check in the project's `doctor.checks` folder. A module that fails to
 * load is reported under its path, a check that throws, hangs or answers no result under its
 * name, and a runner that cannot start under the folder's path, each as `fail`.
 */
export async function runProjectChecks(
	ctx: Pick<AnyCommandContext, "exec">,
	options: ProjectChecksOptions,
): Promise<ProjectChecksRun> {
	let folder = options.config.doctor.checks;
	let files = await checkFiles(options.root, folder);
	if (files.length === 0) return { reports: [], names: [] };
	let input = JSON.stringify({
		root: options.root,
		manifest: options.manifest,
		config: options.config,
		routes: await options.routes(),
		files,
		builtIn: options.builtIn,
		only: options.selection.only,
		skip: options.selection.skip,
		namePattern: CHECK_NAME.source,
		timeout: CHECK_TIMEOUT_MS,
	});
	let command =
		options.runtime === "bun"
			? ["bun", "-e", RUNNER]
			: ["node", "--input-type=module", "-e", RUNNER];
	let ran = await ctx.exec(command, { cwd: options.root, stdio: "collect", input });
	let entries = isFailure(ran) ? null : parseEntries(ran.data.stdout);
	if (entries === null) {
		let detail = iife(() => {
			if (isFailure(ran))
				return "stderr" in ran.error && ran.error.stderr.trim() !== ""
					? ran.error.stderr.trim()
					: ran.error.message;
			return "The runner printed no report";
		});
		return {
			reports: [
				failed(
					folder,
					`Could not run the checks in ${folder} with ${options.runtime}`,
					detail,
					folder,
				),
			],
			names: [],
		};
	}
	let reports: CheckReport[] = [];
	let names: string[] = [];
	for (let entry of entries) {
		if (entry.name !== null) names.push(entry.name);
		if (entry.selected === false) continue;
		let name = entry.name ?? entry.file;
		if (!selects(options.selection, name)) continue;
		if (entry.error !== undefined) {
			let message =
				entry.name === null ? `${entry.file} is not a check module` : `${name} failed to run`;
			reports.push(failed(name, message, entry.error, entry.file));
			continue;
		}
		let result = toResult(entry.result);
		if (result === null) {
			reports.push(
				failed(
					name,
					`${name} answered no result sdxc doctor reads`,
					JSON.stringify(entry.result) ?? "undefined",
					entry.file,
				),
			);
			continue;
		}
		reports.push({ name, ...result });
	}
	return { reports, names };
}

/** The runner's entries from its output, or `null` when it printed none. */
function parseEntries(stdout: string): RunnerEntry[] | null {
	let line = stdout.split("\n").find((text) => text.startsWith(MARKER));
	if (line === undefined) return null;
	let parsed = wrap(() => JSON.parse(line.slice(MARKER.length)) as unknown);
	if (isFailure(parsed) || !Array.isArray(parsed.data)) return null;
	return parsed.data as RunnerEntry[];
}

/**
 * A check's answer completed with the defaults a project check may leave out, or `null` when it
 * lacks a known status or a message, or carries findings that are not strings.
 */
export function toResult(value: unknown): Omit<CheckReport, "name"> | null {
	if (value === null || typeof value !== "object") return null;
	let answer = value as Record<string, unknown>;
	if (typeof answer.status !== "string" || !STATUSES.has(answer.status)) return null;
	if (typeof answer.message !== "string") return null;
	let findings = answer.findings ?? [];
	if (!Array.isArray(findings) || !findings.every((item) => typeof item === "string")) return null;
	let fix = answer.fix ?? null;
	if (fix !== null && typeof fix !== "string") return null;
	return {
		status: answer.status as CheckStatus,
		message: answer.message,
		findings: findings as string[],
		fix,
	};
}

/** A failed report whose single finding is what went wrong, fixed by editing `file`. */
function failed(name: string, message: string, detail: string, file: string): CheckReport {
	return {
		name,
		status: "fail",
		message,
		findings: [firstLine(detail)],
		fix: `Fix ${file}`,
	};
}

/** The first line of `text`, so a stack trace stays one finding. */
function firstLine(text: string): string {
	return text.split("\n")[0]?.trim() ?? text;
}
