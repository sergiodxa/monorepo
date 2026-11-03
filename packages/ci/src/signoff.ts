/**
 * Signing a commit off: the guards that make a green run trustworthy (complete, clean from start
 * to end, HEAD unchanged), the record a green run leaves under the clone's git directory, the
 * push of exactly the tested commit, and the `sdxc/ci` status that marks it green on GitHub.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { Repository } from "./github.js";

import { currentBranch, headCommit, isClean, pushCommit, remoteURL, upstream } from "./git.js";
import { commitExists, parseRepository, postSignoff, resolveToken } from "./github.js";

/** A green run's record, kept so the commit can be signed off later. */
export interface RunRecord {
	sha: string;
	/** ISO timestamp of when the run finished. */
	at: string;
	host: string;
	/** Milliseconds the run took. */
	duration: number;
	steps: number;
}

/** What a signoff did. */
export interface SignoffReport {
	posted: boolean;
	pushed: boolean;
	sha: string | null;
	/** Why nothing was posted, when nothing was. */
	reason: string | null;
}

/** What a run knew when it started, which the guards compare against its end. */
export interface RunStart {
	root: string;
	gitDirectory: string;
	head: string;
	clean: boolean;
}

/** Where a signoff posts and how it authenticates. */
export interface SignoffTarget {
	/** The remote to push to and read the repository from; the upstream's, else `origin`. */
	remote: string | null;
	/** The variable holding the GitHub token; `gh auth token` answers when it is unset. */
	tokenEnv: string;
	env: Readonly<Record<string, string | undefined>>;
}

/** The record file for `sha`. */
function recordPath(gitDirectory: string, sha: string): string {
	return join(gitDirectory, "sdxc-ci", `${sha}.json`);
}

/**
 * Whether the tree still holds exactly what the run started on: clean at start and end, and
 * HEAD unmoved. The failure names what changed, for the run to print.
 */
export async function checkTree(start: RunStart): Promise<Result<void, Error>> {
	if (!start.clean)
		return failure(new Error("the run started with uncommitted or untracked files"));
	let clean = await isClean(start.root);
	if (isFailure(clean) || !clean.data) return failure(new Error("files changed during the run"));
	let head = await headCommit(start.root);
	if (isFailure(head) || head.data !== start.head) {
		return failure(new Error("HEAD moved during the run"));
	}
	return success(undefined);
}

/** Writes the record a green, complete, clean run leaves for `start.head`. */
export async function writeRecord(
	start: RunStart,
	record: RunRecord,
): Promise<Result<void, Error>> {
	let path = recordPath(start.gitDirectory, record.sha);
	let made = await wrap(() => mkdir(join(start.gitDirectory, "sdxc-ci"), { recursive: true }));
	if (isFailure(made)) return failure(made.error);
	let written = await wrap(() => writeFile(path, `${JSON.stringify(record, null, 2)}\n`));
	if (isFailure(written)) return failure(written.error);
	return success(undefined);
}

/** The record an earlier green run left for `sha`, or `null` when no run passed it here. */
export async function readRecord(gitDirectory: string, sha: string): Promise<RunRecord | null> {
	let text = await wrap(() => readFile(recordPath(gitDirectory, sha), "utf8"));
	if (isFailure(text)) return null;
	let parsed = wrap((): RunRecord => JSON.parse(text.data) as RunRecord);
	return isFailure(parsed) ? null : parsed.data;
}

/** A duration as a signoff's description and the summary print it: `0.4s`, `14.2s`, `1m 21s`. */
export function formatDuration(milliseconds: number): string {
	if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)}s`;
	let minutes = Math.floor(milliseconds / 60_000);
	let seconds = Math.round((milliseconds % 60_000) / 1000);
	return `${minutes}m ${seconds}s`;
}

/** The description a signoff posts: the machine and how long the run took. */
export function describeRecord(record: RunRecord): string {
	return `Passed on ${record.host} in ${formatDuration(record.duration)}`;
}

/** The remote and branch a push of the tested commit goes to. */
async function pushTarget(
	root: string,
	remote: string | null,
): Promise<Result<{ remote: string; branch: string }, Error>> {
	let tracked = await upstream(root);
	if (isFailure(tracked)) return tracked;
	if (tracked.data !== null)
		return success({ remote: remote ?? tracked.data.remote, branch: tracked.data.branch });
	let branch = await currentBranch(root);
	if (isFailure(branch)) return branch;
	if (branch.data === "HEAD")
		return failure(new Error("HEAD is detached and has no upstream to push to"));
	return success({ remote: remote ?? "origin", branch: branch.data });
}

/** The GitHub repository behind `remote`. */
export async function repositoryOf(
	root: string,
	remote: string,
): Promise<Result<Repository, Error>> {
	let url = await remoteURL(root, remote);
	if (isFailure(url)) return failure(new Error(`no remote named ${remote}`));
	let repository = parseRepository(url.data);
	if (repository === null)
		return failure(new Error(`${remote} does not point at a GitHub repository`));
	return success(repository);
}

/** The remote a signoff reads the repository from: the given one, the upstream's, else `origin`. */
async function signoffRemote(root: string, remote: string | null): Promise<string> {
	if (remote !== null) return remote;
	let tracked = await upstream(root);
	if (isFailure(tracked) || tracked.data === null) return "origin";
	return tracked.data.remote;
}

/**
 * Posts the `sdxc/ci` status for `record.sha`. The commit must already be on GitHub; with
 * `push`, it is pushed to its upstream branch first, exactly as tested.
 */
export async function postRecord(
	root: string,
	record: RunRecord,
	target: SignoffTarget,
	push: boolean,
): Promise<SignoffReport> {
	let report: SignoffReport = { posted: false, pushed: false, sha: record.sha, reason: null };
	if (push) {
		let destination = await pushTarget(root, target.remote);
		if (isFailure(destination)) return { ...report, reason: destination.error.message };
		let pushed = await pushCommit(
			root,
			destination.data.remote,
			record.sha,
			destination.data.branch,
		);
		if (isFailure(pushed)) {
			return { ...report, reason: `the push was rejected:\n${pushed.error.output.trim()}` };
		}
		report.pushed = true;
	}
	let remote = await signoffRemote(root, target.remote);
	let repository = await repositoryOf(root, remote);
	if (isFailure(repository)) return { ...report, reason: repository.error.message };
	let token = await resolveToken(target.env, target.tokenEnv, root);
	if (isFailure(token)) return { ...report, reason: token.error.message };
	let exists = await commitExists(token.data, repository.data, record.sha);
	if (isFailure(exists)) return { ...report, reason: exists.error.message };
	if (!exists.data) {
		return {
			...report,
			reason: "the commit is not on GitHub yet; push it, or run again with --push",
		};
	}
	let posted = await postSignoff(token.data, repository.data, record.sha, describeRecord(record));
	if (isFailure(posted)) return { ...report, reason: posted.error.message };
	return { ...report, posted: true };
}

/** The record a run that just passed leaves, for `start.head`. */
export function recordOf(start: RunStart, duration: number, steps: number): RunRecord {
	return { sha: start.head, at: new Date().toISOString(), host: hostname(), duration, steps };
}
