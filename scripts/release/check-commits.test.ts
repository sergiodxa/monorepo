/**
 * The `commit-msg` hook's check, run as the hook runs it: a message file handed to
 * `check-commits.ts`, which exits non-zero with guidance for a missing body or a lowercase summary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";

const EXEC_FILE = promisify(execFile);

/** The script the hook executes. */
const SCRIPT = join(import.meta.dirname, "check-commits.ts");

/** Fixture directories created by the current test, removed after it. */
const CREATED: string[] = [];

afterEach(async () => {
	let dirs = CREATED.splice(0);
	await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The exit code and stderr of the hook's check over `message`. */
async function checkMessage(message: string): Promise<{ code: number; stderr: string }> {
	let dir = await mkdtemp(join(tmpdir(), "check-commits-"));
	CREATED.push(dir);
	let file = join(dir, "COMMIT_EDITMSG");
	await writeFile(file, message);
	try {
		await EXEC_FILE("bun", [SCRIPT, "--message-file", file]);
		return { code: 0, stderr: "" };
	} catch (error) {
		let failed = error as { code: number; stderr: string };
		return { code: failed.code, stderr: failed.stderr };
	}
}

describe("check-commits --message-file", () => {
	test("accepts a capitalized summary with a body", async () => {
		let result = await checkMessage("feat(jwt): Add ES512 signing keys\n\nAdds keys.\n");
		expect(result.code).toBe(0);
	});

	test("rejects a summary that starts lowercase, naming the expected shape", async () => {
		let result = await checkMessage("feat(jwt): add ES512 signing keys\n\nAdds keys.\n");
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("the summary starts lowercase");
		expect(result.stderr).toContain("feat(jwt): Add ES512 signing keys");
	});

	test("rejects a capitalized summary without a body", async () => {
		let result = await checkMessage("feat(jwt): Add ES512 signing keys\n");
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("the message has no body");
	});

	test("lets an autosquash subject through", async () => {
		let result = await checkMessage("fixup! feat(jwt): add keys\n");
		expect(result.code).toBe(0);
	});
});
