/**
 * Holds a text area to the focus contract in a real browser: keyboard focus draws the ring of
 * its colour role, so a reader always sees where typing will land.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { TextArea } from "./textarea.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

describe("TextArea", () => {
	test("draws a ring on keyboard focus", async () => {
		mounted = render(
			<div>
				<button type="button">Before</button>
				<TextArea aria-label="Reply" />
			</div>,
		);
		mounted.container.querySelector("button")!.focus();
		await userEvent.keyboard("{Tab}");
		let field = document.activeElement as HTMLTextAreaElement;

		expect(field.tagName).toBe("TEXTAREA");
		expect(getComputedStyle(field).outlineStyle).toBe("solid");
		expect(Number.parseFloat(getComputedStyle(field).outlineWidth)).toBeGreaterThanOrEqual(2);
	});
});
