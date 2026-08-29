/**
 * Repo-wide guard against handing a boolean to a token-valued ARIA attribute
 * (`aria-hidden`, `aria-invalid`, `aria-busy`, `aria-pressed`, `aria-checked`,
 * and more). A `true` renders as the bare attribute name, which resolves to
 * the default value, and `false` is dropped from the markup entirely, so the
 * element quietly announces the opposite of what was meant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { findAriaViolations } from "./aria-tokens";

/** Repo root, resolved from this file so the scan behaves the same regardless of the working directory. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** First-party directories walked by the scan below. */
const SCANNED = ["apps", "packages"];

/**
 * Paths carrying known, deliberately unfixed occurrences. Empty by design: an
 * entry here is a debt with an end date — the test below fails once its target
 * is clean or gone, so fixing or deleting it removes the exemption too.
 */
const EXEMPT: string[] = [];

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

	/**
	 * The 500-file floor catches a scanner that silently matches nothing. The
	 * 60s budget covers reading every first-party file from disk with room to
	 * spare, so a failure stays a meaningful signal of a real violation.
	 */
	test("no first-party module hands a boolean to a token-valued ARIA attribute", () => {
		let violations: string[] = [];
		let scanned = 0;

		for (let area of SCANNED) {
			for (let file of globSync("**/*.{ts,tsx}", { cwd: join(ROOT, area) })) {
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

		expect(scanned).toBeGreaterThan(500);
		expect(violations).toEqual([]);
	}, 60_000);

	/**
	 * Keeps the exemption a statement about reality: it fails once the exempted
	 * path is fixed or deleted, catching the point where an unnecessary entry
	 * would otherwise swallow the next regression in whatever moves in later.
	 */
	test("every exemption still has something to exempt", () => {
		for (let exempt of EXEMPT) {
			expect(existsSync(join(ROOT, exempt)), `${exempt} is gone — drop it from EXEMPT`).toBe(true);

			let violations: string[] = [];

			for (let file of globSync("**/*.{ts,tsx}", { cwd: join(ROOT, exempt) })) {
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
