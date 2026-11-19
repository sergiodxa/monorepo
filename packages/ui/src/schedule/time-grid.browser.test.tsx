/**
 * Holds the time grid to its contract in a real browser: overlapping events sit side by side,
 * all-day spans stretch across their days, the grid opens on its working day with the now line
 * at the present minute, and drags and Alt+arrow keys post the create and move forms.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { TimeGrid as TimeGridTypes } from "./time-grid.js";

import { TimeGrid } from "./time-grid.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;
let posts: Array<{ kind: string; fields: Record<string, string> }> = [];

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	posts = [];
});

afterAll(async () => {
	await page.viewport(414, 896);
});

/** The grid's strings. */
const LABELS: TimeGridTypes.Labels = {
	allDay: "All day",
	now: "Now",
	moved: "{title} moved to {time}",
	resized: "{title} now ends at {time}",
};

/** Hour labels for one zone, offset from the first by `shift` hours. */
function hours(shift: number): string[] {
	return Array.from({ length: 24 }, (_, hour) => `${(hour + shift + 24) % 24}:00`);
}

/** Three days in the middle of November. */
const DAYS: TimeGridTypes.Day[] = [
	{ date: "2026-11-17", href: "#17" },
	{ date: "2026-11-18", href: "#18" },
	{ date: "2026-11-19", href: "#19" },
];

/** Two overlapping meetings, one on its own, and one that can be edited. */
const EVENTS: TimeGridTypes.Event[] = [
	{ id: "a", date: "2026-11-18", start: 540, end: 600, title: "Standup", time: "9:00 – 10:00" },
	{
		id: "b",
		date: "2026-11-18",
		start: 570,
		end: 660,
		title: "Design review",
		time: "9:30 – 11:00",
	},
	{
		id: "c",
		date: "2026-11-17",
		start: 600,
		end: 660,
		title: "Planning",
		time: "10:00 – 11:00",
		editable: true,
		popover: <p>Planning details</p>,
	},
];

/** Mounts the grid in a 600px-tall box, recording every form it submits instead of posting. */
function mount(props: Partial<TimeGridTypes.Props> = {}): HTMLElement {
	mounted = render(
		<div style="display:flex; block-size:600px; --ui-time-grid-hour: 48px">
			<TimeGrid
				id="week"
				label="Week of November 16"
				locale="en-US"
				days={DAYS}
				events={EVENTS}
				spans={[{ id: "trip", start: "2026-11-15", end: "2026-11-18", title: "Lisbon trip" }]}
				zones={[
					{ label: "EST", hours: hours(0) },
					{ label: "GMT", hours: hours(5) },
				]}
				today="2026-11-18"
				edit={{
					create: { action: "/new", method: "get", fields: { view: "week" } },
					move: { action: "/move", target: "main" },
				}}
				labels={LABELS}
				mix={[]}
				style="flex: 1 1 auto"
				{...props}
			/>
		</div>,
	);
	for (let form of mounted.container.querySelectorAll("form")) {
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			posts.push({
				kind: form.dataset.timeGridForm ?? "",
				fields: Object.fromEntries(
					[...new FormData(form).entries()].map(([key, value]) => [key, String(value)]),
				),
			});
		});
	}
	return mounted.container.querySelector<HTMLElement>('[data-slot="time-grid"]')!;
}

/** The block drawn for an event. */
function block(grid: HTMLElement, id: string): HTMLElement {
	return grid.querySelector<HTMLElement>(`[data-slot="time-grid-event"][data-id="${id}"]`)!;
}

/** The vertical centre of a minute in a column, in viewport coordinates. */
function yOf(column: HTMLElement, minute: number): number {
	let box = column.getBoundingClientRect();
	return box.top + (box.height / 1440) * minute;
}

/** Sends one pointer event at a position. */
function pointer(target: EventTarget, type: string, x: number, y: number): void {
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			clientX: x,
			clientY: y,
			pointerId: 1,
			pointerType: "mouse",
			button: 0,
		}),
	);
}

