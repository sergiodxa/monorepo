/**
 * Guards the "ARIA values are tokens, not flags" rule across this package. A
 * boolean handed to a token-valued ARIA attribute reaches the document as an
 * empty value or vanishes, leaving the state silent to assistive technology and
 * unstyled, since these components select on those same attributes. The scan
 * covers every module; the render cases pin the four states it was found in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { AriaViolation } from "../../../../test/aria-tokens";

import { findAriaViolations } from "../../../../test/aria-tokens";

import { Attachment } from "./attachment";
import { Checkbox } from "./checkbox";
import { Skeleton } from "./skeleton";
import { TextField } from "./text-field";
import { ToggleButton } from "./toggle-button";

/**
 * Generated `<style>` rules select on the same ARIA attributes under test, so
 * dropping the `<head>` keeps an assertion from passing on selector text alone.
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
		let root = join(dirname(fileURLToPath(import.meta.url)), "..");
		let violations: AriaViolation[] = [];

		for (let file of globSync("**/*.{ts,tsx}", { cwd: root })) {
			if (file.includes(".test.")) continue;
			violations.push(...findAriaViolations(file, readFileSync(join(root, file), "utf8")));
		}

		expect(
			violations.map((violation) => `${violation.file}:${violation.line} ${violation.reason}`),
		).toEqual([]);
	});

	/**
	 * An attribute can be correct in the source and still absent from the output,
	 * so these pin the four states the defect was found in, one component each.
	 */
	describe("rendered output", () => {
		test("hides a decorative placeholder with the token, not an empty value", async () => {
			let html = markup(await renderToString(<Skeleton />));

			expect(html).toContain('aria-hidden="true"');
		});

		test("hides an icon slot's glyph with the token", async () => {
			let html = markup(await renderToString(<Checkbox name="terms">Accept</Checkbox>));

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
		 * A toggle keeps `aria-pressed="false"`: the attribute's presence is what
		 * marks the button as a toggle, and the pressed look matches
		 * `&[aria-pressed="true"]`, so the token draws the state too.
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
