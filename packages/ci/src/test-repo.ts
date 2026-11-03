/**
 * Temporary git repositories for the package's tests: files written, committed by a fixed
 * identity, and removed after each test, so every run test works on a real tree with a real
 * HEAD instead of a stubbed git.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Directories made by `createRepo`, removed by `removeRepos`. */
const CREATED: string[] = [];

/** Runs git in `cwd` and answers its trimmed stdout. */
export function gitIn(cwd: string, ...args: string[]): string {
	return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** Writes each file, creating directories as needed. */
export async function writeFiles(
	root: string,
	files: Readonly<Record<string, string>>,
): Promise<void> {
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
}

/** A repository holding `files` in one commit on `main`. */
export async function createRepo(files: Readonly<Record<string, string>>): Promise<string> {
	let root = await realpath(await mkdtemp(join(tmpdir(), "sdxc-ci-")));
	CREATED.push(root);
	gitIn(root, "init", "--quiet", "--initial-branch=main");
	gitIn(root, "config", "user.email", "ci@example.com");
	gitIn(root, "config", "user.name", "CI");
	gitIn(root, "config", "commit.gpgsign", "false");
	await writeFiles(root, files);
	gitIn(root, "add", "-A");
	gitIn(root, "commit", "--quiet", "--no-verify", "-m", "Initial");
	return root;
}

/** A bare repository, for tests that push. */
export async function createBareRepo(): Promise<string> {
	let root = await realpath(await mkdtemp(join(tmpdir(), "sdxc-ci-remote-")));
	CREATED.push(root);
	gitIn(root, "init", "--quiet", "--bare", "--initial-branch=main");
	return root;
}

/** Removes every repository the test made. */
export async function removeRepos(): Promise<void> {
	for (let dir of CREATED.splice(0)) await rm(dir, { recursive: true, force: true });
}
