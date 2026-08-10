/**
 * Enforces the "ARIA values are tokens, not flags" rule from this package's
 * `AGENTS.md` over this package: no module under `src/` may hand a boolean to an
 * ARIA attribute whose value is a token, and the states that were found broken here
 * render the token they should.
 *
 * The scanner itself, its own fixture cases, and the repo-wide run of it live at
 * `test/aria-tokens.ts` and `test/aria-tokens.test.ts` — apps write JSX too, and most
 * of this mistake turned out to be outside the component library. This file keeps a
 * package-scoped run of the same scanner so the rule still fails the suite while
 * somebody is working inside this package alone.
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
 * Scanning source rather than rendered output is what makes the coverage total:
 * most components here have no render test of their own, and the ones that do would
 * each need a case per attribute. The rendered-output cases below cover the four
 * states this defect was actually found in, since an attribute can also be right in
 * the source and missing from the output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Glob } from "bun";
import { renderToString } from "remix/ui/server";

import type { AriaViolation } from "../../../../test/aria-tokens";

import { findAriaViolations } from "../../../../test/aria-tokens";

import { Attachment } from "./attachment";
import { Checkbox } from "./checkbox";
import { Skeleton } from "./skeleton";
import { TextField } from "./text-field";
import { ToggleButton } from "./toggle-button";

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
