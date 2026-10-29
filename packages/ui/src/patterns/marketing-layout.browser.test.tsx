/**
 * Lays the marketing bands out in a real browser and checks the geometry and color a visitor
 * sees: proof figures keep their own tracks, eyebrows keep their own width, a stacked FAQ
 * reads as one list, and an inverse band's heading stays legible.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { Accordion } from "../components/accordion.js";
import { MarketingHeader } from "../components/marketing-header.js";
import { StatStrip } from "../components/stat-strip.js";

import { ClosingCta } from "./closing-cta.js";
import { FaqBand } from "./faq-band.js";
import { LandingHero } from "./landing-hero.js";
import { ProofStrip } from "./proof-strip.js";

/**
 * Mounts a band in a 720px-wide column attached to the document, so it gets real layout,
 * with the neutral tokens a band reads set to distinct light-scheme values.
 */
function mount(node: RemixNode): HTMLElement {
	let host = document.createElement("div");
	host.style.width = "720px";
	host.style.setProperty("--ui-neutral-fg-emphasis", "rgb(20, 20, 30)");
	host.style.setProperty("--ui-neutral-fg-on-solid", "rgb(255, 255, 255)");
	host.style.setProperty("--ui-neutral-bg-solid", "rgb(20, 20, 30)");
	document.body.appendChild(host);
	return render(node, { container: host }).container;
}

/** One FAQ entry, as a page would pass it to the band. */
function question(text: string): RemixNode {
	return (
		<Accordion.Item>
			<Accordion.Trigger>{text}</Accordion.Trigger>
			<Accordion.Content>
				<p>Answer</p>
			</Accordion.Content>
		</Accordion.Item>
	);
}

describe("marketing layout", () => {
	test("a stat strip inside a proof strip gives every figure its own track", () => {
		let root = mount(
			<ProofStrip>
				<StatStrip>
					<StatStrip.Item label="Packages">80+</StatStrip.Item>
					<StatStrip.Item label="Patterns">5</StatStrip.Item>
				</StatStrip>
			</ProofStrip>,
		);
		let [first, second] = [...root.querySelectorAll('[data-slot="stat-strip-item"]')].map((item) =>
			item.getBoundingClientRect(),
		);

		let strip = root.querySelector('[data-slot="stat-strip"]')!;

		expect(strip.getBoundingClientRect().width).toBe(
			strip.parentElement!.getBoundingClientRect().width,
		);
		expect(second!.left).toBeGreaterThanOrEqual(first!.right);
	});

	test("an eyebrow keeps its own width beside a start-aligned title", () => {
		let root = mount(
			<>
				<MarketingHeader eyebrow="New">Title</MarketingHeader>
				<LandingHero eyebrow="Patterns" title="Title" />
			</>,
		);

		for (let eyebrow of root.querySelectorAll("span[data-variant]")) {
			expect(eyebrow.getBoundingClientRect().width).toBeLessThan(200);
		}
	});

	test("a two-column FAQ stacked in a narrow band reads as one continuous list", () => {
		let root = mount(
			<FaqBand title="Questions" columns={2}>
				<Accordion>{question("One")}</Accordion>
				<Accordion>{question("Two")}</Accordion>
			</FaqBand>,
		);
		let [first, second] = [...root.querySelectorAll("[data-columns] > div > *")].map((column) =>
			column.getBoundingClientRect(),
		);

		expect(second!.top).toBe(first!.bottom);
	});

	test("an inverse closing band draws its heading in the on-solid color", () => {
		let root = mount(<ClosingCta title="Ready?" description="Lead" />);
		let section = root.querySelector('[data-tone="inverse"]')!;
		let heading = root.querySelector("h1, h2")!;

		expect(getComputedStyle(heading).color).toBe(getComputedStyle(section).color);
		expect(getComputedStyle(heading).color).not.toBe(getComputedStyle(section).backgroundColor);
	});
});
