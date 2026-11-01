/**
 * Renders ghost and outline link buttons in a real browser with theme variables on the
 * host, and checks the resting fill is transparent while hover paints the variant's
 * hover token whatever the page rendered first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { bg } from "@sdxc/u/color";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { Button } from "./button.js";
import { LinkButton } from "./link-button.js";

/** Theme values the hover fills resolve to, distinct enough to tell apart in a computed style. */
const THEME = {
	"--ui-brand-bg-tint": "rgb(10, 20, 30)",
	"--ui-brand-bg-tint-hover": "rgb(11, 21, 31)",
	"--ui-neutral-bg-tint": "rgb(40, 50, 60)",
	"--ui-neutral-bg-tint-hover": "rgb(41, 51, 61)",
	"--ui-neutral-bg-tint-pressed": "rgb(42, 52, 62)",
};

/**
 * Mounts `node` under a host carrying {@link THEME}, after `before`, so the classes
 * `before` uses reach the page first.
 */
function mount(node: RemixNode, before?: RemixNode): HTMLElement {
	let host = document.createElement("div");
	for (let [name, value] of Object.entries(THEME)) host.style.setProperty(name, value);
	document.body.appendChild(host);
	render(
		<>
			{before}
			<div data-testid="subject">{node}</div>
		</>,
		{ container: host },
	);
	return host.querySelector('[data-testid="subject"]')!.firstElementChild as HTMLElement;
}

/** Ends running transitions, so a computed style reads the state's final value. */
function settle(): void {
	for (let animation of document.getAnimations()) animation.finish();
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("LinkButton fills", () => {
	test("a ghost link rests transparent and paints its hover token on hover", async () => {
		let link = mount(
			<LinkButton href="/a" variant="ghost" color="neutral">
				Open
			</LinkButton>,
		);
		expect(getComputedStyle(link).backgroundColor).toBe("rgba(0, 0, 0, 0)");

		await userEvent.hover(link);
		settle();
		expect(getComputedStyle(link).backgroundColor).toBe("rgb(41, 51, 61)");
	});

	test("a ghost link hovers whatever the page rendered before it", async () => {
		let link = mount(
			<LinkButton href="/a" variant="ghost" color="brand">
				Open
			</LinkButton>,
			<>
				<span mix={bg("transparent")}>decoy</span>
				<Button variant="ghost">Earlier</Button>
				<LinkButton href="/b" variant="ghost">
					Earlier
				</LinkButton>
			</>,
		);
		expect(getComputedStyle(link).backgroundColor).toBe("rgba(0, 0, 0, 0)");

		await userEvent.hover(link);
		settle();
		expect(getComputedStyle(link).backgroundColor).toBe("rgb(10, 20, 30)");
	});

	test("an outline link rests transparent and paints its hover token on hover", async () => {
		let link = mount(
			<LinkButton href="/a" variant="outline" color="brand">
				Open
			</LinkButton>,
		);
		expect(getComputedStyle(link).backgroundColor).toBe("rgba(0, 0, 0, 0)");

		await userEvent.hover(link);
		settle();
		expect(getComputedStyle(link).backgroundColor).toBe("rgb(10, 20, 30)");
	});
});

describe("Button fills", () => {
	test("a ghost button hovers after a ghost link rendered first", async () => {
		let button = mount(
			<Button variant="ghost" color="neutral">
				Open
			</Button>,
			<LinkButton href="/b" variant="ghost" color="neutral">
				Earlier
			</LinkButton>,
		);
		expect(getComputedStyle(button).backgroundColor).toBe("rgba(0, 0, 0, 0)");

		await userEvent.hover(button);
		settle();
		expect(getComputedStyle(button).backgroundColor).toBe("rgb(41, 51, 61)");
	});
});
