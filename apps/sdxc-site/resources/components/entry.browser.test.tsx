/**
 * Lays a reference page's body out in a real browser: every section heading inside the
 * entry's content keeps the article's gap from the block before it, at desktop and phone
 * widths, so marking the body for parsers never collapses the space between sections.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { vstack } from "@sdxc/u/layout";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { EntryContent } from "~/resources/components/entry";
import ReferenceSection from "~/resources/components/reference-section";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** The article's own gap between its header and body, `vstack({ gap: 10 })`, in pixels. */
const SECTION_GAP = 40;

afterEach(() => {
	document.body.replaceChildren();
});

/** Mounts a header, a preview box and three titled sections, the way a component page does. */
function mountPage() {
	let host = document.createElement("div");
	document.body.appendChild(host);
	render(
		<article mix={[vstack({ gap: 10, align: "stretch" })]}>
			<header>
				<h1>Amount</h1>
			</header>
			<EntryContent>
				<div data-testid="preview" style={{ blockSize: "12rem" }}>
					View code
				</div>
				<ReferenceSection id="installation" title="Installation">
					<pre>npm add @sdxc/ui remix</pre>
				</ReferenceSection>
				<ReferenceSection id="usage" title="Usage">
					<pre>{`<Amount value={1200} currency="USD" />`}</pre>
				</ReferenceSection>
				<ReferenceSection id="examples" title="Examples">
					<p>An amount in another currency.</p>
				</ReferenceSection>
			</EntryContent>
		</article>,
		{ container: host },
	);
	return host;
}

/** The space between each section's heading and the bottom of the block above its section. */
function headingGaps(host: HTMLElement): number[] {
	return [...host.querySelectorAll("h2")].map((heading) => {
		let section = heading.closest("section")!;
		let before = section.previousElementSibling!;
		return heading.getBoundingClientRect().top - before.getBoundingClientRect().bottom;
	});
}

describe("EntryContent", () => {
	test.each([
		[1440, 900],
		[375, 812],
	])("keeps the article's gap above every section heading at %ipx", async (width, height) => {
		await page.viewport(width, height);
		let gaps = headingGaps(mountPage());

		expect(gaps).toHaveLength(3);
		for (let gap of gaps) expect(gap).toBeCloseTo(SECTION_GAP, 0);
	});

	test("marks the body as the entry's content for a microformats parser", () => {
		let host = mountPage();

		expect(host.querySelector(".e-content")?.querySelectorAll("section")).toHaveLength(3);
	});
});
