/**
 * The GitHub Release that closes a run: `gh release create` makes the tag and the release in
 * one call, so a day counts as released exactly when its notes are published.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { REPO_ROOT } from "./workspace.js";

const execFileAsync = promisify(execFile);

export interface ReleaseInput {
	tag: string;
	target: string;
	title: string;
	notesFile: string;
}

/** Creates the release, and its tag at `target`, with the notes file as body; resolves to the release URL. */
export async function createRelease(input: ReleaseInput): Promise<string> {
	let { stdout } = await execFileAsync(
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
	return stdout.trim();
}
