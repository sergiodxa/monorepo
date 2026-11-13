/**
 * Bakes Delta's own source and history into the build: the files of Delta's folder at HEAD,
 * the last commits touching it with their patches, blame per file and the seeded anchors,
 * as JSON under `resources/generated/delta`, because a Worker has no git and no filesystem.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
	DeltaAnchor,
	DeltaBlameRange,
	DeltaCommit,
	DeltaCommitMeta,
	DeltaDocuments,
	DeltaFile,
	DeltaHistory,
	DeltaPatch,
	DeltaTree,
} from "~/app/services/delta/source";

import {
	DELTA_BUDGET_BYTES,
	DELTA_HISTORY_LIMIT,
	DELTA_PATCH_FILE_LIMIT,
	DELTA_ROOT,
} from "~/config/delta";
import { ANCHORS } from "~/resources/views/demo-apps/delta/anchors";
import {
	LOG_FORMAT,
	capPatch,
	checkBudget,
	compactBlame,
	parseLog,
	parseNumstat,
	resolveAnchor,
} from "~/scripts/delta";

/** The app's own root. */
const APP = dirname(dirname(fileURLToPath(import.meta.url)));

/** Where the documents are written, and where the loader reads them from. */
const OUTPUT = join(APP, "resources", "generated", "delta");

/** The `git log` record of one path's newest commit: sha, author, date and subject. */
const LAST_FORMAT = "%H%x1f%an%x1f%aI%x1f%s";

main();

/** Reads the pinned commit and writes every document, or stops the build past the budget. */
function main(): void {
	let top = git(["rev-parse", "--show-toplevel"], APP).trim();
	let head = git(["rev-parse", "HEAD"], top).trim();
	let shallow = git(["rev-parse", "--is-shallow-repository"], top).trim() === "true";

	let files = readFiles(top, head);
	let known = new Map<string, DeltaCommitMeta>();
	let history = shallow ? emptyHistory(head) : readHistory(top, head);
	for (let commit of history.commits) known.set(commit.sha, commit);

	let cited = new Map<string, DeltaCommitMeta>();
	let cite = (meta: DeltaCommitMeta) => {
		if (!known.has(meta.sha) && !cited.has(meta.sha)) cited.set(meta.sha, meta);
	};

	let lastCommits = shallow ? {} : readLastCommits(top, head, files, cite);
	let blame = shallow ? {} : readBlame(top, head, files, cite);
	history.cited = [...cited.values()].sort((a, b) => b.date.localeCompare(a.date));

	let patches = shallow ? {} : readPatches(top, history.commits);
	let anchors = readAnchors(top, files, history.commits);

	let documents: DeltaDocuments = {
		tree: { head, files, lastCommits } satisfies DeltaTree,
		history,
		patches,
		blame,
		anchors,
	};
	let serialized = Object.fromEntries(
		Object.entries(documents).map(([name, value]) => [name, JSON.stringify(value)]),
	);
	let budget = checkBudget(serialized, DELTA_BUDGET_BYTES);
	if (!budget.within) {
		console.error(
			`delta: ${budget.bytes} bytes of generated JSON passes the ${DELTA_BUDGET_BYTES}-byte budget; lower DELTA_HISTORY_LIMIT or serve the documents from assets`,
		);
		process.exitCode = 1;
		return;
	}

	mkdirSync(OUTPUT, { recursive: true });
	for (let [name, text] of Object.entries(serialized)) {
		writeFileSync(join(OUTPUT, `${name}.json`), text);
	}
	console.log(
		`delta: ${files.length} files, ${history.commits.length} commits${shallow ? " (shallow clone, no history)" : ""}, ${budget.bytes} bytes at ${head.slice(0, 7)}`,
	);
}

