/**
 * Covers how a manifest becomes the facts a package page and the landing copy state,
 * peers included: a package that asks for `remix` as a peer targets Remix exactly as one
 * that lists it as a dependency does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { findPackage, readPackageFacts } from "~/app/services/packages";

describe("findPackage", () => {
	test("counts a package whose remix is a peer as written for Remix", () => {
		let entry = findPackage("http");

		expect(entry?.peers).toEqual(["remix"]);
		expect(entry?.frameworkFree).toBe(false);
		expect(entry?.standalone).toBe(false);
	});

	test("leaves an optional peer out of what a project installs", () => {
		expect(findPackage("messaging")?.peers).not.toContain("@sdxc/web-push");
	});
});

describe("readPackageFacts", () => {
	test("counts every package with remix as a peer among those targeting Remix", () => {
		expect(readPackageFacts().remixTargeted).toBeGreaterThan(50);
	});
});
