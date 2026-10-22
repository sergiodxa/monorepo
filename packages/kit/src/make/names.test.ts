/**
 * Name parsing for `sdxc make`: folders, kebab-case files and the spellings derived from them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { parseName } from "./names.js";

describe("parseName", () => {
	test("reads folders and spells the last segment every way a stub needs", () => {
		expect(unwrap(parseName("trials/get-post"))).toEqual({
			segments: ["trials", "get-post"],
			base: "get-post",
			key: "getPost",
			pascal: "GetPost",
			snake: "get_post",
			title: "Get post",
		});
	});

	test("writes camelCase, PascalCase and snake_case segments in kebab-case", () => {
		expect(unwrap(parseName("ActivityPub/sendNote")).segments).toEqual([
			"activity-pub",
			"send-note",
		]);
		expect(unwrap(parseName("expire_old")).segments).toEqual(["expire-old"]);
	});

	test("refuses empty, climbing and digit-first segments", () => {
		expect(isFailure(parseName("jobs//expire"))).toBe(true);
		expect(isFailure(parseName("../expire"))).toBe(true);
		expect(isFailure(parseName("2fa"))).toBe(true);
	});
});
