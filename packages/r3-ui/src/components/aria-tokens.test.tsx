/**
 * Enforces the "ARIA values are tokens, not flags" rule from this package's
 * `AGENTS.md`: no module under `src/` may hand a boolean to an ARIA attribute
 * whose value is a token — `aria-hidden`, `aria-invalid`, `aria-busy`,
 * `aria-pressed`, `aria-checked`, `aria-expanded`, `aria-selected`,
 * `aria-current`, `aria-disabled`, `aria-modal`, `aria-required`,
 * `aria-readonly`, `aria-atomic`, `aria-multiselectable`, `aria-haspopup` and
 * `aria-live`.
 *
 * The rule exists because the failure is silent in both directions. The
 * renderer writes a `true` prop the way HTML wants a boolean attribute
 * written — as the bare name — so `aria-hidden={true}` reaches the document as
 * `aria-hidden=""`, an empty value that is none of the tokens ARIA defines, and
 * every one of these attributes resolves an unrecognized value to its own
 * default. `false` is worse than wrong: the attribute is dropped from the
 * markup entirely, which for `aria-pressed` stops a toggle button being a
 * toggle at all. Nothing crashes, no test that only counts elements notices,
 * and the component keeps looking right on screen while announcing the
 * opposite of the truth.
 *
 * Three spellings are all the same mistake and all three are scanned for: the
 * JSX shorthand (`aria-hidden`), an explicit boolean expression
 * (`aria-hidden={true}`), and a boolean inside an `attrs({...})` or plain
 * object literal (`"aria-hidden": true`). Identifiers are scanned too — a
 * `DEFAULT_*` constant declared as a boolean and spread onto one of these
 * attributes is how this defect originally reached ten components at once.
 *
 * The check scans source text rather than rendered output on purpose. Most
 * components in this package have no render test of their own, and the ones
 * that do would each need a case per attribute; scanning covers every module
 * that exists today and every one added later. A handful of fixture-based
 * cases exercise the scanner itself first, since a codebase with zero current
 * violations can't otherwise prove the scanner would catch one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Glob } from "bun";
import { renderToString } from "remix/ui/server";

import { Attachment } from "./attachment";
import { Checkbox } from "./checkbox";
import { Skeleton } from "./skeleton";
import { TextField } from "./text-field";
import { ToggleButton } from "./toggle-button";

/**
 * ARIA attributes whose value is a token rather than a flag.
 *
 * Every one of them accepts text — `"true"`, `"false"`, `"mixed"`, `"page"`,
 * `"menu"`, `"polite"` — and none of them is an HTML boolean attribute, which
 * is the whole distinction this rule turns on. `aria-label` and friends are
 * absent because nobody passes a boolean to a string.
 */
const TOKEN_ATTRIBUTES = [
	"aria-hidden",
	"aria-invalid",
	"aria-busy",
	"aria-pressed",
	"aria-checked",
	"aria-expanded",
	"aria-selected",
	"aria-current",
	"aria-disabled",
	"aria-modal",
	"aria-required",
	"aria-readonly",
	"aria-atomic",
	"aria-multiselectable",
	"aria-haspopup",
	"aria-live",
];

/** One offending occurrence, kept with the line it came from for the failure message. */
interface AriaViolation {
	file: string;
	line: number;
	source: string;
	reason: string;
}

/**
 * Every `const NAME = true;`/`= false;` in `source`, which is what an
 * `attrs({ "aria-hidden": DEFAULT_ARIA_HIDDEN })` may be hiding behind.
 */
function booleanConstants(source: string): Set<string> {
	let names = new Set<string>();
	for (let match of source.matchAll(
		/const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(true|false)\s*;/g,
	)) {
		if (match[1]) names.add(match[1]);
	}
	return names;
}

/**
 * Scans one module's text for booleans reaching a token-valued ARIA attribute.
 *
 * Comment lines are skipped, so a docblock is free to talk about the mistake —
 * this file's own prose would trip the scanner otherwise.
 */
