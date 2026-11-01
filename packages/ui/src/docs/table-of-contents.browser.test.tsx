/**
 * Tests for {@link TableOfContents} in a real browser: the marker reaches the last section
 * at the bottom of the page, follows a jump, stays inside a short scrolling rail, and the
 * bar names the section being read and closes once one of its links is followed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { sectionsInView } from "./mixins/toc-spy.js";
import { TableOfContents } from "./table-of-contents.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
	scrollTo(0, 0);
});

/** Twelve sections, the last one short, so its heading never reaches the top of the screen. */
const ITEMS: TableOfContents.Item[] = Array.from({ length: 12 }, (_, index) => ({
	id: `section-${index + 1}`,
	text: `Section ${index + 1}`,
	level: index % 3 === 2 ? 3 : 2,
}));

/** Waits two frames, so a scroll's recount has run. */
function settle(): Promise<void> {
	return new Promise((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
}

/** Mounts a long article with the list beside it, the rail capped at `railHeight`. */
function mountPage(layout: "rail" | "bar" = "rail", railHeight = "auto") {
	mounted = render(
		<div>
			<div
				id="rail"
				style={`position: fixed; inset-block-start: 0; inset-inline-end: 0; inline-size: 200px; max-block-size: ${railHeight}; overflow-y: auto`}
			>
				<TableOfContents items={ITEMS} label="On this page" layout={layout} />
			</div>
			<article style="inline-size: 400px">
				{ITEMS.map((item, index) => (
					<section key={item.id}>
						<h2 id={item.id} style="margin: 0">
							{item.text}
						</h2>
						<p style={`margin: 0; block-size: ${index === ITEMS.length - 1 ? 80 : 600}px`}>Body</p>
					</section>
				))}
			</article>
		</div>,
	);
}

/** The list's links by `data-active` value. */
function marks() {
	let links = [...document.querySelectorAll<HTMLAnchorElement>("[data-toc] a")];
	return {
		lead: links.find((link) => link.dataset.active === "lead")?.textContent,
		active: links
			.filter((link) => link.dataset.active !== undefined)
			.map((link) => link.textContent),
	};
}

describe("TableOfContents", () => {
	test("renders nothing under minItems", () => {
		mounted = render(<TableOfContents items={ITEMS.slice(0, 1)} label="On this page" />);
		expect(document.querySelector("nav")).toBeNull();
	});

	test("names its landmark and keeps plain anchors", () => {
		mountPage();
		let nav = document.querySelector('nav[aria-label="On this page"]');
		expect(nav).not.toBeNull();
		expect(nav!.querySelectorAll('a[href^="#section-"]')).toHaveLength(ITEMS.length);
	});

	test("marks the first section at the top and every section on screen", async () => {
		mountPage();
		await settle();
		let { lead, active } = marks();
		expect(lead).toBe("Section 1");
		expect(active.length).toBeGreaterThanOrEqual(1);
		expect(active[0]).toBe("Section 1");
	});

	test("marks the last section at the bottom of the page", async () => {
		mountPage();
		scrollTo(0, document.documentElement.scrollHeight);
		await settle();
		expect(marks().active).toContain(`Section ${ITEMS.length}`);
	});

	test("follows a jump to a heading", async () => {
		mountPage();
		document.getElementById("section-6")!.scrollIntoView();
		await settle();
		expect(marks().lead).toBe("Section 6");
	});

	test("stretches the marker over the marked links once placed", async () => {
		mountPage();
		document.getElementById("section-4")!.scrollIntoView();
		await settle();
		let marker = document.querySelector<HTMLElement>("[data-toc-marker]")!;
		let lead = document.querySelector<HTMLElement>('[data-active="lead"]')!;
		await new Promise((resolve) => setTimeout(resolve, 350));
		let markerBox = marker.getBoundingClientRect();
		expect(getComputedStyle(marker).opacity).toBe("1");
		expect(markerBox.height).toBeGreaterThan(0);
		expect(Math.abs(markerBox.top - lead.getBoundingClientRect().top)).toBeLessThan(1);
	});

	test("keeps the lead link inside a rail shorter than the list", async () => {
		mountPage("rail", "120px");
		scrollTo(0, document.documentElement.scrollHeight);
		await settle();
		let rail = document.getElementById("rail")!.getBoundingClientRect();
		let lead = document.querySelector<HTMLElement>('[data-active="lead"]')!.getBoundingClientRect();
		expect(lead.top).toBeGreaterThanOrEqual(rail.top);
		expect(lead.bottom).toBeLessThanOrEqual(rail.bottom);
	});

	test("bar names the section being read and fills its ring", async () => {
		mountPage("bar");
		document.getElementById("section-3")!.scrollIntoView();
		await settle();
		let bar = document.querySelector<HTMLDetailsElement>('[data-toc="bar"]')!;
		expect(bar.querySelector("[data-toc-reading]")!.textContent).toBe("Section 3");
		expect(Number(bar.style.getPropertyValue("--toc-progress"))).toBeCloseTo(3 / ITEMS.length);
	});

	test("bar closes once a link inside it is followed", async () => {
		mountPage("bar");
		let bar = document.querySelector<HTMLDetailsElement>('[data-toc="bar"]')!;
		bar.open = true;
		bar.querySelector<HTMLAnchorElement>('a[href="#section-5"]')!.click();
		expect(bar.open).toBe(false);
	});
});

/**
 * Replaces the article the way a client-side navigation does: new heading elements under
 * the same ids, the list kept in place with one link pointing somewhere new.
 */
function navigate() {
	let article = document.querySelector("article")!;
	article.innerHTML = ITEMS.map(
		(item, index) =>
			`<section><h2 id="${index === 1 ? "renamed" : item.id}" style="margin: 0">${item.text}</h2><p style="margin: 0; block-size: 600px">New body</p></section>`,
	).join("");
	for (let link of document.querySelectorAll<HTMLAnchorElement>(
		'[data-toc] a[href="#section-2"]',
	)) {
		link.setAttribute("href", "#renamed");
		link.textContent = "Renamed";
	}
}

describe("TableOfContents after a client-side navigation", () => {
	test("marks the new page's sections and keeps the marker drawn", async () => {
		mountPage();
		document.getElementById("section-4")!.scrollIntoView();
		await settle();
		expect(marks().lead).toBe("Section 4");

		navigate();
		document.getElementById("renamed")!.scrollIntoView();
		await settle();
		expect(marks().lead).toBe("Renamed");
		let marker = document.querySelector<HTMLElement>("[data-toc-marker]")!;
		expect(Number.parseFloat(marker.style.getPropertyValue("--toc-marker-size"))).toBeGreaterThan(
			0,
		);
	});

	test("refills the bar's ring and names the new page's section", async () => {
		mountPage("bar");
		scrollTo(0, document.documentElement.scrollHeight);
		await settle();
		let bar = document.querySelector<HTMLDetailsElement>('[data-toc="bar"]')!;
		let atBottom = Number(bar.style.getPropertyValue("--toc-progress"));
		expect(atBottom).toBeGreaterThan(0.5);

		navigate();
		scrollTo(0, 0);
		await settle();
		expect(Number(bar.style.getPropertyValue("--toc-progress"))).toBeLessThan(atBottom);
		expect(bar.querySelector("[data-toc-reading]")!.textContent).toBe("Section 1");
	});
});

describe("sectionsInView", () => {
	test("counts a section whose heading has scrolled past while its body fills the screen", () => {
		expect(sectionsInView([-500, 900], { top: 0, bottom: 800 }, false)).toEqual([0]);
	});

	test("credits the last section at the bottom even below the fold", () => {
		expect(sectionsInView([-900, -100, 820], { top: 0, bottom: 800 }, true)).toEqual([1, 2]);
	});
});
