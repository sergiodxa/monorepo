/**
 * Unit tests for {@link "./robots"}: each boolean pair maps to the directive spelling a
 * crawler expects, and the default is the fully permissive value a page without the tag
 * already has, so an indexable page keeps the same treatment once the tag is added.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { robotsDirectives } from "./robots";

describe("robotsDirectives", () => {
	test("defaults to fully permissive", () => {
		expect(robotsDirectives()).toBe("index, follow");
	});

	test("keeps following links on a page that must not be indexed", () => {
		expect(robotsDirectives({ index: false, follow: true })).toBe("noindex, follow");
	});

	test("indexes a page whose links must not be followed", () => {
		expect(robotsDirectives({ index: true, follow: false })).toBe("index, nofollow");
	});

	test("opts out of both", () => {
		expect(robotsDirectives({ index: false, follow: false })).toBe("noindex, nofollow");
	});

	test("treats a partial input as permissive for the missing directive", () => {
		expect(robotsDirectives({ index: false })).toBe("noindex, follow");
	});
});