/** Waits for the island's first layout pass. */
async function settle(): Promise<void> {
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

describe("TimeGrid layout", () => {
	test("sets overlapping events side by side, each half the column", () => {
		let grid = mount();
		let a = block(grid, "a").getBoundingClientRect();
		let b = block(grid, "b").getBoundingClientRect();
		let column = block(grid, "a").parentElement!.getBoundingClientRect();
		expect(a.right).toBeLessThanOrEqual(b.left + 1);
		expect(a.width).toBeLessThan(column.width / 2 + 1);
		expect(b.top - a.top).toBeCloseTo(24, 0);
		expect(a.height).toBeCloseTo(48, 0);
	});

	test("stretches an all-day span from the first visible day to its last", () => {
		let grid = mount();
		let span = grid
			.querySelector<HTMLElement>('[data-slot="time-grid-span"]')!
			.getBoundingClientRect();
		let days = [...grid.querySelectorAll<HTMLElement>('[data-slot="time-grid-day"]')].map((day) =>
			day.getBoundingClientRect(),
		);
		expect(span.left).toBeLessThan(days[0]!.left + 4);
		expect(span.right).toBeGreaterThan(days[1]!.right - 4);
		expect(span.right).toBeLessThan(days[2]!.left + 1);
	});

	test("labels the hours in both zones and marks today", () => {
		let grid = mount();
		let gutters = grid.querySelectorAll('[data-slot="time-grid-hours"]');
		expect(gutters).toHaveLength(2);
		expect(gutters[1]?.textContent).toContain("14:00");
		expect(grid.querySelector('[aria-current="date"]')?.getAttribute("href")).toBe("#18");
	});

	test("opens scrolled to the working day, with the now line at the present minute", async () => {
		let grid = mount({ now: { date: "2026-11-18", minute: 630, at: Date.now() } });
		await settle();
		let body = grid.querySelector<HTMLElement>('[data-slot="time-grid-body"]')!;
		expect(body.scrollTop).toBeCloseTo(8 * 48, -1);
		let line = grid.querySelector<HTMLElement>('[data-slot="time-grid-now"]')!;
		let column = line.parentElement!;
		expect(line.getBoundingClientRect().top - column.getBoundingClientRect().top).toBeCloseTo(
			10.5 * 48 - 1,
			0,
		);
	});

	test("keeps a phone's page as wide as the screen with three days", async () => {
		await page.viewport(375, 812);
		mount();
		expect(document.documentElement.scrollWidth).toBe(375);
	});
});

describe("TimeGrid editing", () => {
	test("posts a create across the dragged time, snapped to the step", async () => {
		let grid = mount();
		await settle();
		let column = grid.querySelector<HTMLElement>('[data-date="2026-11-19"]')!;
		let x = column.getBoundingClientRect().left + 20;
		pointer(column, "pointerdown", x, yOf(column, 13 * 60 + 2));
		pointer(window, "pointermove", x, yOf(column, 13 * 60 + 40));
		pointer(window, "pointermove", x, yOf(column, 14 * 60 + 28));
		expect(grid.querySelector('[data-slot="time-grid-ghost"]')?.textContent).toContain("1:00");
		pointer(window, "pointerup", x, yOf(column, 14 * 60 + 28));
		expect(posts).toEqual([
			{
				kind: "create",
				fields: { view: "week", date: "2026-11-19", start: "780", end: "870" },
			},
		]);
	});

	test("posts an hour from a click on empty time", async () => {
		let grid = mount();
		await settle();
		let column = grid.querySelector<HTMLElement>('[data-date="2026-11-17"]')!;
		let x = column.getBoundingClientRect().left + 20;
		pointer(column, "pointerdown", x, yOf(column, 15 * 60));
		pointer(window, "pointerup", x, yOf(column, 15 * 60));
		expect(posts[0]?.fields).toMatchObject({ date: "2026-11-17", start: "900", end: "960" });
	});

	test("moves an editable event to another day and time, keeping its length", async () => {
		let grid = mount();
		await settle();
		let planning = block(grid, "c");
		let from = planning.getBoundingClientRect();
		let target = grid.querySelector<HTMLElement>('[data-date="2026-11-19"]')!;
		let trigger = planning.querySelector<HTMLElement>('[data-slot="time-grid-trigger"]')!;
		pointer(trigger, "pointerdown", from.left + 10, from.top + 10);
		pointer(window, "pointermove", from.left + 30, from.top + 30);
		pointer(
			window,
			"pointermove",
			target.getBoundingClientRect().left + 10,
			yOf(target, 14 * 60) + (from.top + 10 - yOf(target, 600)) + 0,
		);
		pointer(
			window,
			"pointerup",
			target.getBoundingClientRect().left + 10,
			yOf(target, 14 * 60) + 10,
		);
		expect(posts).toEqual([
			{ kind: "move", fields: { date: "2026-11-19", start: "840", end: "900", id: "c" } },
		]);
		expect(block(grid, "c").parentElement).toBe(target);
	});

	test("resizes an editable event from its bottom edge", async () => {
		let grid = mount();
		await settle();
		let planning = block(grid, "c");
		let edge = planning.querySelector<HTMLElement>('[data-slot="time-grid-resize"]')!;
		let box = edge.getBoundingClientRect();
		let column = planning.parentElement!;
		pointer(edge, "pointerdown", box.left + 5, box.bottom - 2);
		pointer(window, "pointermove", box.left + 5, yOf(column, 12 * 60));
		pointer(window, "pointerup", box.left + 5, yOf(column, 12 * 60));
		expect(posts[0]).toEqual({
			kind: "move",
			fields: { date: "2026-11-17", start: "600", end: "720", id: "c" },
		});
	});

	test("leaves a read-only event's popover to open on click", async () => {
		let grid = mount();
		await settle();
		let standup = block(grid, "a").getBoundingClientRect();
		pointer(block(grid, "a"), "pointerdown", standup.left + 5, standup.top + 5);
		pointer(window, "pointermove", standup.left + 30, standup.top + 60);
		pointer(window, "pointerup", standup.left + 30, standup.top + 60);
		expect(posts).toEqual([]);
	});

	test("moves the focused event by Alt+arrows, announcing it, then posts the run once", async () => {
		let grid = mount();
		await settle();
		let trigger = block(grid, "c").querySelector<HTMLElement>('[data-slot="time-grid-trigger"]')!;
		trigger.focus();
		let key = (init: KeyboardEventInit) =>
			trigger.dispatchEvent(
				new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
			);
		key({ key: "ArrowDown", altKey: true });
		key({ key: "ArrowDown", altKey: true });
		key({ key: "ArrowRight", altKey: true });
		key({ key: "ArrowDown", altKey: true, shiftKey: true });
		expect(grid.querySelector('[data-slot="time-grid-status"]')?.textContent).toBe(
			"Planning now ends at 11:45 AM",
		);
		expect(document.activeElement).toBe(trigger);
		expect(posts).toEqual([]);
		await expect.poll(() => posts.length, { timeout: 2000 }).toBe(1);
		expect(posts[0]).toEqual({
			kind: "move",
			fields: { date: "2026-11-18", start: "630", end: "705", id: "c" },
		});
	});
});
