/**
 * The generated tag map and Lucide version: both must describe the same Lucide release the
 * registry was drawn from, since a catalogue searches by the tags and caches by the version.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import lucidePackage from "lucide-static/package.json" with { type: "json" };
import { describe, expect, test } from "vitest";

import { iconExportNames, LUCIDE_VERSION } from "./icon-names.js";
import { iconTags } from "./icon-tags.js";

describe("iconTags", () => {
	test("lists tags for exactly the icons the package ships", () => {
		expect(Object.keys(iconTags)).toEqual(Object.keys(iconExportNames));
	});

	test("carries Lucide's search words for an icon", () => {
		expect(iconTags.heart).toContain("love");
	});
});

describe("LUCIDE_VERSION", () => {
	test("names the installed lucide-static release the icons were generated from", () => {
		expect(LUCIDE_VERSION).toBe(lucidePackage.version);
	});
});
