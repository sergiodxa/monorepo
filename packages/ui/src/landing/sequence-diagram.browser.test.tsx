/**
 * Lays out {@link SequenceDiagram} in a real browser: one list item per message, each
 * arrow running between its two lifelines' centres in either direction, labels wrapping
 * inside a 280px card clear of the pause toggle, and held still under reduced motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import { SequenceDiagram } from "./sequence-diagram.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	await page.viewport(414, 896);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
});

/** The three parties of a PKCE sign-in. */
const ACTORS: SequenceDiagram.Actor[] = [
	{ name: "Browser" },
	{ name: "Your app" },
	{ name: "Authorization Server" },
];

/** A PKCE sign-in, with arrows both ways, one spanning all three columns, and a note. */
const MESSAGES: SequenceDiagram.Message[] = [
	{ from: 0, to: 1, label: "Open the sign-in page" },
	{ from: 1, to: 1, label: "Make a code verifier" },
	{ from: 1, to: 0, label: "Redirect to authorize", code: "302 /authorize?code_challenge=…" },
	{ from: 0, to: 2, label: "Sign in and consent" },
	{ from: 2, to: 1, label: "Return an authorization code", code: "GET /callback?code=…" },
];

/** Mounts a diagram of `messages` in a `width`-pixel column, in writing direction `dir`. */
function mount(
	messages: readonly SequenceDiagram.Message[] = MESSAGES,
	width = 280,
	dir: "ltr" | "rtl" = "ltr",
): HTMLElement {
	let host = document.createElement("div");
	host.dir = dir;
	host.style.cssText = `inline-size: ${width}px; container-type: inline-size`;
	document.body.appendChild(host);
	mounted = render(
		<SequenceDiagram
			aria-label="A PKCE sign-in"
			actors={ACTORS}
			messages={messages}
			outcome="Signed in"
			footnote="No client secret in the browser"
		/>,
		{ container: host },
	);
	return host;
}

