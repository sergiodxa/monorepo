/**
 * Holds the developer tools to their contract with the player: they import it through the
 * public `@sdxc/novel/ui` entry and `ui/internal.ts` alone, so a player change that would break
 * them surfaces in that one internal module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

/** The specifiers the dev tools may import the player through. */
const ALLOWED = new Set(["../ui.js", "../ui/internal.js"]);

describe("the developer tools' imports", () => {
	test("reach the player only through the public entry and ui/internal", () => {
		let folder = new URL(".", import.meta.url);
		let found = readdirSync(folder)
			.filter((file) => /\.tsx?$/.test(file))
			.flatMap((file) =>
				[...readFileSync(new URL(file, folder), "utf8").matchAll(/from "(\.\.\/ui[^"]*)"/g)].map(
					(match) => ({ file, specifier: match[1] ?? "" }),
				),
			);
		expect(found.length).toBeGreaterThan(0);
		expect(found.filter(({ specifier }) => !ALLOWED.has(specifier))).toEqual([]);
	});
});
