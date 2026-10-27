/**
 * Tests for `name` records against Amiri, whose names are recorded in English and Arabic:
 * the English defaults, picking a language, falling back when a language is missing, and
 * every record by ID and language tag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseFont } from "./index.js";

const AMIRI = unwrap(
	parseFont(readFileSync(new URL("./fixtures/amiri/amiri-regular.ttf", import.meta.url))),
);

const ENGLISH_COPYRIGHT =
	"Copyright (c) 2010-2017, Khaled Hosny <khaledhosny@eglug.org>.\nPortions copyright (c) 2010, Sebastian Kosch <sebastian@aldusleaf.org>.";

describe("Amiri", () => {
	test("reads English metadata by default", () => {
		expect(AMIRI.fullName).toBe("Amiri");
		expect(AMIRI.postscriptName).toBe("Amiri-Regular");
		expect(AMIRI.family).toBe("Amiri");
		expect(AMIRI.subfamily).toBe("Regular");
		expect(AMIRI.copyright).toBe(ENGLISH_COPYRIGHT);
		expect(AMIRI.version).toBe("Version 000.110 ");
		expect([AMIRI.name(1), AMIRI.name(2)]).toEqual(["Amiri", "Regular"]);
	});

	test("reads names in another language", () => {
		expect(AMIRI.name(4, "ar")).toBe("Amiri");
		expect(AMIRI.name(6, "ar")).toBe("Amiri-Regular");
		expect(AMIRI.name(1, "ar")).toBe("Amiri");
		expect(AMIRI.name(2, "ar")).toBe("عادي");
		expect(AMIRI.name(0, "ar")).toBe("حقوق النشر 2010-2017، خالد حسني <khaledhosny@eglug.org>.");
		expect(AMIRI.name(5, "ar")).toBe("إصدارة 000٫110");
	});

	test("falls back to English for a language the font lacks", () => {
		expect(AMIRI.name(2, "piglatin")).toBe("Regular");
		expect(AMIRI.name(2, "klingon")).toBe("Regular");
		expect(AMIRI.name(999)).toBeNull();
	});

	test("lists every record by ID and language tag", () => {
		expect(AMIRI.names[2]?.["en"]).toBe("Regular");
		expect(AMIRI.names[2]?.["ar"]).toBe("عادي");
		expect(Object.keys(AMIRI.names).map(Number)).toContain(0);
	});
});
