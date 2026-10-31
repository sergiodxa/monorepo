/**
 * Lays the guides' headings out in a real browser inside the docs typeset, where a
 * section heading must open clear room above it however the stylesheet's layers land.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { Typeset } from "@sdxc/ui";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { ProseHeading, ProseParagraph } from "~/resources/components/prose";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("ProseHeading", () => {
	test("opens room above a section heading that follows a paragraph", () => {
		mounted = render(
			<Typeset preset="docs">
				<ProseHeading level={2} id="first">
					First
				</ProseHeading>
				<ProseParagraph>Body text.</ProseParagraph>
				<ProseHeading level={2} id="second">
					Second
				</ProseHeading>
				<ProseParagraph>More body text.</ProseParagraph>
				<ProseHeading level={3} id="third">
					Third
				</ProseHeading>
			</Typeset>,
		);

		let marginTop = (id: string) =>
			parseFloat(getComputedStyle(document.getElementById(id)!).marginBlockStart);

		expect(marginTop("first")).toBe(0);
		expect(marginTop("second")).toBeGreaterThanOrEqual(40);
		expect(marginTop("third")).toBeGreaterThanOrEqual(32);
	});
});