/** Runs git and answers what it printed; a failure stops the build with git's own message. */
function git(args: string[], cwd: string): string {
	return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Every file under Delta's folder at `head`, read from the commit rather than the working tree. */
function readFiles(top: string, head: string): DeltaFile[] {
	let paths = git(["ls-tree", "-r", "--name-only", head, "--", DELTA_ROOT], top)
		.split("\n")
		.filter((path) => path.startsWith(DELTA_ROOT));
	return paths
		.map((full) => {
			let text = git(["show", `${head}:${full}`], top);
			return {
				path: full.slice(DELTA_ROOT.length),
				text,
				bytes: Buffer.byteLength(text),
				lines: text.replace(/\r?\n$/, "").split(/\r?\n/).length,
			};
		})
		.sort((a, b) => a.path.localeCompare(b.path));
}

/** The history a shallow clone answers: none, flagged so the commits screen says why. */
function emptyHistory(head: string): DeltaHistory {
	return { head, shallow: true, capped: false, commits: [], cited: [] };
}

/** The newest commits touching Delta's folder, each with the files it changed there. */
function readHistory(top: string, head: string): DeltaHistory {
	let logged = parseLog(
		git(
			[
				"log",
				"-n",
				String(DELTA_HISTORY_LIMIT + 1),
				"--no-merges",
				`--format=${LOG_FORMAT}`,
				head,
				"--",
				DELTA_ROOT,
			],
			top,
		),
	);
	let capped = logged.length > DELTA_HISTORY_LIMIT;
	let commits: DeltaCommit[] = logged.slice(0, DELTA_HISTORY_LIMIT).map((commit) => ({
		...commit,
		files: parseNumstat(
			git(
				["show", "--format=", "--no-color", "-M", "--numstat", commit.sha, "--", DELTA_ROOT],
				top,
			),
			DELTA_ROOT,
		),
	}));
	return { head, shallow: false, capped, commits, cited: [] };
}

/** Each commit's patch limited to Delta's files, with oversized file patches dropped. */
function readPatches(top: string, commits: DeltaCommit[]): Record<string, DeltaPatch> {
	let patches: Record<string, DeltaPatch> = {};
	for (let commit of commits) {
		let output = git(
			[
				"show",
				"--format=",
				"--no-color",
				"-M",
				"--histogram",
				"--patch",
				commit.sha,
				"--",
				DELTA_ROOT,
			],
			top,
		);
		patches[commit.sha] = capPatch(output, DELTA_ROOT, DELTA_PATCH_FILE_LIMIT);
	}
	return patches;
}

/** The newest commit touching each file and folder, the root included as `""`. */
function readLastCommits(
	top: string,
	head: string,
	files: DeltaFile[],
	cite: (meta: DeltaCommitMeta) => void,
): Record<string, string> {
	let paths = new Set<string>([""]);
	for (let file of files) {
		let parts = file.path.split("/");
		for (let depth = 1; depth <= parts.length; depth++) paths.add(parts.slice(0, depth).join("/"));
	}
	let last: Record<string, string> = {};
	for (let path of paths) {
		let line = git(
			["log", "-1", `--format=${LAST_FORMAT}`, head, "--", `${DELTA_ROOT}${path}`],
			top,
		).trim();
		let [sha = "", author = "", date = "", subject = ""] = line.split("\x1f");
		if (sha === "") continue;
		last[path] = sha;
		cite({ sha, author, date, subject });
	}
	return last;
}

/** Blame for every file at `head`, compacted to runs of lines one commit last changed. */
function readBlame(
	top: string,
	head: string,
	files: DeltaFile[],
	cite: (meta: DeltaCommitMeta) => void,
): Record<string, DeltaBlameRange[]> {
	let blame: Record<string, DeltaBlameRange[]> = {};
	for (let file of files) {
		let reading = compactBlame(
			git(["blame", "--porcelain", head, "--", `${DELTA_ROOT}${file.path}`], top),
		);
		blame[file.path] = reading.ranges;
		for (let commit of reading.commits) cite(commit);
	}
	return blame;
}

/**
 * Every seeded anchor resolved against the pinned files; an outdated one keeps its excerpt
 * from the commit whose subject it names.
 */
function readAnchors(
	top: string,
	files: DeltaFile[],
	commits: DeltaCommit[],
): Record<string, DeltaAnchor> {
	let anchors: Record<string, DeltaAnchor> = {};
	for (let seed of ANCHORS) {
		let file = files.find((candidate) => candidate.path === seed.path);
		let written =
			seed.written === undefined
				? undefined
				: commits.find((commit) => commit.subject === seed.written);
		let before = written === undefined ? undefined : readAt(top, written.sha, seed.path);
		anchors[seed.id] = resolveAnchor(
			seed,
			file?.text,
			before === undefined || written === undefined
				? undefined
				: { sha: written.sha, text: before },
		);
	}
	return anchors;
}

/** A Delta file as it was at `sha`, or `undefined` when the commit did not hold it. */
function readAt(top: string, sha: string, path: string): string | undefined {
	try {
		return execFileSync("git", ["show", `${sha}:${DELTA_ROOT}${path}`], {
			cwd: top,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
	} catch {
		return undefined;
	}
}
