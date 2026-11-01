/**
 * Lays an {@link AuthorBand} out in a real browser: the 5/7 split with the portrait and the
 * copy sharing a top edge at 1280, the portrait capped at 20rem above the copy at 375, and
 * the 16:9 video card, 44px social links and inset portrait hairline at both widths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { AuthorBand } from "./author-band.js";

import "../reset.css";
import "../theme.css";

/** A plain glyph standing in for a network icon. */
const ICON = (
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<circle cx="12" cy="12" r="9" fill="currentColor" />
	</svg>
);

/** Mounts a fully populated band in a host `width` pixels wide and returns the host. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(
		<AuthorBand
			portrait={
				<svg viewBox="0 0 300 400" role="img" aria-label="Portrait of Odile Varga">
					<rect width="300" height="400" fill="gray" />
				</svg>
			}
			eyebrow="About the author"
			title="Written by a type designer who ships code"
			description="Odile Varga has drawn typefaces for fifteen years and built design systems for ten."
			name="Odile Varga"
			jobTitle="Type designer, Lisbon"
			credentials={<p>Drew the Larch family</p>}
			social={[
				{ href: "https://example.com/odile", label: "Website", icon: ICON },
				{ href: "mailto:odile@example.com", label: "Email", icon: ICON },
			]}
			signature={
				<svg viewBox="0 0 160 48" aria-hidden="true">
					<path d="M4 40c20-30 40-30 60 0" stroke="currentColor" fill="none" />
				</svg>
			}
			video={{
				thumbnail: (
					<svg viewBox="0 0 160 90" aria-hidden="true">
						<rect width="160" height="90" fill="gray" />
					</svg>
				),
				title: "Why type is code",
				duration: "2:13",
				href: "https://example.com/video",
			}}
		/>,
		{ container: host },
	);
	return host;
}

/** The element matching `selector` inside `root`, failing the test when it is missing. */
function find<T extends Element = HTMLElement>(root: Element, selector: string): T {
	let element = root.querySelector<T>(selector);
	if (!element) throw new Error(`missing ${selector}`);
	return element;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("AuthorBand", () => {
	test("splits 5/7 at 1280 with the portrait and the copy on one top edge", () => {
		let host = mount(1280);
		let portrait = find(host, '[data-slot="author-band-portrait"]').getBoundingClientRect();
		let copy = find(host, '[data-slot="author-band-copy"]').getBoundingClientRect();

		expect(copy.left).toBeGreaterThan(portrait.right);
		expect(Math.round(copy.top)).toBe(Math.round(portrait.top));
		expect(portrait.width / copy.width).toBeCloseTo(5 / 7, 1);
		expect(portrait.height / portrait.width).toBeCloseTo(4 / 3, 2);
		expect(host.scrollWidth).toBeLessThanOrEqual(1280);
	});

	test("stacks at 375 with the portrait capped at 20rem above the copy", () => {
		let host = mount(375);
		let portrait = find(host, '[data-slot="author-band-portrait"]').getBoundingClientRect();
		let copy = find(host, '[data-slot="author-band-copy"]').getBoundingClientRect();

		expect(portrait.width).toBe(320);
		expect(Math.round(portrait.left)).toBe(Math.round(copy.left));
		expect(copy.top).toBeGreaterThan(portrait.bottom);
		expect(host.scrollWidth).toBeLessThanOrEqual(375);
		for (let element of host.querySelectorAll("*")) {
			expect(
				element.getBoundingClientRect().right,
				element.outerHTML.slice(0, 200),
			).toBeLessThanOrEqual(375 + 0.5);
		}
	});

	test.each([375, 1280])("keeps the hairline, video card and tap targets at %ipx", (width) => {
		let host = mount(width);
		let frame = getComputedStyle(find(host, '[data-slot="author-band-portrait"]'));
		expect(frame.outlineStyle).toBe("solid");
		expect(frame.outlineWidth).toBe("1px");
		expect(frame.outlineOffset).toBe("-1px");

		let card = find(host, '[data-slot="author-band-video"] a').getBoundingClientRect();
		expect(card.width / card.height).toBeCloseTo(16 / 9, 1);
		let play = find(host, '[data-slot="author-band-video-play"]').getBoundingClientRect();
		expect(play.width).toBe(56);
		expect(Math.round(play.left + play.width / 2)).toBe(Math.round(card.left + card.width / 2));
		expect(find(host, '[data-slot="author-band-video"] figcaption').textContent).toBe(
			"Why type is code (2:13)",
		);

		for (let link of host.querySelectorAll<HTMLElement>('[data-slot="author-band-social"] a')) {
			let box = link.getBoundingClientRect();
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.height).toBeGreaterThanOrEqual(44);
			expect(link.getAttribute("aria-label")).toBeTruthy();
		}

		expect(find(host, '[data-slot="author-band-signature"]').getBoundingClientRect().width).toBe(
			128,
		);
	});
});
