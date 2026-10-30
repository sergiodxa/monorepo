/**
 * Tests the code block's header against the real layout engine: a long path truncates
 * inside a phone-width column with the copy button still beside it, and the header keeps
 * the 40px height and 16px inset its code body shares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import CodeBlock from "~/resources/components/code-block";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** A path as long as the landing-pages guide names, which outgrew a 375px screen. */
const LONG_PATH = "apps/my-product/resources/views/marketing/landing-page-pricing-teaser.tsx";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts a headed block in a column as wide as a 375px screen leaves the prose. */
function mountHeaded(path: string): HTMLElement {
	mounted = render(
		<div id="column" style={{ inlineSize: "335px" }}>
			<CodeBlock content="export default {};" language="ts" path={path}>
				{null}
			</CodeBlock>
		</div>,
	);
	return mounted.$("#column") as HTMLElement;
}

describe("CodeBlock", () => {
	test("truncates a long path and keeps the copy button inside the card", () => {
		let column = mountHeaded(LONG_PATH);
		let card = column.firstElementChild as HTMLElement;
		let button = card.querySelector("button") as HTMLElement;

		expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
		expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(
			column.getBoundingClientRect().right,
		);
		expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
			card.getBoundingClientRect().right,
		);
	});

	test("draws a 40px header whose icon starts at the code's 16px inset", () => {
		let column = mountHeaded("app.ts");
		let card = column.firstElementChild as HTMLElement;
		let header = card.firstElementChild as HTMLElement;
		let icon = header.querySelector("svg") as SVGElement;
		let pre = card.querySelector("pre") as HTMLElement;
		let cardLeft = card.getBoundingClientRect().left + card.clientLeft;

		expect(header.getBoundingClientRect().height).toBe(40);
		expect(icon.getBoundingClientRect().left - cardLeft).toBe(16);
		expect(Number.parseFloat(getComputedStyle(pre).paddingInlineStart)).toBe(16);
	});
});
