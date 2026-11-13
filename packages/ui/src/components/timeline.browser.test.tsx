/**
 * Lays Timeline out in a real browser: an ordered list whose rail runs through the centre
 * of every icon, a line per event, a comment card in the text column, and a "N more"
 * disclosure whose folded events open on the same rail, comment cards with an author header and
 * reactions, and a push's commits listed under one rail stop.
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

	test("sets a comment as a card with the author's avatar on the rail", () => {
		let host = document.createElement("div");
		host.style.width = "480px";
		document.body.appendChild(host);
		render(
			<Timeline aria-label="Conversation">
				<Timeline.Event icon={<Glyph />} actor="ana" time="3h ago">
					opened this pull request
				</Timeline.Event>
				<Timeline.Comment
					id="comment-1"
					avatar={
						<span
							data-avatar
							style="display:block;width:20px;height:20px;border-radius:50%;background:gray"
						/>
					}
					author="ana"
					action="commented"
					time="2h ago"
					menu={
						<button type="button" aria-label="Comment actions">
							⋯
						</button>
					}
					reactions={<button type="button">👍 2</button>}
				>
					<p>Looks good to me.</p>
				</Timeline.Comment>
			</Timeline>,
			{ container: host },
		);
		let list = host.querySelector("ol")!;
		let comment = host.querySelector<HTMLElement>('[data-slot="timeline-comment"]')!;
		let header = comment.querySelector<HTMLElement>('[data-slot="timeline-comment-header"]')!;
		let card = comment.querySelector<HTMLElement>('[data-slot="timeline-card"]')!;
		let avatar = comment.querySelector<HTMLElement>('[data-slot="timeline-avatar"]')!;
		let icon = host.querySelector('[data-slot="timeline-icon"]')!;
		let menu = header.querySelector("button")!;
		let rail = getComputedStyle(list, "::before");
		let railCenter = list.getBoundingClientRect().left + parseFloat(rail.left) + 1;

		expect(comment.id).toBe("comment-1");
		expect(centerX(avatar)).toBeCloseTo(railCenter, 0);
		expect(centerX(avatar)).toBeCloseTo(centerX(icon), 0);
		expect(getComputedStyle(card).borderTopWidth).toBe("1px");
		expect(header.textContent).toContain("ana");
		expect(header.textContent).toContain("commented");
		expect(header.textContent).toContain("2h ago");
		expect(menu.getBoundingClientRect().right).toBeCloseTo(
			header.getBoundingClientRect().right - 12,
			0,
		);
		expect(card.querySelector('[data-slot="timeline-comment-body"] p')!.textContent).toBe(
			"Looks good to me.",
		);
		let reactions = card.querySelector<HTMLElement>('[data-slot="timeline-reactions"]')!;
		expect(reactions.getBoundingClientRect().top).toBeGreaterThan(
			card.querySelector('[data-slot="timeline-comment-body"]')!.getBoundingClientRect().top,
		);
	});

	test("lists a push's commits under one rail stop, each with its check and short sha", () => {
		let host = document.createElement("div");
		host.style.width = "480px";
		document.body.appendChild(host);
		render(
			<Timeline aria-label="Conversation">
				<Timeline.Commits icon={<Glyph />} actor="ana" summary="added 2 commits" time="1h ago">
					<Timeline.Commit
						sha="a1b2c3d"
						href="#a1b2c3d"
						check={
							<span role="img" aria-label="Checks passed">
								✓
							</span>
						}
					>
						Parse ANSI colours in job logs and keep long subjects to a single truncated line
					</Timeline.Commit>
					<Timeline.Commit sha="e4f5a6b">Fix the timestamp toggle</Timeline.Commit>
				</Timeline.Commits>
			</Timeline>,
			{ container: host },
		);
		let group = host.querySelector<HTMLElement>('[data-slot="timeline-commits"]')!;
		let commits = group.querySelectorAll<HTMLElement>('[data-slot="timeline-commit"]');
		let first = commits[0]!;
		let sha = first.querySelector<HTMLElement>('[data-slot="timeline-commit-sha"]')!;

		expect(group.querySelectorAll('[data-slot="timeline-icon"]')).toHaveLength(1);
		expect(commits).toHaveLength(2);
		expect(first.getBoundingClientRect().height).toBeLessThanOrEqual(32);
		expect(getComputedStyle(sha).fontFamily).toMatch(/mono/i);
		expect(sha.textContent).toBe("a1b2c3d");
		expect(sha.getBoundingClientRect().right).toBeCloseTo(first.getBoundingClientRect().right, 0);
		expect(first.querySelector('[role="img"]')!.getAttribute("aria-label")).toBe("Checks passed");
		expect(
			first
				.querySelector<HTMLAnchorElement>('[data-slot="timeline-commit-subject"] a')!
				.getAttribute("href"),
		).toBe("#a1b2c3d");
		expect(commits[1]!.querySelector("a")).toBeNull();
	});
});
