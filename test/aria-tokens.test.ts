/**
 * Repo-wide guard against handing a boolean to an ARIA attribute whose value is a
 * token: `aria-hidden`, `aria-invalid`, `aria-busy`, `aria-pressed`, `aria-checked`
 * and the rest of the set listed in the scanner this reuses.
 *
 * The rule is written out in full in the "ARIA values are tokens, never flags"
 * section of `packages/r3-ui/AGENTS.md`. The short version: these attributes take
 * text, the renderer writes a `true` prop the way HTML wants a boolean attribute
 * written — as the bare name — so `aria-hidden={true}` reaches the document as
 * `aria-hidden=""`, which is none of the tokens ARIA defines and resolves to the
 * attribute's default. A `false` is dropped from the markup entirely. Nothing
 * throws, nothing looks wrong on screen, and the element announces the opposite of
 * what was meant.
 *
 * This file exists because the component library was never where most of the
 * mistake lived. Apps write JSX too, and they were carrying more of it than the
 * library was — 42 sites in one app alone, every one of them a decorative icon
 * that screen readers were being asked to read out. A guard that only covered the
 * library would have gone on passing while that stayed true.
 *
 * The scanner lives beside this file in `aria-tokens.ts` and is exercised against
 * fixtures here before it is trusted against the repo — a codebase with zero current
 * violations cannot otherwise prove the scanner would catch one. `packages/r3-ui`
 * imports the same scanner for a package-scoped run of its own, so the rule has one
 * definition and two scopes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Glob } from "bun";

import { findAriaViolations } from "./aria-tokens";

/** Repo root, resolved from this file so the scan does not depend on the working directory. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Where the scan looks. Everything first-party, and nothing generated or vendored. */
const SCANNED = ["apps", "packages"];

/**
 * Paths carrying known, deliberately unfixed occurrences.
 *
 * `packages/ui` is the previous generation of the component library, kept alive only
 * for the apps still on the old runtime — `apps/auth-saas` and the two markdown
 * packages — and slated for deletion once those finish migrating to Remix 3.
 * Its affected files are real defects rather than dead code, so they are exempted
 * rather than declared clean, but fixing them buys nothing that outlives the package.
 *
 * An entry here is a debt with an end date, not a permanent carve-out, and the test
 * below is what stops it outliving its reason: the exemption fails once the package is
 * clean or gone, so it is removed by the same change that removes the need for it.
 */
const EXEMPT = ["packages/ui/"];

describe("ARIA token attributes, repo-wide", () => {
	describe("the scanner itself", () => {
		test("catches the valueless JSX shorthand", () => {
			let violations = findAriaViolations("fixture.tsx", "<CheckIcon aria-hidden />");

			expect(violations).toHaveLength(1);
			expect(violations[0]?.reason).toContain("aria-hidden");
		});

		test("catches an explicit boolean in JSX and in an object entry", () => {
			expect(findAriaViolations("fixture.tsx", "<div aria-busy={true} />")).toHaveLength(1);
			expect(findAriaViolations("fixture.tsx", 'attrs({ "aria-hidden": false })')).toHaveLength(1);
		});

		test("catches a boolean hiding behind a constant", () => {
			let source = [
				"const DEFAULT_ARIA_HIDDEN = true;",
				'let mix = attrs({ "aria-hidden": DEFAULT_ARIA_HIDDEN });',
			].join("\n");

			expect(findAriaViolations("fixture.tsx", source)).toHaveLength(1);
		});

		test("accepts every token spelling, and a value it cannot resolve to a boolean", () => {
			let source = [
				'const DEFAULT_ARIA_HIDDEN = "true";',
				'let mix = attrs({ "aria-hidden": DEFAULT_ARIA_HIDDEN });',
				'<div aria-busy="true" aria-live="polite" aria-current={resolvedAriaCurrent} />',
				'<div aria-pressed={pressed ? "true" : "false"} />',
			].join("\n");

			expect(findAriaViolations("fixture.tsx", source)).toEqual([]);
		});

		/**
		 * The blind spot that let eight of these through the first sweep. Once an element
		 * has more than a couple of attributes, the formatter puts each on its own line, so
		 * the shorthand's line ends right after it and the `>` is several lines down.
		 */
		test("catches a shorthand sitting alone on its line, with the tag closing far below", () => {
			let source = ["<div", "\taria-hidden", "\tmix={[absolute(), is('800px')]}", "/>"].join("\n");

			let violations = findAriaViolations("fixture.tsx", source);

			expect(violations).toHaveLength(1);
			expect(violations[0]?.line).toBe(2);
		});

		test("ignores a trailing comment on a line of real code", () => {
			let source = "let x = 1; // never write aria-hidden or aria-busy={true} here";

			expect(findAriaViolations("fixture.tsx", source)).toEqual([]);
		});

		test("does not mistake a URL inside a string for the start of a comment", () => {
			let source = ['let url = "https://example.test/a";', "<div aria-hidden />"].join("\n");

			let violations = findAriaViolations("fixture.tsx", source);

			expect(violations).toHaveLength(1);
			expect(violations[0]?.line).toBe(2);
		});

		test("ignores the mistake being described in a comment", () => {
			let source = [
				"/**",
				" * Never write `aria-hidden` or aria-busy={true} here.",
				" */",
				"// <div aria-hidden />",
			].join("\n");

			expect(findAriaViolations("fixture.tsx", source)).toEqual([]);
		});
	});

	test("no first-party module hands a boolean to a token-valued ARIA attribute", () => {
		let violations: string[] = [];
		let scanned = 0;

		for (let area of SCANNED) {
			for (let file of new Glob("**/*.{ts,tsx}").scanSync(join(ROOT, area))) {
				let path = `${area}/${file}`;
				if (path.includes("/node_modules/")) continue;
				if (path.includes(".test.")) continue;
				if (EXEMPT.some((exempt) => path.startsWith(exempt))) continue;

				scanned++;
				for (let violation of findAriaViolations(path, readFileSync(join(ROOT, path), "utf8"))) {
					violations.push(`${violation.file}:${violation.line} ${violation.reason}`);
				}
			}
		}

		// A scan that silently matched nothing would pass this test forever.
		expect(scanned).toBeGreaterThan(500);
		expect(violations).toEqual([]);
	});

	/**
	 * The exemption has to stay a statement about reality. Whether the exempted path
	 * gets fixed or deleted, this fails and says which — an exemption nobody needs any
	 * more is one that will quietly swallow the next regression in whatever moves into
	 * that path later.
	 */
	test("every exemption still has something to exempt", () => {
		for (let exempt of EXEMPT) {
			expect(existsSync(join(ROOT, exempt)), `${exempt} is gone — drop it from EXEMPT`).toBe(true);

			let violations: string[] = [];

			for (let file of new Glob("**/*.{ts,tsx}").scanSync(join(ROOT, exempt))) {
				let path = `${exempt}${file}`;
				if (path.includes("/node_modules/") || path.includes(".test.")) continue;
				for (let violation of findAriaViolations(path, readFileSync(join(ROOT, path), "utf8"))) {
					violations.push(`${violation.file}:${violation.line}`);
				}
			}

			expect(violations.length, `${exempt} is clean — drop it from EXEMPT`).toBeGreaterThan(0);
		}
	});
});