export function findAriaViolations(file: string, source: string): AriaViolation[] {
	let violations: AriaViolation[] = [];
	let booleans = booleanConstants(source);
	let attributes = TOKEN_ATTRIBUTES.join("|");

	/** JSX shorthand: `aria-hidden` with no value at all, which means `true`. */
	let shorthand = new RegExp(`(?<![\\w-])(${attributes})(?=\\s*(?:/?>|[a-zA-Z{]))`, "g");
	/** An explicit expression: `aria-hidden={true}` or `aria-hidden={SOME_CONST}`. */
	let expression = new RegExp(`(?<![\\w-])(${attributes})=\\{([^}]*)\\}`, "g");
	/** An object or `attrs()` entry: `"aria-hidden": true`. */
	let entry = new RegExp(`["'](${attributes})["']\\s*:\\s*([^,}\\n]+)`, "g");

	let lines = source.split("\n");

	for (let [index, line] of lines.entries()) {
		let trimmed = line.trim();
		if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;

		let report = (attribute: string, reason: string) => {
			violations.push({ file, line: index + 1, source: trimmed, reason: `${attribute} ${reason}` });
		};

		for (let match of line.matchAll(shorthand)) {
			report(
				match[1] ?? "",
				"is written as a valueless JSX shorthand, which renders as an empty value",
			);
		}

		for (let match of line.matchAll(expression)) {
			let value = (match[2] ?? "").trim();
			if (value === "true" || value === "false")
				report(match[1] ?? "", `is given the boolean ${value}`);
			else if (booleans.has(value))
				report(match[1] ?? "", `is given ${value}, declared as a boolean`);
		}

		for (let match of line.matchAll(entry)) {
			let value = (match[2] ?? "").trim();
			if (value === "true" || value === "false")
				report(match[1] ?? "", `is given the boolean ${value}`);
			else if (booleans.has(value))
				report(match[1] ?? "", `is given ${value}, declared as a boolean`);
		}
	}

	return violations;
}

/**
 * The rendered elements alone, with the `<head>` full of generated `<style>`
 * rules dropped — those name the same attributes in their selectors.
 *
 * @param html A full `renderToString` result.
 * @returns Just the markup that follows the emitted stylesheet.
 */
function markup(html: string): string {
	let head = html.lastIndexOf("</head>");
	return head === -1 ? html : html.slice(head + "</head>".length);
}

describe("ARIA token attributes", () => {
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

	test("no module hands a boolean to a token-valued ARIA attribute", () => {
		let root = join(import.meta.dir, "..");
		let violations: AriaViolation[] = [];

		for (let file of new Glob("**/*.{ts,tsx}").scanSync(root)) {
			if (file.includes(".test.")) continue;
			violations.push(...findAriaViolations(file, readFileSync(join(root, file), "utf8")));
		}

		expect(
			violations.map((violation) => `${violation.file}:${violation.line} ${violation.reason}`),
		).toEqual([]);
	});

	/**
	 * The other direction: what the source says is only half the rule, since an
	 * attribute can also be correct in the source and absent from the output. These
	 * pin the four states this defect was actually found in, one component each.
	 *
	 * Each assertion reads {@link markup} rather than the whole render, because these
	 * components style themselves off the very attributes under test — a field's
	 * danger border is `&[aria-invalid="true"]`, a toggle's pressed look is
	 * `&[aria-pressed="true"]` — so the emitted stylesheet names them too and an
	 * assertion over the whole document would pass on the selector alone. (That
	 * overlap is the other half of what this defect broke: an attribute rendered as
	 * an empty value matches neither ARIA nor the selector, so those states went
	 * unannounced *and* undrawn.)
	 */
	describe("rendered output", () => {
		test("hides a decorative placeholder with the token, not an empty value", async () => {
			let html = markup(await renderToString(<Skeleton />));

			expect(html).toContain('aria-hidden="true"');
		});

		test("hides an icon slot's glyph with the token", async () => {
			let html = markup(await renderToString(<Checkbox name="terms">Accept</Checkbox>));

			// Every `aria-hidden` in the output carries the token; none is valueless.
			expect(html.match(/aria-hidden(="true")?/g)?.every((match) => match.includes("true"))).toBe(
				true,
			);
		});

		test("announces an invalid field as invalid, and says nothing when it is valid", async () => {
			let invalid = markup(
				await renderToString(<TextField label="Email" name="email" errorMessage="Required" />),
			);
			let valid = markup(await renderToString(<TextField label="Email" name="email" />));

			expect(invalid).toContain('aria-invalid="true"');
			expect(valid).not.toContain("aria-invalid");
		});

		test("announces a busy attachment as busy, and says nothing when it settles", async () => {
			let busy = markup(await renderToString(<Attachment state="uploading">file.png</Attachment>));
			let settled = markup(await renderToString(<Attachment state="idle">file.png</Attachment>));

			expect(busy).toContain('aria-busy="true"');
			expect(settled).not.toContain("aria-busy");
		});

		/**
		 * A toggle keeps `aria-pressed="false"` rather than dropping the attribute:
		 * absence is what tells assistive technology the button is not a toggle at
		 * all, and this component's styling matches `&[aria-pressed="true"]`, so the
		 * token is what draws the pressed state too.
		 */
		test("renders a pressed state as a token whether the consumer passed a boolean or a string", async () => {
			let pressed = markup(
				await renderToString(<ToggleButton aria-pressed={true}>Mute</ToggleButton>),
			);
			let unpressed = markup(
				await renderToString(<ToggleButton aria-pressed={false}>Mute</ToggleButton>),
			);
			let mixed = markup(
				await renderToString(<ToggleButton aria-pressed="mixed">Mute</ToggleButton>),
			);

			expect(pressed).toContain('aria-pressed="true"');
			expect(unpressed).toContain('aria-pressed="false"');
			expect(mixed).toContain('aria-pressed="mixed"');
		});
	});
});
