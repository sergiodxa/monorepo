/**
 * Renders components in a real browser with a caller's `mix` setting a property the
 * component already sets, after the page has used the caller's utility elsewhere, and
 * checks the caller's value is the one applied.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { overflow } from "@sdxc/u/overflow";
import { text } from "@sdxc/u/typography";
import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { ContextMenu } from "./context-menu.js";
import { ScrollArea } from "./scroll-area.js";
import { Text } from "./text.js";

/**
 * Mounts `node` after a span using `text("xs")`, so that utility's class reaches the
 * page before the component's own `text("sm")` and would lose to it on page order.
 */
function mountAfterDecoy(node: RemixNode): HTMLElement {
	let host = document.createElement("div");
	document.body.appendChild(host);
	render(
		<>
			<span mix={text("xs")}>decoy</span>
			<div data-testid="subject">{node}</div>
		</>,
		{ container: host },
	);
	return host.querySelector('[data-testid="subject"]')!.firstElementChild as HTMLElement;
}

describe("a caller's mix", () => {
	test("overrides Text's own text size", () => {
		let subject = mountAfterDecoy(<Text mix={text("xs")}>Caption</Text>);

		expect(getComputedStyle(subject).fontSize).toBe("12px");
	});

	test("overrides the text size of a menu row reached through a forwarding component", () => {
		let subject = mountAfterDecoy(
			<ContextMenu.SubTrigger mix={[text("xs")]}>Share</ContextMenu.SubTrigger>,
		);

		expect(getComputedStyle(subject).fontSize).toBe("12px");
	});

	test("overrides a property the component sets under a more specific selector", () => {
		let subject = mountAfterDecoy(
			<ScrollArea.Viewport mix={overflow("visible")}>Content</ScrollArea.Viewport>,
		);

		expect(getComputedStyle(subject).overflowY).toBe("visible");
	});
});
