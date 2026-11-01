/**
 * Runs the anchor heading in a real browser: the `#` link is named, reachable by Tab and
 * shown on focus and on hover, a jump clears the scroll-margin property, `:target` flashes
 * except under reduced motion, and the level follows the HeadingScope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { HeadingScope } from "../components/heading-scope.js";

import { AnchorHeading } from "./anchor-heading.js";

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The heading's `#` link. */
function link(host: HTMLElement): HTMLAnchorElement {
	return host.querySelector<HTMLAnchorElement>('[data-slot="anchor-heading-link"]')!;
}

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(async () => {
	document.body.replaceChildren();
	history.replaceState(null, "", location.pathname + location.search);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

describe("AnchorHeading", () => {
	test("links to its own id under the given accessible name", () => {
		let host = mount(
			<AnchorHeading id="install" linkLabel="Link to Install">
				Install
			</AnchorHeading>,
		);
		let heading = host.querySelector("h2")!;

		expect(heading.id).toBe("install");
		expect(link(host).getAttribute("href")).toBe("#install");
		expect(link(host).getAttribute("aria-label")).toBe("Link to Install");
	});

	test("keeps the link hidden at rest and shows it when Tab reaches it", async () => {
		let host = mount(
			<AnchorHeading id="install" linkLabel="Link to Install">
				Install
			</AnchorHeading>,
		);

		expect(getComputedStyle(link(host)).opacity).toBe("0");
		await userEvent.tab();
		expect(document.activeElement).toBe(link(host));
		await expect.poll(() => getComputedStyle(link(host)).opacity).toBe("1");
	});

	test("shows the link while the heading is hovered", async () => {
		let host = mount(
			<AnchorHeading id="install" linkLabel="Link to Install">
				Install
			</AnchorHeading>,
		);

		await userEvent.hover(host.querySelector("h2")!);
		await expect.poll(() => getComputedStyle(link(host)).opacity).toBe("1");
	});

	test("clears the scroll margin set through the custom property", () => {
		let host = mount(
			<div style="--ui-docs-scroll-margin: 72px">
				<AnchorHeading id="install" linkLabel="Link to Install">
					Install
				</AnchorHeading>
			</div>,
		);

		expect(getComputedStyle(host.querySelector("h2")!).scrollMarginTop).toBe("72px");
	});

	test("flashes when it is the URL's target, and holds still under reduced motion", async () => {
		let host = mount(
			<AnchorHeading id="install" linkLabel="Link to Install">
				Install
			</AnchorHeading>,
		);
		let heading = host.querySelector("h2")!;

		location.hash = "install";
		expect(getComputedStyle(heading).animationName).toBe("ui-anchor-heading-flash");

		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		expect(getComputedStyle(heading).animationName).toBe("none");
	});

	test("takes the HeadingScope level, and an explicit level over it", () => {
		let host = mount(
			<HeadingScope level={3}>
				<AnchorHeading id="a" linkLabel="Link to A">
					A
				</AnchorHeading>
				<AnchorHeading id="b" level={4} linkLabel="Link to B">
					B
				</AnchorHeading>
			</HeadingScope>,
		);

		expect(host.querySelector("#a")?.tagName).toBe("H3");
		expect(host.querySelector("#b")?.tagName).toBe("H4");
	});
});
