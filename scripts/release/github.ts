/**
 * The GitHub Release that closes a run: `gh release create` makes the tag and the release in
 * one call, so a day counts as released exactly when its notes are published.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { CommandError } from "./command.js";

import { run } from "./command.js";
import { REPO_ROOT } from "./workspace.js";

export interface ReleaseInput {
	tag: string;
	target: string;
	title: string;
	notesFile: string;
}

/** Creates the release, and its tag at `target`, with the notes file as body; resolves to the release URL. */
export async function createRelease(input: ReleaseInput): Promise<Result<string, CommandError>> {
	let result = await run(
		"gh",
		[
			"release",
			"create",
			input.tag,
			"--target",
			input.target,
			"--title",
			input.title,
			"--notes-file",
			input.notesFile,
		],
		{ cwd: REPO_ROOT },
	);
	if (isFailure(result)) return result;
	return success(result.data.stdout.trim());
}
