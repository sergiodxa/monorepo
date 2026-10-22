/**
 * Fails when a commit has no release note or a lowercase summary: `messageFile` checks one
 * message for the commit-msg hook, and a revision range checks every commit a push or pull
 * request adds, so `--no-verify` never gets a commit into a release unseen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { Commit } from "./commits.js";

import {
	hasLowercaseSummary,
	isLowercaseSummary,
	isMissingBody,
	messageBody,
	messageSubject,
	parseCommits,
} from "./commits.js";
import { commitLogSince } from "./git.js";

/** Commits at or before this SHA predate the release-note body rule. */
const ENFORCED_AFTER = "83f765d186e8b357808513ff910986eb679f6d55";

/** Commits at or before this SHA predate the capitalized-summary rule. */
const CAPITALIZED_AFTER = "177a9604d9228d6576bdb05a7e0b60d020093968";

/** Subjects `git rebase --autosquash` folds away before anything reaches `main`. */
const AUTOSQUASH_SUBJECT = /^(?:fixup|squash|amend)! /;

/** What every rejection ends with, so the author knows what to write. */
const GUIDANCE = [
	"Every commit needs a body written as its public release note:",
	"  feature   what it does and how to use it, with a short code example",
	"  breaking  every migration step, with the code before and after",
	"  fix       the behavior before and after, and whether consumers must act",
	"  other     one sentence saying consumers need to do nothing",
].join("\n");

/** What a lowercase-summary rejection ends with. */
const SUMMARY_GUIDANCE = [
	"A commit title is `type(scope): Summary`, the summary starting with a capital letter:",
	"  feat(jwt): Add ES512 signing keys",
	"Release notes print the summary alone, so it has to read as a sentence on its own.",
].join("\n");

/** Options for one commit check. */
export interface CheckCommitsOptions {
	/** A commit message file, as the commit-msg hook passes. */
	messageFile?: string;
	/** A revision range such as `BASE..HEAD`. */
	range?: string;
}

/** Checks the message file or the range; the failure is the report. */
export async function runCheckCommits(
	options: CheckCommitsOptions,
): Promise<Result<string, Error>> {
	if (options.messageFile !== undefined) return checkMessageFile(options.messageFile);
	if (options.range === undefined) {
		return failure(new Error("Usage: release check-commits --message-file <path> | <range>"));
	}
	return checkRange(options.range);
}

async function checkMessageFile(path: string): Promise<Result<string, Error>> {
	let message = await wrap(() => readFile(path, "utf8"));
	if (isFailure(message)) return message;
	if (AUTOSQUASH_SUBJECT.test(message.data)) return success("");
	let subject = messageSubject(message.data);
	if (hasLowercaseSummary(subject)) {
		return failure(
			new Error(
				`Commit rejected: the summary starts lowercase.\n  ${subject}\n\n${SUMMARY_GUIDANCE}`,
			),
		);
	}
	if (!isMissingBody(messageBody(message.data))) return success("");
	return failure(new Error(`Commit rejected: the message has no body.\n\n${GUIDANCE}`));
}

async function checkRange(range: string): Promise<Result<string, Error>> {
	let log = await commitLogSince(range, ENFORCED_AFTER);
	if (isFailure(log)) return log;
	let commits = parseCommits(log.data);
	if (isFailure(commits)) return commits;
	let missing = commits.data.filter((commit) => isMissingBody(commit.body));
	let lowercase = await lowercaseSince(range);
	if (isFailure(lowercase)) return lowercase;
	if (missing.length === 0 && lowercase.data.length === 0) {
		return success(`${commits.data.length} commit(s) in ${range} carry a release note.`);
	}
	let reports: string[] = [];
	if (missing.length > 0) {
		reports.push(`Commits without a body:\n${listCommits(missing)}\n\n${GUIDANCE}`);
	}
	if (lowercase.data.length > 0) {
		reports.push(
			`Commits with a lowercase summary:\n${listCommits(lowercase.data)}\n\n${SUMMARY_GUIDANCE}`,
		);
	}
	return failure(new Error(reports.join("\n\n")));
}

/** The commits in `range` after the capitalization rule took effect whose summary starts lowercase. */
async function lowercaseSince(range: string): Promise<Result<Commit[], Error>> {
	let log = await commitLogSince(range, CAPITALIZED_AFTER);
	if (isFailure(log)) return log;
	let commits = parseCommits(log.data);
	if (isFailure(commits)) return commits;
	return success(commits.data.filter((commit) => isLowercaseSummary(commit.title)));
}

function listCommits(commits: Commit[]): string {
	return commits.map((commit) => `  ${commit.sha.slice(0, 9)} ${commit.title}`).join("\n");
}
