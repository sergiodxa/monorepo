#!/usr/bin/env bun
/**
 * Fails when a commit has no release note (ADR-140): `--message-file` checks one message for
 * the `commit-msg` hook, and a revision range checks every commit a push or pull request adds
 * through the release's own parser, so `--no-verify` never gets a commit into a release unseen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import type { Result } from "@sdxc/result";

import { failure, isFailure, match, success, wrap } from "@sdxc/result";

import { isMissingBody, messageBody, parseCommits } from "./commits.js";
import { commitLogSince } from "./git.js";

/** The commit that adopted ADR-140; it and everything before it predate the rule. */
const ENFORCED_AFTER = "83f765d186e8b357808513ff910986eb679f6d55";

/** Subjects `git rebase --autosquash` folds away before anything reaches `main`. */
const AUTOSQUASH_SUBJECT = /^(?:fixup|squash|amend)! /;

/** What every rejection ends with, so the author knows what to write without opening the ADR. */
const GUIDANCE = [
	"Every commit needs a body written as its public release note (ADR-140):",
	"  feature   what it does and how to use it, with a short code example",
	"  breaking  every migration step, with the code before and after",
	"  fix       the behavior before and after, and whether consumers must act",
	"  other     one sentence saying consumers need to do nothing",
].join("\n");

/** Checks the message file or the range from the command line; the failure is the report. */
async function main(): Promise<Result<string, Error>> {
	let args = wrap(() =>
		parseArgs({
			allowPositionals: true,
			options: { "message-file": { type: "string" } },
		}),
	);
	if (isFailure(args)) return args;
	let messageFile = args.data.values["message-file"];
	if (messageFile !== undefined) return checkMessageFile(messageFile);
	let range = args.data.positionals[0];
	if (range === undefined) {
		return failure(new Error("Usage: check-commits.ts --message-file <path> | <range>"));
	}
	return checkRange(range);
}

async function checkMessageFile(path: string): Promise<Result<string, Error>> {
	let message = await wrap(() => readFile(path, "utf8"));
	if (isFailure(message)) return message;
	if (AUTOSQUASH_SUBJECT.test(message.data)) return success("");
	if (!isMissingBody(messageBody(message.data))) return success("");
	return failure(new Error(`Commit rejected: the message has no body.\n\n${GUIDANCE}`));
}

async function checkRange(range: string): Promise<Result<string, Error>> {
	let log = await commitLogSince(range, ENFORCED_AFTER);
	if (isFailure(log)) return log;
	let commits = parseCommits(log.data);
	if (isFailure(commits)) return commits;
	let missing = commits.data.filter((commit) => isMissingBody(commit.body));
	if (missing.length === 0) {
		return success(`${commits.data.length} commit(s) in ${range} carry a release note.`);
	}
	let list = missing.map((commit) => `  ${commit.sha.slice(0, 9)} ${commit.title}`).join("\n");
	return failure(new Error(`Commits without a body:\n${list}\n\n${GUIDANCE}`));
}

match(await main(), {
	success: (report) => {
		if (report !== "") process.stdout.write(`${report}\n`);
	},
	failure: (error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	},
});