/** Whether two boxes share any area. */
function overlaps(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Horizontal centre of each lifeline, left to right. */
function lifelineCentres(host: HTMLElement): number[] {
	return [...host.querySelectorAll('[data-slot="sequence-diagram-lifeline"]')].map((line) => {
		let box = line.getBoundingClientRect();
		return box.left + box.width / 2;
	});
}

describe("SequenceDiagram", () => {
	test("lists every message under the list's name, naming sender and receiver", () => {
		let host = mount();
		let list = host.querySelector("ol")!;
		expect(list.getAttribute("aria-label")).toBe("A PKCE sign-in");
		expect(list.children).toHaveLength(MESSAGES.length);
		expect(list.children[0]!.textContent).toContain("Browser → Your app");
		expect(host.querySelectorAll('[data-slot="sequence-diagram-lifeline"]')).toHaveLength(3);
		expect(host.textContent).toContain("Signed in");
		expect(host.textContent).toContain("No client secret in the browser");
	});

	test("runs each arrow from the sender's lifeline centre to the receiver's", () => {
		for (let width of [280, 520]) {
			let host = mount(MESSAGES, width);
			let centres = lifelineCentres(host);
			let rows = [...host.querySelectorAll("ol > li")];
			let directions: string[] = [];
			MESSAGES.forEach((message, index) => {
				let arrow = rows[index]!.querySelector<HTMLElement>('[data-slot="sequence-diagram-arrow"]');
				if (message.from === message.to) {
					expect(arrow).toBeNull();
					return;
				}
				let box = arrow!.getBoundingClientRect();
				let [start, end] = [centres[message.from]!, centres[message.to]!];
				expect(Math.abs(box.left - Math.min(start, end))).toBeLessThanOrEqual(2);
				expect(Math.abs(box.right - Math.max(start, end))).toBeLessThanOrEqual(2);
				directions.push(arrow!.dataset.direction!);
			});
			expect(directions).toEqual(["end", "start", "end", "start"]);
			mounted?.cleanup();
			host.remove();
		}
	});

	test("mirrors every arrow on a right-to-left page", () => {
		let host = mount(MESSAGES, 320, "rtl");
		let centres = lifelineCentres(host);
		expect(centres[0]!).toBeGreaterThan(centres[2]!);
		let rows = [...host.querySelectorAll("ol > li")];
		MESSAGES.forEach((message, index) => {
			let arrow = rows[index]!.querySelector<HTMLElement>('[data-slot="sequence-diagram-arrow"]');
			if (arrow === null) return;
			let [sender, receiver] = [centres[message.from]!, centres[message.to]!];
			let box = arrow.getBoundingClientRect();
			expect(Math.abs(box.left - Math.min(sender, receiver))).toBeLessThanOrEqual(2);
			expect(Math.abs(box.right - Math.max(sender, receiver))).toBeLessThanOrEqual(2);

			let head = arrow.querySelector("svg")!;
			let headBox = head.getBoundingClientRect();
			let headCentre = headBox.left + headBox.width / 2;
			expect(Math.abs(headCentre - receiver)).toBeLessThan(Math.abs(headCentre - sender));
			let pointsRight = getComputedStyle(head).transform === "none";
			expect(pointsRight).toBe(receiver > sender);

			let shaft = arrow.querySelector("span")!;
			let growsFromLeft = getComputedStyle(shaft).transformOrigin.startsWith("0px");
			expect(growsFromLeft).toBe(sender < receiver);
		});
	});

	test("draws each arrow out from the sender's side", () => {
		let host = mount();
		let shafts = [...host.querySelectorAll('[data-slot="sequence-diagram-arrow"] > span')];
		expect(getComputedStyle(shafts[0]!).transformOrigin.startsWith("0px")).toBe(true);
		expect(getComputedStyle(shafts[1]!).transformOrigin.startsWith("0px")).toBe(false);
	});

	test("centres a note to self on its lifeline", () => {
		let host = mount();
		let note = host.querySelector('[data-slot="sequence-diagram-note"]')!.getBoundingClientRect();
		expect(Math.abs(note.left + note.width / 2 - lifelineCentres(host)[1]!)).toBeLessThanOrEqual(2);
	});

	test("wraps labels inside the card at 280px", () => {
		let host = mount();
		let card = host.querySelector('[data-slot="sequence-diagram"]')!;
		expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
		expect(host.scrollWidth).toBeLessThanOrEqual(280);
		for (let cell of host.querySelectorAll('[data-slot="sequence-diagram-message"] > *')) {
			let box = cell.getBoundingClientRect();
			let bounds = card.getBoundingClientRect();
			expect(box.left).toBeGreaterThanOrEqual(bounds.left);
			expect(box.right).toBeLessThanOrEqual(bounds.right);
		}
	});

	/**
	 * Swept across phone widths, because whether an actor name reaches the toggle depends
	 * on where its words wrap.
	 */
	test("keeps every text clear of the pause toggle at every phone width", async () => {
		let hits: number[] = [];
		for (let width = 260; width <= 420; width += 4) {
			await page.viewport(width, 900);
			mounted = render(
				<div style={{ padding: "0 16px" }}>
					<SequenceDiagram aria-label="A PKCE sign-in" actors={ACTORS} messages={MESSAGES} />
				</div>,
			);
			let toggle = mounted.$('[data-slot="motion-loop"] > :last-child')!.getBoundingClientRect();
			let walker = document.createTreeWalker(
				mounted.$('[data-slot="sequence-diagram"]')!,
				NodeFilter.SHOW_TEXT,
			);
			while (walker.nextNode()) {
				let range = document.createRange();
				range.selectNodeContents(walker.currentNode);
				if ([...range.getClientRects()].some((line) => overlaps(line, toggle))) hits.push(width);
			}
			mounted.cleanup();
			mounted = undefined;
		}

		expect(hits).toEqual([]);
	});

	test("animates exchanges of different lengths on separate keyframes", () => {
		let five = mount();
		let two = mount(MESSAGES.slice(0, 2));
		let firstShaft = (root: HTMLElement) =>
			getComputedStyle(root.querySelector('[data-slot="sequence-diagram-arrow"] > span')!)
				.animationName;
		expect(firstShaft(five)).toMatch(/^ui-sequence-diagram-arrow-5-0/);
		expect(firstShaft(five)).not.toBe(firstShaft(two));
	});

	/**
	 * Seeks every animation to a moment inside the reset, when the arrows clear for the next
	 * loop. A shaft that shrank there while its head still showed read as a broken arrow.
	 */
	test("keeps each shaft joined to its head while the loop resets", () => {
		let host = mount(MESSAGES, 520);
		for (let animation of document.getAnimations()) animation.currentTime = 9_450;
		for (let arrow of host.querySelectorAll('[data-slot="sequence-diagram-arrow"]')) {
			let track = arrow.getBoundingClientRect();
			let shaft = arrow.querySelector("span")!;
			let head = arrow.querySelector("svg")!;
			expect(Math.round(shaft.getBoundingClientRect().width)).toBe(Math.round(track.width));
			expect(getComputedStyle(shaft).opacity).toBe(getComputedStyle(head).opacity);
		}
	});

	test("holds the finished exchange still under reduced motion", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		let host = mount();
		let animated = [...host.querySelectorAll("*")].filter(
			(element) => getComputedStyle(element).animationName !== "none",
		);
		expect(animated).toEqual([]);
		let shaft = host.querySelector('[data-slot="sequence-diagram-arrow"] > span')!;
		expect(getComputedStyle(shaft).transform).toBe("none");
		let badge = host.querySelector('[data-slot="sequence-diagram-outcome"]')!;
		expect(getComputedStyle(badge).opacity).toBe("1");
	});
});
