/**
 * Lays Timeline out in a real browser: an ordered list whose rail runs through the centre
 * of every icon, a line per event, a comment card in the text column, and a "N more"
 * disclosure whose folded events open on the same rail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { Timeline } from "./timeline.js";

import "../theme.css";

/** A 16px stand-in glyph. */
function Glyph() {
	return () => (
		<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
			<circle cx="8" cy="8" r="6" fill="currentColor" />
		</svg>
	);
}

/** An incident's activity: opened, a folded run of checks, a comment, resolved. */
function Incident() {
	return () => (
		<Timeline aria-label="Activity">
			<Timeline.Event icon={<Glyph />} tone="danger" actor="Uptime" time="12m ago">
				opened the incident
			</Timeline.Event>
			<Timeline.More summary="2 more events">
				<Timeline.Event icon={<Glyph />} actor="Uptime" time="11m ago">
					checked from Frankfurt
				</Timeline.Event>
				<Timeline.Event icon={<Glyph />} actor="Uptime" time="10m ago">
					checked from Singapore
				</Timeline.Event>
			</Timeline.More>
			<Timeline.Event
				icon={<Glyph />}
				actor="Ana Souza"
				time="8m ago"
				body={<p>Rolling back the 14:02 deploy.</p>}
			>
				commented
			</Timeline.Event>
			<Timeline.Event icon={<Glyph />} tone="success" actor="Ana Souza" time="2m ago">
				resolved the incident
			</Timeline.Event>
		</Timeline>
	);
}

/** Mounts the incident timeline in a 480px host. */
function mount(): HTMLElement {
	let host = document.createElement("div");
	host.style.width = "480px";
	document.body.appendChild(host);
	render(<Incident />, { container: host });
	return host;
}

/** Horizontal centre of a box. */
function centerX(element: Element): number {
	let box = element.getBoundingClientRect();
	return box.left + box.width / 2;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("Timeline", () => {
	test("is an ordered list of events", () => {
		let host = mount();
		let list = host.querySelector("ol")!;

		expect(list.getAttribute("aria-label")).toBe("Activity");
		expect(list.querySelectorAll(":scope > li")).toHaveLength(4);
	});

	test("runs a 2px rail through the centre of every 16px icon", () => {
		let host = mount();
		let list = host.querySelector("ol")!;
		let rail = getComputedStyle(list, "::before");
		let railCenter = list.getBoundingClientRect().left + parseFloat(rail.left) + 1;

		expect(rail.width).toBe("2px");
		for (let icon of host.querySelectorAll('[data-slot="timeline-icon"]')) {
			if (icon.getClientRects().length === 0) continue;
			expect(centerX(icon)).toBeCloseTo(railCenter, 0);
			expect(icon.querySelector("svg")!.getBoundingClientRect().width).toBe(16);
		}
	});

	test("tones each icon by what happened", () => {
		document.documentElement.style.setProperty("--ui-color-danger-600", "rgb(220, 38, 38)");
		document.documentElement.style.setProperty("--ui-color-success-600", "rgb(22, 163, 74)");
		let host = mount();
		let [opened] = host.querySelectorAll<HTMLElement>('[data-slot="timeline-icon"]');
		let resolved = [...host.querySelectorAll<HTMLElement>('[data-slot="timeline-icon"]')].at(-1)!;

		expect(getComputedStyle(opened!).color).toBe("rgb(220, 38, 38)");
		expect(getComputedStyle(resolved).color).toBe("rgb(22, 163, 74)");
	});

	test("keeps each event on one line with the actor in bold", () => {
		let host = mount();
		let line = host.querySelector<HTMLElement>('[data-slot="timeline-line"]')!;
		let actor = line.querySelector('[data-slot="timeline-actor"]')!;

		expect(line.getBoundingClientRect().height).toBeLessThanOrEqual(24);
		expect(Number(getComputedStyle(actor).fontWeight)).toBeGreaterThanOrEqual(600);
	});

	test("sets a comment as a card in the text column", () => {
		let host = mount();
		let body = host.querySelector<HTMLElement>('[data-slot="timeline-body"]')!;
		let line = body.parentElement!.querySelector('[data-slot="timeline-line"]')!;

		expect(body.getBoundingClientRect().left).toBeCloseTo(line.getBoundingClientRect().left, 0);
		expect(getComputedStyle(body).borderTopWidth).toBe("1px");
	});

	test("folds quiet events behind a disclosure that opens them on the same rail", async () => {
		let host = mount();
		let details = host.querySelector("details")!;
		let summary = details.querySelector("summary")!;
		let folded = details.querySelectorAll<HTMLElement>('[data-slot="timeline-event"]');
		let first = host.querySelector('[data-slot="timeline-icon"]')!;

		expect(summary.textContent).toBe("2 more events");
		expect(folded[0]!.checkVisibility()).toBe(false);

		await userEvent.click(summary);

		expect(details.open).toBe(true);
		expect(folded[0]!.checkVisibility()).toBe(true);
		let icon = folded[0]!.querySelector('[data-slot="timeline-icon"]')!;
		expect(centerX(icon)).toBeCloseTo(centerX(first), 0);
	});
});
