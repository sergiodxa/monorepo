/**
 * The commit-msg check: a message handed to `runCheckCommits`, which fails with guidance for a
 * missing body or a lowercase summary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, isSuccess } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { runCheckCommits } from "./check-commits.js";

/** Fixture directories created by the current test, removed after it. */
const CREATED: string[] = [];

afterEach(async () => {
	let dirs = CREATED.splice(0);
	await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The exit-shaped result of checking `message` as a message file. */
async function checkMessage(message: string): Promise<{ ok: boolean; stderr: string }> {
	let dir = await mkdtemp(join(tmpdir(), "check-commits-"));
	CREATED.push(dir);
	let file = join(dir, "COMMIT_EDITMSG");
	await writeFile(file, message);
	let ran = await runCheckCommits({ messageFile: file });
	if (isSuccess(ran)) return { ok: true, stderr: "" };
	return { ok: false, stderr: ran.error.message };
}

describe("check-commits --message-file", () => {
	test("accepts a capitalized summary with a body", async () => {
		let result = await checkMessage("feat(jwt): Add ES512 signing keys\n\nAdds keys.\n");
		expect(result.ok).toBe(true);
	});

	test("rejects a missing body", async () => {
		let result = await checkMessage("feat(jwt): Add ES512 signing keys\n");
		expect(result.ok).toBe(false);
		expect(result.stderr).toContain("no body");
	});

	test("rejects a lowercase summary", async () => {
		let result = await checkMessage("feat(jwt): add ES512 signing keys\n\nAdds keys.\n");
		expect(result.ok).toBe(false);
		expect(result.stderr).toContain("lowercase");
	});

	test("accepts an autosquash subject without a body", async () => {
		let result = await checkMessage("fixup! feat(jwt): Add ES512 signing keys\n");
		expect(result.ok).toBe(true);
	});
});

describe("runCheckCommits usage", () => {
	test("fails when neither a range nor a message file is given", async () => {
		let ran = await runCheckCommits({});
		expect(isFailure(ran)).toBe(true);
	});
});
