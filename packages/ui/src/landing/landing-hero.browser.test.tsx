/**
 * Lays {@link LandingHero} out in a real browser at phone width: wide media below the copy
 * stays inside the band's gutter instead of widening the copy and media columns, and the
 * note under the actions wraps without a one-word last line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { LandingHero } from "./landing-hero.js";

import "../reset.css";

/**
 * Mounts `node` in a 390px column attached to the document, the width of a phone screen.
 *
 * @param node The hero to render.
 * @returns The host element.
 */
function mountPhone(node: RemixNode): HTMLElement {
	let host = document.createElement("div");
	host.style.width = "390px";
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/**
 * A media sample whose min-content is 480px, wider than a phone's content box.
 *
 * @returns The media node.
 */
function wideMedia(): RemixNode {
	return (
		<div style={{ overflow: "hidden" }}>
			<div style={{ display: "flex", gap: "16px" }}>
				<span style={{ flex: "0 0 240px" }}>Revenue</span>
				<span style={{ flex: "0 0 224px" }}>Events</span>
			</div>
		</div>
	);
}

describe("LandingHero on a phone", () => {
	test.each(["center", "start"] as const)(
		"keeps %s-aligned copy and wide media inside the band's content box",
		(align) => {
			let host = mountPhone(
				<LandingHero
					align={align}
					title="Billing for API-first companies"
					description="Meter usage, price it on any plan and send the invoice, from one API."
					media={wideMedia()}
				/>,
			);
			let section = host.querySelector<HTMLElement>("section")!;
			let style = getComputedStyle(section);
			let contentBox =
				section.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

			for (let name of ["landing-hero-copy", "landing-hero-media"]) {
				let column = host.querySelector<HTMLElement>(`[data-slot="${name}"]`)!;
				expect(column.getBoundingClientRect().width).toBeLessThanOrEqual(contentBox);
			}
			expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth);
		},
	);

	test("balances the note's lines so it never ends on one word", () => {
		let host = mountPhone(
			<LandingHero
				title="Plan the week"
				note="Free for up to four people. Also on Mac, Windows and the web."
			/>,
		);
		let note = host.querySelector<HTMLElement>('[data-slot="landing-hero-note"]')!;

		expect(getComputedStyle(note).textWrap).toContain("pretty");
	});
});
