/**
 * Release git helpers: a missing `Release-Note-For` target must not abort the run, matching the
 * same-day `gitHead` guard that already treats an unknown sha as "not unchanged".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { correctionFiles, hasCommit } from "./git.js";

describe("correctionFiles", () => {
	test("answers an empty list when the named sha is not in this clone", async () => {
		let sha = "00d9511d3cddbc459e24496167a39c9ab08f24b8";
		expect(await hasCommit(sha)).toBe(false);

		let files = await correctionFiles(sha);

		expect(isSuccess(files)).toBe(true);
		if (isFailure(files)) return;
		expect(files.data).toEqual([]);
	});

	test("answers the paths a known commit touched when the sha is present", async () => {
		let sha = "6997964d998f975b8914cdafa1d6f25f954d0fd7";
		expect(await hasCommit(sha)).toBe(true);

		let files = await correctionFiles(sha);

		expect(isSuccess(files)).toBe(true);
		if (isFailure(files)) return;
		expect(files.data).toContain("packages/ci/src/worktree.ts");
	});
});
