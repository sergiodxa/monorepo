/**
 * Release git helpers: a missing `Release-Note-For` target must not abort the run, matching the
 * same-day `gitHead` guard that already treats an unknown sha as "not unchanged".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { commitFiles, correctionFiles, hasCommit } from "./git.js";

/** Git's null object id, which no commit can carry, so it is absent from every clone. */
const MISSING_SHA = "0".repeat(40);

describe("correctionFiles", () => {
	test("answers an empty list when the named sha is not in this clone", async () => {
		let sha = MISSING_SHA;
		expect(await hasCommit(sha)).toBe(false);

		let files = await correctionFiles(sha);

		expect(isSuccess(files)).toBe(true);
		if (isFailure(files)) return;
		expect(files.data).toEqual([]);
	});

	test("answers the same paths commitFiles does when the sha is present", async () => {
		expect(await hasCommit("HEAD")).toBe(true);

		let files = await correctionFiles("HEAD");
		let shown = await commitFiles("HEAD");

		expect(isSuccess(files)).toBe(true);
		expect(isSuccess(shown)).toBe(true);
		if (isFailure(files) || isFailure(shown)) return;
		expect(files.data).toEqual(shown.data);
	});
});
