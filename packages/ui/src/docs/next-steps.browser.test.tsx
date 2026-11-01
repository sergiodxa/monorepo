/**
 * Renders the "Next steps" block in a real browser: its title is a heading at the scope's
 * level with a linkable id, every card is wholly a link, the list variant rules its rows,
 * and a 320px column never overflows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { HeadingScope } from "../components/heading-scope.js";

import { NextSteps } from "./next-steps.js";

const ITEMS: NextSteps.Item[] = [
	{ title: "Add an alert", href: "/docs/alerts", description: "Page the person on call." },
	{
		title: "Publish a status page",
		href: "/docs/status-pages",
		description: "Tell customers what is down before they ask.",
	},
	{ title: "Invite your team", href: "/docs/team", description: "Share monitors and on-call." },
];

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(() => {
	document.body.replaceChildren();
});

describe("NextSteps", () => {
	test("titles the block with an h2 by default, carrying the id a TOC links to", () => {
		let host = mount(<NextSteps title="Next steps" id="next-steps" items={ITEMS} />);
		let heading = host.querySelector('[data-slot="next-steps-title"]')!;
		let section = host.querySelector("section")!;

		expect(heading.tagName).toBe("H2");
		expect(heading.id).toBe("next-steps");
		expect(section.getAttribute("aria-labelledby")).toBe("next-steps");
	});

	test("takes the level of the surrounding HeadingScope", () => {
		let host = mount(
			<HeadingScope level={3}>
				<NextSteps title="Next steps" items={ITEMS} />
			</HeadingScope>,
		);

		expect(host.querySelector('[data-slot="next-steps-title"]')?.tagName).toBe("H3");
	});

	test("makes each whole card the link", () => {
		let host = mount(<NextSteps title="Next steps" items={ITEMS} />);
		let links = [...host.querySelectorAll<HTMLAnchorElement>('[data-slot="next-steps-link"]')];

		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/docs/alerts",
			"/docs/status-pages",
			"/docs/team",
		]);
		for (let link of links) {
			let box = link.getBoundingClientRect();
			expect(document.elementFromPoint(box.right - 3, box.bottom - 3)?.closest("a")).toBe(link);
		}
	});

	test("rules the rows of the list variant", () => {
		let host = mount(<NextSteps title="Next steps" items={ITEMS} variant="list" />);
		let row = host.querySelector("li")!;

		expect(getComputedStyle(row).borderBlockEndWidth).toBe("1px");
		expect(getComputedStyle(row.querySelector("a")!).borderBlockStartWidth).toBe("0px");
	});

	test("fits a 320px viewport in either variant", async () => {
		await page.viewport(320, 640);
		mount(<NextSteps title="Next steps" items={ITEMS} />, 288);
		mount(<NextSteps title="Next steps" items={ITEMS} variant="list" />, 288);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});
});
