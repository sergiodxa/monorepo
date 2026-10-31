/**
 * Tests the documentation pieces against the real layout engine: the "On this page" mark
 * follows a jump and the page's end, a fence naming no language draws no empty header, the
 * hub's start cards line up their calls, and the trail never breaks a step in two.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { docsMarkdownComponents } from "~/resources/components/docs-markdown";
import DocsStartCard from "~/resources/components/docs-start-card";
import DocsToc from "~/resources/components/docs-toc";
import DocsTrail from "~/resources/components/docs-trail";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** The labels every markdown component draws with. */
const LABELS = {
	copy: "Copy",
	copied: "Copied",
	alerts: {
		note: "Note",
		tip: "Tip",
		important: "Important",
		warning: "Warning",
		caution: "Caution",
	},
};

/** A page's headings, the last two in a tail too short to reach the reading band. */
const ANCHORS = [
	{ id: "first", text: "First step", level: 2 },
	{ id: "second", text: "Second step", level: 2 },
	{ id: "third", text: "Third step", level: 2 },
	{ id: "help", text: "Need help?", level: 2 },
];

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	window.scrollTo(0, 0);
	await page.viewport(414, 896);
});

/** Resolves once the scroll listener's frame and any observer callbacks have run. */
async function settle() {
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	await new Promise((resolve) => setTimeout(resolve, 50));
}

/** The rail's link carrying the lead mark. */
function lead(): string | undefined {
	return mounted!.$('a[data-active="lead"]')?.textContent ?? undefined;
}

describe("DocsToc", () => {
	/** A page whose sections are tall, closed by two short ones the band never reaches. */
	function mountPage() {
		mounted = render(
			<div>
				<DocsToc anchors={ANCHORS} label="On this page" />
				<h2 id="first" style={{ marginBlock: "120vh 0" }}>
					First step
				</h2>
				<h2 id="second" style={{ marginBlock: "120vh 0" }}>
					Second step
				</h2>
				<h2 id="third" style={{ marginBlock: "120vh 0" }}>
					Third step
				</h2>
				<h2 id="help" style={{ marginBlock: "2rem 0" }}>
					Need help?
				</h2>
				<p style={{ marginBlock: "2rem 0" }}>The end.</p>
			</div>,
		);
	}

	test("marks the last section once the page cannot scroll further", async () => {
		await page.viewport(1280, 800);
		mountPage();
		await settle();

		window.scrollTo(0, document.documentElement.scrollHeight);
		await settle();

		expect(lead()).toBe("Need help?");
	});

	test("follows a jump that carries every heading past the band at once", async () => {
		await page.viewport(1280, 800);
		mountPage();
		await settle();

		let second = document.getElementById("second")!;
		window.scrollTo(0, second.getBoundingClientRect().top + window.scrollY + 300);
		await settle();

		expect(lead()).toBe("Second step");

		window.scrollTo(0, 0);
		await settle();

		expect(lead()).toBe("First step");
	});

	test("wraps a long heading in the rail so its whole title stays readable", async () => {
		await page.viewport(1280, 800);
		mounted = render(
			<div style={{ inlineSize: "13rem" }}>
				<DocsToc
					anchors={[
						{ id: "a", text: "Step 1: Create Your First HTTP Monitor", level: 2 },
						{ id: "b", text: "Next", level: 2 },
					]}
					label="On this page"
				/>
			</div>,
		);

		let link = mounted.$('a[href="#a"]') as HTMLElement;

		expect(link.scrollWidth).toBeLessThanOrEqual(link.clientWidth);
		expect(link.getBoundingClientRect().height).toBeGreaterThan(30);
	});

	test("names only the list in the phone bar where the section would show a letter or two", async () => {
		await page.viewport(320, 700);
		mounted = render(
			<div style={{ display: "flex" }}>
				<DocsToc anchors={ANCHORS} label="On this page" layout="bar" />
				{ANCHORS.map((anchor) => (
					<h2 key={anchor.id} id={anchor.id}>
						{anchor.text}
					</h2>
				))}
			</div>,
		);
		await settle();

		let reading = mounted.$('[data-slot="docs-toc-reading"]') as HTMLElement;

		expect(getComputedStyle(reading).display).toBe("none");

		await page.viewport(414, 700);

		expect(getComputedStyle(reading).display).not.toBe("none");
	});
});

describe("docs code blocks", () => {
	/** The fence component, typed by the props a markdown code node arrives with. */
	let DocsCode = docsMarkdownComponents(LABELS).code as (
		handle: Handle<{ content: string; language?: string }>,
	) => () => RemixNode;

	test("draws a fence naming no language without an empty header", async () => {
		await page.viewport(375, 800);
		mounted = render(<DocsCode content="GET /api/v1/monitors/some-rather-long-identifier-0123" />);

		let figure = mounted.$('[data-slot="docs-code"]') as HTMLElement;
		let button = figure.querySelector("button")!.getBoundingClientRect();
		let pre = figure.querySelector("pre")!;
		let contentEnd =
			pre.getBoundingClientRect().right - parseFloat(getComputedStyle(pre).paddingInlineEnd);

		expect(figure.querySelector("figcaption")).toBeNull();
		expect(contentEnd).toBeLessThanOrEqual(button.left);
		expect(button.right).toBeLessThanOrEqual(figure.getBoundingClientRect().right);
	});

	test("keeps the header naming a fence's language", async () => {
		mounted = render(<DocsCode content="curl https://uptime.dev" language="bash" />);

		expect(mounted.$("figcaption")?.textContent).toContain("bash");
	});
});

describe("DocsStartCard", () => {
	test("lines up the calls of a row whatever the summaries' lengths", async () => {
		await page.viewport(1280, 800);
		mounted = render(
			<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 20rem)", gap: "0.75rem" }}>
				<DocsStartCard
					href="/a"
					section="Getting Started"
					title="Quick Start Guide"
					description="A summary long enough to wrap over three lines inside a card of this width, so it runs well past its neighbour."
					cta="Read the guide"
				/>
				<DocsStartCard
					href="/b"
					section="API"
					title="API Overview"
					description="Short."
					cta="Read the guide"
				/>
			</div>,
		);

		let [first, second] = [...mounted.$$('[data-slot="docs-start-cta"]')].map(
			(cta) => cta.getBoundingClientRect().bottom,
		);

		expect(first).toBe(second);
	});
});

describe("DocsTrail", () => {
	/** The trail of a page filed under a two-word section. */
	function mountTrail() {
		mounted = render(
			<div style={{ inlineSize: "18rem" }}>
				<DocsTrail
					label="Breadcrumb"
					root={{ label: "Docs", href: "/docs" }}
					section="Getting Started"
					page="Quick Start Guide"
				/>
			</div>,
		);
	}

	test("keeps every step on one line", async () => {
		await page.viewport(768, 800);
		mountTrail();

		for (let item of mounted!.$$("li")) {
			let lines = item.getClientRects().length;
			let height = item.getBoundingClientRect().height;
			expect(lines).toBe(1);
			expect(height).toBeLessThan(32);
		}
	});

	test("leaves the page's own step to the title on a phone", async () => {
		await page.viewport(320, 700);
		mountTrail();

		let current = mounted!.$('[aria-current="page"]')!.closest("li") as HTMLElement;

		expect(getComputedStyle(current).display).toBe("none");

		await page.viewport(768, 900);

		expect(getComputedStyle(current).display).not.toBe("none");
	});
});
