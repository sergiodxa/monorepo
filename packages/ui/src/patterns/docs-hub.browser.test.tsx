/**
 * Lays a {@link DocsHub} out in a real browser: whole cards are links, start cards draw
 * larger than section cards, the outline reads h1 → h2 → h3 (and follows a scope), the
 * grids fill a wide column, and nothing overflows at 320.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { HeadingScope } from "../components/heading-scope.js";

import { DocsHub } from "./docs-hub.js";

import "../reset.css";
import "../theme.css";

/** A hub as an app would fill it: two start cards, chips, five sections and popular articles. */
const HUB = (
	<DocsHub
		eyebrow="Documentation"
		title="How can we help?"
		lead="Set up monitors, route alerts to the right person and publish a status page."
		search={<input type="search" aria-label="Search the docs" style="inline-size: 100%" />}
		labels={{
			start: "Start here",
			sections: "Browse by topic",
			topics: "Popular topics",
			popular: "Popular articles",
		}}
		formatCount={(count) => `${count} pages`}
		start={[
			{
				eyebrow: "Quickstart",
				title: "Add your first monitor",
				href: "/docs/quickstart",
				description: "Paste a URL and get paged the first time it stops answering.",
				cta: "Read the guide",
			},
			{
				title: "API overview",
				href: "/docs/api/overview",
				description: "Authenticate and create monitors from code.",
			},
		]}
		topics={[
			{ title: "SMS alerts", href: "/docs/alerts/sms" },
			{ title: "Custom domains", href: "/docs/status-pages/domains" },
		]}
		sections={[
			{ title: "Monitors", href: "/docs/monitors", description: "What gets checked.", count: 9 },
			{ title: "Alerts", href: "/docs/alerts", description: "Who gets paged.", count: 6 },
			{
				title: "Status pages",
				href: "/docs/status-pages",
				description: "Tell customers.",
				count: 1,
				countLabel: "1 page",
			},
			{ title: "Teams", href: "/docs/teams", description: "Invite people." },
			{ title: "API", href: "/docs/api", description: "Every endpoint.", count: 24 },
		]}
		popular={[
			{ title: "Why did I get an alert while my site is up?", href: "/docs/false-alerts" },
			{
				title: "Change how often a monitor runs",
				href: "/docs/monitors/interval",
				image: <svg viewBox="0 0 160 90" aria-hidden="true" />,
			},
		]}
	/>
);

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(width: number, node: JSX.Element = HUB): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** Every element matching `selector` inside `root`. */
function all(root: Element, selector: string): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(selector));
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("DocsHub", () => {
	test("makes every start, section and popular card one link holding its title", () => {
		let host = mount(1100);
		let cards = all(
			host,
			'[data-slot="docs-hub-start-card"], [data-slot="docs-hub-section-card"], [data-slot="docs-hub-popular-card"]',
		);
		expect(cards).toHaveLength(9);
		for (let card of cards) {
			expect(card.tagName).toBe("A");
			expect(card.getAttribute("href")).toMatch(/^\/docs\//);
			expect(card.querySelector("a")).toBeNull();
		}
		let section = all(host, '[data-slot="docs-hub-section-card"]')[0]!;
		let li = section.parentElement!.getBoundingClientRect();
		let box = section.getBoundingClientRect();
		expect(box.width).toBeCloseTo(li.width, 0);
		expect(box.height).toBeCloseTo(li.height, 0);
	});

	test("draws start cards larger than section cards", () => {
		let host = mount(1100);
		let start = all(host, '[data-slot="docs-hub-start-card"]')[1]!;
		let section = all(host, '[data-slot="docs-hub-section-card"]')[0]!;
		expect(start.getBoundingClientRect().height).toBeGreaterThan(
			section.getBoundingClientRect().height,
		);
		expect(start.getBoundingClientRect().width).toBeGreaterThan(
			section.getBoundingClientRect().width,
		);
		let startTitle = parseFloat(
			getComputedStyle(host.querySelector('[data-slot="docs-hub-start-title"]')!).fontSize,
		);
		let sectionTitle = parseFloat(
			getComputedStyle(host.querySelector('[data-slot="docs-hub-section-title"]')!).fontSize,
		);
		expect(startTitle).toBeGreaterThan(sectionTitle);
	});

	test("outlines h1 for the title, h2 per block and h3 per card", () => {
		let host = mount(1100);
		let levels = all(host, "h1, h2, h3, h4, h5, h6").map((heading) => heading.tagName);
		expect(levels).toEqual(["H1", "H2", "H3", "H3", "H2", "H3", "H3", "H3", "H3", "H3", "H2"]);
		expect(host.querySelector("h1")!.textContent).toBe("How can we help?");
	});

	test("follows a HeadingScope around it", () => {
		let host = mount(
			1100,
			<HeadingScope level={2}>
				<DocsHub
					title="Docs"
					labels={{ start: "Start here", sections: "Topics" }}
					start={[{ title: "Quickstart", href: "/q", description: "Begin." }]}
					sections={[{ title: "Alerts", href: "/a", description: "Paging." }]}
				/>
			</HeadingScope>,
		);
		let levels = all(host, "h1, h2, h3, h4, h5, h6").map((heading) => heading.tagName);
		expect(levels).toEqual(["H2", "H3", "H4", "H3", "H4"]);
	});

	test("words counts through countLabel, then formatCount, and leaves a missing count out", () => {
		let host = mount(1100);
		let counts = all(host, '[data-slot="docs-hub-count"]').map((count) => count.textContent);
		expect(counts).toEqual(["9 pages", "6 pages", "1 page", "24 pages"]);
	});

	test("fills a wide column with section cards, leaving no dead column on the right", () => {
		let host = mount(1100);
		let hostBox = host.getBoundingClientRect();
		let sections = all(host, '[data-slot="docs-hub-section-card"]');
		let rightmost = Math.max(...sections.map((card) => card.getBoundingClientRect().right));
		expect(hostBox.right - rightmost).toBeLessThan(2);
		let starts = all(host, '[data-slot="docs-hub-start-card"]');
		let startRight = Math.max(...starts.map((card) => card.getBoundingClientRect().right));
		expect(hostBox.right - startRight).toBeLessThan(2);
		expect(starts[0]!.getBoundingClientRect().top).toBeCloseTo(
			starts[1]!.getBoundingClientRect().top,
			0,
		);
	});

	test("stacks every card in one column at 320 with nothing wider than the page", () => {
		let host = mount(320);
		let hostBox = host.getBoundingClientRect();
		expect(host.scrollWidth).toBeLessThanOrEqual(320);
		for (let element of all(host, "*")) {
			expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(hostBox.right + 0.5);
		}
		let cards = all(host, '[data-slot="docs-hub-section-card"]');
		for (let card of cards) {
			expect(card.getBoundingClientRect().width).toBeCloseTo(hostBox.width, 0);
		}
	});

	test("names the topic chips' navigation and keeps each chip a 36px target", () => {
		let host = mount(1100);
		let nav = host.querySelector('[data-slot="docs-hub-topics"]')!;
		expect(nav.tagName).toBe("NAV");
		expect(nav.getAttribute("aria-label")).toBe("Popular topics");
		for (let chip of all(host, '[data-slot="docs-hub-topic"]')) {
			expect(chip.getBoundingClientRect().height).toBeGreaterThanOrEqual(36);
		}
	});
});
