/**
 * Tests for script detection, OpenType script tag candidates and script direction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { detectScript, isoScript, scriptCandidates, scriptDirection } from "./scripts.js";

describe("scripts", () => {
	test("detects the first character with a script of its own", () => {
		expect(detectScript("123 (ب)")).toBe("Arab");
		expect(detectScript("́ abc")).toBe("Latn");
		expect(detectScript("123 !?")).toBe("Zyyy");
	});

	test("offers new Indic tags before old ones, and keeps an explicit tag first", () => {
		expect(scriptCandidates("Deva")).toEqual(["dev2", "deva"]);
		expect(scriptCandidates("deva")).toEqual(["deva", "dev2"]);
		expect(scriptCandidates("Laoo")).toEqual(["lao "]);
		expect(scriptCandidates("arab")).toEqual(["arab"]);
		expect(scriptCandidates("Zyyy")).toEqual(["DFLT"]);
	});

	test("maps tags back to ISO 15924 and to a direction", () => {
		expect(isoScript("dev2")).toBe("Deva");
		expect(isoScript("hebr")).toBe("Hebr");
		expect(isoScript("DFLT")).toBeNull();
		expect(scriptDirection("Arab")).toBe("rtl");
		expect(scriptDirection("Latn")).toBe("ltr");
		expect(scriptDirection(null)).toBe("ltr");
	});
});
