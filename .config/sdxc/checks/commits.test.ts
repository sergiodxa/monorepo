/**
 * The commits doctor check maps `runCheckCommits` onto pass / fail / skip from its env inputs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import check from "./commits.js";

/** Env keys the check reads; restored after each test. */
const ENV_KEYS = ["SDXC_COMMIT_MSG_FILE", "SDXC_COMMIT_RANGE"] as const;

afterEach(async () => {
	for (let key of ENV_KEYS) delete process.env[key];
});

describe("commits doctor check", () => {
	test("skips when neither env input is set", async () => {
		let result = await check.run({} as never);
		expect(result.status).toBe("skip");
	});

	test("fails a message file with no body", async () => {
		let dir = await mkdtemp(join(tmpdir(), "sdxc-commits-check-"));
		let file = join(dir, "COMMIT_EDITMSG");
		await writeFile(file, "feat(jwt): Add keys\n");
		process.env.SDXC_COMMIT_MSG_FILE = file;
		try {
			let result = await check.run({} as never);
			expect(result.status).toBe("fail");
			expect(result.findings?.join("\n")).toContain("no body");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test("passes a capitalized summary with a body", async () => {
		let dir = await mkdtemp(join(tmpdir(), "sdxc-commits-check-"));
		let file = join(dir, "COMMIT_EDITMSG");
		await writeFile(file, "feat(jwt): Add ES512 signing keys\n\nAdds keys.\n");
		process.env.SDXC_COMMIT_MSG_FILE = file;
		try {
			let result = await check.run({} as never);
			expect(result.status).toBe("pass");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
