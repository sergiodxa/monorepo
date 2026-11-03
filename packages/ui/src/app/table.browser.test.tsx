/**
 * Lays tables out in a real browser under a hovering pointer: a sticky header, both densities,
 * aligned typed cells, select-all and shift-click ranges, row actions revealed by hover, a
 * whole-row link, a pinned first column whose shadow waits for a scroll, the states, and row
 * actions that hold one line at every width and fold into a menu in a narrow container.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import {
	ACTIONS,
	articles,
	expectOneLineActions,
	intersects,
	lineBoxes,
	MANY_ACTIONS,
	MONITORS,
	monitors,
	mount,
	OVERLAY_ACTIONS,
	POSTS,
	posts,
	shown,
} from "../test/table.js";

import { Table } from "./table.js";

/** Every row checkbox, in order. */
function items(host: HTMLElement): HTMLInputElement[] {
	return [...host.querySelectorAll<HTMLInputElement>("[data-selection-item]")];
}

/** The select-all checkbox. */
function selectAll(host: HTMLElement): HTMLInputElement {
	return host.querySelector<HTMLInputElement>("[data-selection-all]")!;
}

/** Clicks the visible box of a selection checkbox, the way a pointer does. */
async function clickBox(input: HTMLInputElement, options: { shift?: boolean } = {}): Promise<void> {
	let box = input.closest("label")!.querySelector<HTMLElement>('[data-slot="box"]')!;
	if (options.shift) await userEvent.keyboard("{Shift>}");
	await userEvent.click(box);
	if (options.shift) await userEvent.keyboard("{/Shift}");
}

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(async () => {
	document.body.replaceChildren();
});

describe("Table layout", () => {
	test("keeps the header visible while its container scrolls", async () => {
		let host = mount(monitors({}, 200));
		let container = host.querySelector<HTMLElement>('[data-slot="container"]')!;
		let header = host.querySelector<HTMLElement>("th")!;

		container.scrollTop = 200;
		await expect.poll(() => container.scrollTop).toBe(200);

		expect(header.getBoundingClientRect().top).toBeCloseTo(
			container.getBoundingClientRect().top,
			0,
		);
		let covering = document.elementFromPoint(
			header.getBoundingClientRect().left + 30,
			header.getBoundingClientRect().top + 5,
		);
		expect(covering?.closest("th")).not.toBeNull();
	});

	test("keeps the header at the top of its container inside an app shell's sticky offset", () => {
		let host = mount(
			<div style={{ "--ui-app-sticky-top": "56px" } as Record<string, string>}>{monitors()}</div>,
		);
		let container = host.querySelector<HTMLElement>('[data-slot="container"]')!;
		let header = host.querySelector<HTMLElement>("th")!;
		let firstRow = host.querySelector<HTMLElement>("tbody tr")!;

		expect(header.getBoundingClientRect().top).toBeCloseTo(
			container.getBoundingClientRect().top,
			0,
		);
		expect(header.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			firstRow.getBoundingClientRect().top + 1,
		);
	});

	for (let [density, height] of [
		[undefined, 40],
		["compact", 40],
		["comfortable", 56],
	] as const) {
		test(`draws ${density ?? "default"} rows ${height}px tall`, () => {
			let host = mount(monitors({ density }));
			let row = host.querySelector<HTMLElement>("tbody tr")!;
			expect(row.getBoundingClientRect().height).toBeCloseTo(height, 0);
		});
	}

	test("keeps the header row compact under comfortable rows", () => {
		let host = mount(monitors({ density: "comfortable" }));
		expect(host.querySelector("thead tr")!.getBoundingClientRect().height).toBeCloseTo(40, 0);
	});

	test("keeps every compact row one line tall, even with a long value", () => {
		let host = mount(
			<Table.Container>
				<Table aria-label="Regions">
					<Table.Header>
						<Table.Row>
							<Table.Column>Region</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						<Table.Row>
							<Table.Cell>Frankfurt</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Northern Virginia, United States of America</Table.Cell>
						</Table.Row>
					</Table.Body>
				</Table>
			</Table.Container>,
			160,
		);
		let [short, long] = [...host.querySelectorAll("tbody tr")].map(
			(row) => row.getBoundingClientRect().height,
		);

		expect(long).toBeCloseTo(short!, 0);
	});

	test("tints a body row on hover", async () => {
		let host = mount(monitors());
		let row = host.querySelector<HTMLElement>("tbody tr")!;
		row.style.setProperty("--ui-neutral-bg-tint", "rgb(240, 240, 240)");

		await userEvent.hover(row.querySelector('[data-slot="row-link"]')!);
		await expect.poll(() => getComputedStyle(row).backgroundColor).toBe("rgb(240, 240, 240)");
	});

	test("scrolls a wide table inside its container at 320px, never the page", async () => {
		await page.viewport(320, 640);
		let host = mount(monitors(), 320);
		let container = host.querySelector<HTMLElement>('[data-slot="container"]')!;

		expect(container.scrollWidth).toBeGreaterThan(container.clientWidth);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
	});
});

describe("Table typed cells", () => {
	test("end-aligns numbers and amounts in tabular figures", () => {
		let host = mount(
			<Table aria-label="Payments">
				<Table.Body>
					{[12.5, 1280, 39000.75].map((amount) => (
						<Table.Row key={amount}>
							<Table.NumberCell value={amount} locale="en" />
							<Table.CurrencyCell value={amount} currency="USD" locale="en" />
						</Table.Row>
					))}
				</Table.Body>
			</Table>,
		);
		let numbers = [...host.querySelectorAll<HTMLElement>('[data-type="number"]')];
		let codes = [...host.querySelectorAll<HTMLElement>('[data-slot="currency-code"]')];

		for (let cell of [
			...numbers,
			...host.querySelectorAll<HTMLElement>('[data-type="currency"]'),
		]) {
			expect(getComputedStyle(cell).textAlign).toBe("end");
			expect(getComputedStyle(cell).fontVariantNumeric).toContain("tabular-nums");
		}
		let ends = codes.map((code) => Math.round(code.getBoundingClientRect().right));
		expect(new Set(ends).size).toBe(1);
		expect(host.querySelector('[data-type="currency"]')?.textContent).toBe("$12.50USD");
	});

	test("renders a dash for a missing value", () => {
		let host = mount(
			<Table aria-label="Payments">
				<Table.Body>
					<Table.Row>
						<Table.NumberCell value={null} />
						<Table.CurrencyCell value={undefined} currency="EUR" />
						<Table.IdCell value={null} />
						<Table.DateCell date={null} />
						<Table.StatusCell />
						<Table.BarCell value={null} />
					</Table.Row>
				</Table.Body>
			</Table>,
		);

		let cells = [...host.querySelectorAll("td")];
		expect(cells.map((cell) => cell.textContent)).toEqual(["—", "—", "—", "—", "—", "—"]);
	});

	test("truncates an id in the middle and keeps it whole in the text and title", () => {
		let id = "pi_3PZ1a2b3c4d5e6f7g8h9i0";
		let host = mount(
			<Table aria-label="Payments">
				<Table.Body>
					<Table.Row>
						<Table.IdCell value={id} />
					</Table.Row>
				</Table.Body>
			</Table>,
		);
		let wrapper = host.querySelector<HTMLElement>('[data-slot="id"]')!;
		let [head, tail] = [...wrapper.children] as HTMLElement[];

		expect(wrapper.textContent).toBe(id);
		expect(wrapper.title).toBe(id);
		expect(head!.scrollWidth).toBeGreaterThan(head!.clientWidth);
		expect(tail!.textContent).toBe(id.slice(-4));
		expect(tail!.getBoundingClientRect().right).toBeLessThanOrEqual(
			wrapper.getBoundingClientRect().right + 0.5,
		);
	});

	test("keeps a tail wider than the maximum whole, growing only as far as it needs", () => {
		let id = "contact_ada.lovelace@analytical-engine.example";
		let host = mount(
			<Table aria-label="Contacts">
				<Table.Body>
					<Table.Row>
						<Table.IdCell value={id} tail={20} />
					</Table.Row>
				</Table.Body>
			</Table>,
		);
		let wrapper = host.querySelector<HTMLElement>('[data-slot="id"]')!;
		let [head, tail] = [...wrapper.children] as HTMLElement[];
		let ch = tail!.getBoundingClientRect().width / 20;

		expect(tail!.textContent).toBe(id.slice(-20));
		expect(tail!.scrollWidth).toBeLessThanOrEqual(tail!.clientWidth);
		expect(tail!.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			wrapper.getBoundingClientRect().left - 0.5,
		);
		expect(tail!.getBoundingClientRect().right).toBeLessThanOrEqual(
			wrapper.getBoundingClientRect().right + 0.5,
		);
		expect(head!.getBoundingClientRect().width).toBeGreaterThan(0);
		expect(head!.scrollWidth).toBeGreaterThan(head!.clientWidth);
		expect(wrapper.getBoundingClientRect().width).toBeLessThanOrEqual(22 * ch);
	});

	test("sizes a data bar to its share of the maximum", () => {
		let host = mount(
			<Table aria-label="Routes">
				<Table.Body>
					<Table.Row>
						<Table.BarCell value={25} max={100} locale="en" />
					</Table.Row>
				</Table.Body>
			</Table>,
		);
		let bar = host.querySelector<HTMLElement>('[data-slot="bar"]')!;
		let fill = host.querySelector<HTMLElement>('[data-slot="bar-fill"]')!;

		expect(fill.getBoundingClientRect().width / bar.getBoundingClientRect().width).toBeCloseTo(
			0.25,
			2,
		);
		expect(fill.getAttribute("aria-hidden")).toBe("true");
	});

	test("shows a date cell through RelativeTime and a status cell through StatusDot", () => {
		let host = mount(
			<Table aria-label="Checks">
				<Table.Body>
					<Table.Row>
						<Table.DateCell date="2026-11-01T11:58:00Z" now="2026-11-01T12:00:00Z" locale="en" />
						<Table.StatusCell color="success">Up</Table.StatusCell>
					</Table.Row>
				</Table.Body>
			</Table>,
		);

		expect(host.querySelector("time")?.textContent).toBe("2m ago");
		expect(host.querySelector('[data-slot="status-dot"]')?.textContent).toBe("Up");
	});

	test("counts a local date cell from its now, in the viewer's zone", async () => {
		await cdp().send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Tokyo" });
		let host = mount(
			<Table aria-label="Checks">
				<Table.Body>
					<Table.Row>
						<Table.DateCell
							date="2020-03-01T02:00:00Z"
							now="2020-03-01T04:00:00Z"
							locale="en"
							local
						/>
					</Table.Row>
				</Table.Body>
			</Table>,
		);
		let time = host.querySelector("time")!;

		await expect.poll(() => time.title.split("\n")[0]).toBe("Mar 1, 2020, 11:00:00 AM GMT+9");
		expect(time.textContent).toBe("2h ago");
		await cdp().send("Emulation.setTimezoneOverride", { timezoneId: "" });
	});
});

describe("Table selection", () => {
	test("shows select-all indeterminate for some rows and checked for all", async () => {
		let host = mount(monitors());
		let [first] = items(host);

		await clickBox(first!);
		expect(first!.checked).toBe(true);
		expect(selectAll(host).indeterminate).toBe(true);
		expect(selectAll(host).checked).toBe(false);
		expect(first!.closest("tr")?.getAttribute("aria-selected")).toBe("true");

		let changes = 0;
		host.addEventListener("change", () => changes++);
		await clickBox(selectAll(host));
		expect(items(host).every((item) => item.checked)).toBe(true);
		expect(selectAll(host).indeterminate).toBe(false);
		expect(selectAll(host).checked).toBe(true);
		expect(changes).toBe(MONITORS.length);

		await clickBox(selectAll(host));
		expect(items(host).some((item) => item.checked)).toBe(false);
		expect(host.querySelector('tr[aria-selected="true"]')).toBeNull();
	});

	test("checks every row between two clicks with shift held", async () => {
		let host = mount(monitors());
		let all = items(host);

		await clickBox(all[1]!);
		await clickBox(all[4]!, { shift: true });

		expect(all.map((item) => item.checked)).toEqual(
			MONITORS.map((_, index) => index >= 1 && index <= 4),
		);

		await clickBox(all[2]!, { shift: true });
		expect(all.map((item) => item.checked)).toEqual(MONITORS.map((_, index) => index === 1));
	});

	test("tints a checked row", async () => {
		let host = mount(monitors());
		let row = host.querySelector<HTMLElement>("tbody tr")!;
		row.style.setProperty("--ui-brand-bg-tint", "rgb(0, 0, 255)");
		let before = getComputedStyle(row).backgroundColor;

		await clickBox(items(host)[0]!);
		await expect.poll(() => getComputedStyle(row).backgroundColor).not.toBe(before);
	});
});

describe("Table rows", () => {
	test("hides row actions until the row is hovered", async () => {
		let host = mount(monitors());
		let [first, second] = [...host.querySelectorAll<HTMLElement>('[data-slot="row-actions"]')];

		expect(getComputedStyle(first!).opacity).toBe("0");
		await userEvent.hover(first!.closest("tr")!.querySelector('[data-slot="row-link"]')!);
		await expect.poll(() => getComputedStyle(first!).opacity).toBe("1");
		expect(getComputedStyle(second!).opacity).toBe("0");
	});

	test("shows row actions when a control in the row has focus", async () => {
		let host = mount(monitors());
		let cell = host.querySelector<HTMLElement>('[data-slot="row-actions"]')!;

		cell.querySelector("button")!.focus();
		await expect.poll(() => getComputedStyle(cell).opacity).toBe("1");
	});

	test("makes the whole row the link while other controls keep their clicks", () => {
		let host = mount(monitors());
		let row = host.querySelector<HTMLElement>("tbody tr")!;
		let link = row.querySelector<HTMLAnchorElement>('[data-slot="row-link"]')!;
		let region = row.querySelector<HTMLElement>("td:nth-child(3)")!.getBoundingClientRect();
		let box = row.querySelector<HTMLElement>('[data-slot="box"]')!.getBoundingClientRect();
		let button = row.querySelector<HTMLElement>('[data-slot="row-actions"] button')!;
		let buttonBox = button.getBoundingClientRect();

		expect(document.elementFromPoint(region.left + 5, region.top + 5)?.closest("a")).toBe(link);
		expect(document.elementFromPoint(box.left + 5, box.top + 5)?.closest("label")).not.toBeNull();
		expect(document.elementFromPoint(buttonBox.left + 3, buttonBox.top + 3)).toBe(button);
	});
});

describe("Table keys", () => {
	test("walks a server-rendered table's rows with j and k from a marker in its container", async () => {
		let host = mount(
			<Table.Container>
				<Table.Keys labels={{ group: "Monitors", next: "Next", previous: "Previous" }} />
				<Table aria-label="Monitors">
					<Table.Header>
						<Table.Row>
							<Table.Column>Name</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{MONITORS.map((monitor) => (
							<Table.Row key={monitor.id}>
								<Table.Cell>
									<Table.RowLink href={`#${monitor.id}`}>{monitor.name}</Table.RowLink>
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>,
		);
		let rows = [...host.querySelectorAll<HTMLElement>("tbody tr")];

		await userEvent.keyboard("j");
		expect(document.activeElement).toBe(rows[0]);
		await userEvent.keyboard("j");
		expect(document.activeElement).toBe(rows[1]);
		await userEvent.keyboard("k");
		expect(document.activeElement).toBe(rows[0]);
		expect(getComputedStyle(rows[0]!).outlineStyle).toBe("solid");
	});
});

describe("Table pinned first column", () => {
	test("keeps the first column in place and casts its shadow only once scrolled", async () => {
		await page.viewport(320, 640);
		let host = mount(monitors({ pinFirstColumn: true }), 320);
		let container = host.querySelector<HTMLElement>('[data-slot="container"]')!;
		let pinned = host.querySelector<HTMLElement>("tbody td:first-child")!;
		let start = pinned.getBoundingClientRect().left;

		expect(getComputedStyle(pinned, "::after").opacity).toBe("0");

		container.scrollLeft = 100;
		await expect.poll(() => container.scrollLeft).toBe(100);

		expect(pinned.getBoundingClientRect().left).toBeCloseTo(start, 0);
		await expect.poll(() => getComputedStyle(pinned, "::after").opacity).toBe("1");
		let next = host.querySelector<HTMLElement>("tbody td:nth-child(2)")!.getBoundingClientRect();
		let covering = document.elementFromPoint(
			pinned.getBoundingClientRect().left + 3,
			pinned.getBoundingClientRect().top + 3,
		);
		expect(next.left).toBeLessThan(pinned.getBoundingClientRect().right);
		expect(covering?.closest("td")).toBe(pinned);
	});
});

describe("Table states", () => {
	test("renders the empty slot beneath the header, outside the table", () => {
		let host = mount(
			<Table.Container>
				<Table aria-label="Monitors">
					<Table.Header>
						<Table.Row>
							<Table.Column>Name</Table.Column>
						</Table.Row>
					</Table.Header>
				</Table>
				<Table.Empty>
					<p>No monitors yet</p>
				</Table.Empty>
			</Table.Container>,
		);
		let empty = host.querySelector<HTMLElement>('[data-slot="table-empty"]')!;

		expect(empty.closest("table")).toBeNull();
		expect(empty.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			host.querySelector("thead")!.getBoundingClientRect().bottom,
		);
		expect(empty.textContent).toBe("No monitors yet");
	});

	test("shows an error with its retry slot in place of the body", () => {
		let host = mount(
			<Table aria-label="Monitors">
				<Table.Header>
					<Table.Row>
						<Table.Column>Name</Table.Column>
						<Table.Column>Region</Table.Column>
					</Table.Row>
				</Table.Header>
				<Table.Error colSpan={2} action={<a href="?">Retry</a>}>
					Monitors could not load.
				</Table.Error>
			</Table>,
		);
		let alert = host.querySelector('[role="alert"]')!;

		expect(alert.textContent).toBe("Monitors could not load.Retry");
		expect(alert.closest("td")?.colSpan).toBe(2);
	});

	test("dims the body in place while refetching", async () => {
		let host = mount(monitors({ "aria-busy": "true" }));
		let table = host.querySelector("table")!;
		let body = host.querySelector("tbody")!;

		expect(table.getAttribute("aria-busy")).toBe("true");
		await expect.poll(() => getComputedStyle(body).opacity).toBe("0.5");
		expect(body.children).toHaveLength(MONITORS.length);
	});
});

describe("Table row actions", () => {
	for (let width of [768, 1440]) {
		test(`keeps ghost link actions on one line in a ${width}px table`, async () => {
			await page.viewport(width, 900);
			expectOneLineActions(mount(posts({ links: true }), width));
		});

		test(`shows Table.Action actions inline on one line in a ${width}px table`, async () => {
			await page.viewport(width, 900);
			let host = mount(posts(), width);

			expectOneLineActions(host);
			let more = host.querySelector<HTMLElement>('button[aria-label="More actions"]')!;
			expect(more.getClientRects()).toHaveLength(0);
		});
	}

	test("folds the actions into one menu button in a 480px container", async () => {
		await page.viewport(1024, 768);
		let host = mount(posts(), 480);
		let cell = host.querySelector<HTMLElement>('tbody [data-slot="row-actions"]')!;
		let visible = [...cell.querySelectorAll<HTMLElement>("a, button")].filter(
			(control) => control.getClientRects().length > 0,
		);

		expect(visible).toHaveLength(1);
		let more = visible[0]!;
		expect(more.getAttribute("aria-label")).toBe("More actions");
		expect(lineBoxes(more)).toBeLessThanOrEqual(1);

		await userEvent.click(more);
		let menu = document.getElementById(more.getAttribute("commandfor")!)!;
		await expect.poll(() => menu.matches(":popover-open")).toBe(true);
		let items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
		expect(items.map((item) => item.textContent)).toEqual(ACTIONS);
		expect(items.map((item) => item.getAttribute("href"))).toEqual(
			ACTIONS.map((label) => `#post_0/${label}`),
		);
		for (let item of items) expect(lineBoxes(item)).toBe(1);
	});

	test("gives every row its own menu", () => {
		let host = mount(posts(), 480);
		let targets = [...host.querySelectorAll('button[aria-label="More actions"]')].map((more) =>
			more.getAttribute("commandfor"),
		);

		expect(new Set(targets).size).toBe(POSTS.length);
		for (let target of targets) expect(document.getElementById(target!)).not.toBeNull();
	});

	test("never widens a 375px page", async () => {
		await page.viewport(375, 812);
		mount(posts(), 375);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});
});

/** Widest a resting actions column may be: one small ⋯ button. */
const MENU_BUTTON_WIDTH = 32;

/** Rendered inline-size of the first body row's cell in column `index`. */
function columnWidth(host: HTMLElement, index: number): number {
	return host.querySelector("tbody tr")!.children[index]!.getBoundingClientRect().width;
}

describe("Table hover-revealed row actions", () => {
	test("reserve no width at rest, so the title column takes it", async () => {
		await page.viewport(1024, 768);
		let bare = mount(posts({ noActions: true }), 1024);
		let titleWithoutActions = columnWidth(bare, 1);
		bare.remove();

		let host = mount(posts({ actions: MANY_ACTIONS }), 1024);

		expect(matchMedia("(hover: hover)").matches).toBe(true);
		expect(columnWidth(host, 4)).toBeLessThanOrEqual(MENU_BUTTON_WIDTH);
		expect(columnWidth(host, 1)).toBeGreaterThanOrEqual(titleWithoutActions - MENU_BUTTON_WIDTH);
	});

	test("show on hover over the row's end, on one line and inside the row", async () => {
		await page.viewport(1024, 768);
		let host = mount(posts({ actions: MANY_ACTIONS }), 1024);
		let row = host.querySelector<HTMLElement>("tbody tr")!;
		let cell = row.querySelector<HTMLElement>('[data-slot="row-actions"]')!;
		let inline = cell.querySelector<HTMLElement>('[data-slot="row-actions-inline"]')!;

		await userEvent.hover(row.querySelector('[data-slot="row-link"]')!);
		await expect.poll(() => getComputedStyle(cell).opacity).toBe("1");

		let actions = [...inline.querySelectorAll<HTMLElement>("a")];
		expect(actions.map((action) => action.textContent)).toEqual(MANY_ACTIONS);
		for (let action of actions) expect(lineBoxes(action)).toBe(1);
		let rowBox = row.getBoundingClientRect();
		let box = inline.getBoundingClientRect();
		expect(box.left).toBeGreaterThanOrEqual(rowBox.left - 1);
		expect(box.right).toBeLessThanOrEqual(rowBox.right + 1);
		expect(box.top).toBeGreaterThanOrEqual(rowBox.top - 1);
		expect(box.bottom).toBeLessThanOrEqual(rowBox.bottom + 1);
		expect(
			new Set(actions.map((action) => Math.round(action.getBoundingClientRect().top))).size,
		).toBe(1);
		expect(getComputedStyle(inline, "::before").backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
	});
});

/**
 * Where the overlay of row actions turns fully opaque: its own box when it paints its own
 * background, else the end of the soft edge its `::before` fades in through a mask.
 */
function opaqueStart(inline: HTMLElement): number {
	let box = inline.getBoundingClientRect();
	if (rgba(getComputedStyle(inline).backgroundColor)[3] > 0) return box.left;
	let edge = getComputedStyle(inline, "::before");
	let stops = [...edge.maskImage.matchAll(/(-?[\d.]+)px/g)].map((match) => Number(match[1]));
	return box.left + (Number.parseFloat(edge.left) || 0) + (stops.at(-1) ?? 0);
}

/** `css` resolved to sRGB channels 0–255 and an alpha 0–1, through a canvas. */
function rgba(css: string): [number, number, number, number] {
	let context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
	context.canvas.width = context.canvas.height = 1;
	context.fillStyle = "rgba(0, 0, 0, 0)";
	context.fillStyle = css;
	context.fillRect(0, 0, 1, 1);
	let [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
	return [r!, g!, b!, a! / 255];
}

/**
 * Largest channel difference between `element`'s fill laid over the opaque `base` and `base`
 * itself: its background colour, then the first colour of a background-image gradient.
 */
function step(element: HTMLElement, base: string): number {
	let style = getComputedStyle(element);
	let image = /(rgba?\([^)]*\)|color\([^)]*\))/.exec(style.backgroundImage)?.[1];
	let under = rgba(base);
	let painted = [style.backgroundColor, image ?? "rgba(0, 0, 0, 0)"].reduce(
		(surface, layer) => {
			let [r, g, b, a] = rgba(layer);
			return [r, g, b].map((channel, index) => channel * a + surface[index]! * (1 - a));
		},
		under.slice(0, 3),
	);
	return Math.max(...painted.map((channel, index) => Math.abs(channel - under[index]!)));
}

/** Theme colours a light and a dark page give the row surface and its ghost actions. */
const THEMES = {
	light: {
		"--ui-bg": "rgb(255, 255, 255)",
		"--ui-neutral-bg-tint": "rgb(250, 250, 250)",
		"--ui-neutral-bg-tint-hover": "rgb(245, 245, 245)",
		"--ui-neutral-bg-tint-pressed": "rgb(229, 229, 229)",
		"--ui-neutral-fg-emphasis": "rgb(23, 23, 23)",
		"--ui-danger-bg-tint": "rgb(254, 242, 242)",
		"--ui-danger-bg-tint-hover": "rgb(254, 226, 226)",
		"--ui-danger-fg": "rgb(220, 38, 38)",
	},
	dark: {
		"--ui-bg": "rgb(10, 10, 10)",
		"--ui-neutral-bg-tint": "rgb(16, 16, 16)",
		"--ui-neutral-bg-tint-hover": "rgb(23, 23, 23)",
		"--ui-neutral-bg-tint-pressed": "rgb(38, 38, 38)",
		"--ui-neutral-fg-emphasis": "rgb(245, 245, 245)",
		"--ui-danger-bg-tint": "rgb(69, 10, 10)",
		"--ui-danger-bg-tint-hover": "rgb(127, 29, 29)",
		"--ui-danger-fg": "rgb(248, 113, 113)",
	},
};

/** Smallest channel step a hovered action's background must take off the row's tint to read. */
const VISIBLE_STEP = 12;

describe("Table row actions overlay", () => {
	test("fades in ahead of the last cell instead of slicing its text", async () => {
		let host = mount(articles(), 900);
		let row = host.querySelector<HTMLElement>("tbody tr")!;
		let inline = row.querySelector<HTMLElement>('[data-slot="row-actions-inline"]')!;
		let status = row.querySelector<HTMLElement>('[data-type="status"]')!;
		let label = status.querySelector<HTMLElement>('[data-slot="status-dot-label"]')!;

		await userEvent.hover(row.querySelector('[data-slot="row-link"]')!);
		await expect.poll(() => getComputedStyle(inline.parentElement!).opacity).toBe("1");

		status.style.textAlign = "end";
		status.style.paddingInlineEnd = `${row.getBoundingClientRect().right - inline.getBoundingClientRect().left - 6}px`;

		let range = document.createRange();
		range.selectNodeContents(label);
		let overshoot = range.getBoundingClientRect().right - inline.getBoundingClientRect().left - 6;
		status.style.paddingInlineEnd = `${Number.parseFloat(status.style.paddingInlineEnd) + overshoot}px`;
		let textEnd = range.getBoundingClientRect().right;
		expect(textEnd).toBeGreaterThan(inline.getBoundingClientRect().left);
		expect(textEnd).toBeLessThanOrEqual(opaqueStart(inline));
		expect(getComputedStyle(inline, "::before").maskImage).toContain("gradient");
		expect(getComputedStyle(inline, "::before").pointerEvents).toBe("none");
	});

	for (let [theme, colors] of Object.entries(THEMES)) {
		test(`gives each action a hover step that reads on the row's ${theme} tint`, async () => {
			let host = mount(articles(), 900);
			for (let [name, value] of Object.entries(colors)) host.style.setProperty(name, value);
			let row = host.querySelector<HTMLElement>("tbody tr")!;
			let actions = [...row.querySelectorAll<HTMLElement>('[data-slot="row-actions-inline"] > *')];
			expect(actions.map((action) => action.textContent)).toEqual(OVERLAY_ACTIONS);

			for (let action of actions) {
				await userEvent.hover(action);
				await expect.poll(() => rgba(getComputedStyle(row).backgroundColor)[3]).toBe(1);
				let tint = getComputedStyle(row).backgroundColor;
				await expect.poll(() => step(action, tint)).toBeGreaterThanOrEqual(VISIBLE_STEP);
			}
		});
	}
});

describe("Table row actions on a phone and from the keyboard", () => {
	test("shows the actions when the keyboard tabs into the row on a hover device", async () => {
		let host = mount(articles(), 900);
		let row = host.querySelector<HTMLElement>("tbody tr")!;
		let cell = row.querySelector<HTMLElement>('[data-slot="row-actions"]')!;

		expect(matchMedia("(hover: hover)").matches).toBe(true);
		expect(getComputedStyle(cell).opacity).toBe("0");
		await userEvent.tab();
		expect(row.contains(document.activeElement)).toBe(true);
		await expect.poll(() => getComputedStyle(cell).opacity).toBe("1");
		expect(shown(cell).map((action) => action.textContent)).toEqual(OVERLAY_ACTIONS);
	});

	test(`never lays the actions over the title or status on a 375px mouse screen`, async () => {
		await page.viewport(375, 812);
		let host = mount(articles(), 375);

		for (let row of host.querySelectorAll<HTMLElement>("tbody tr")) {
			row.querySelector<HTMLElement>('[data-slot="row-link"]')!.focus();
			let cell = row.querySelector<HTMLElement>('[data-slot="row-actions"]')!;
			await expect.poll(() => getComputedStyle(cell).opacity).toBe("1");
			let title = row.children[0]!.getBoundingClientRect();
			let status = row.querySelector('[data-type="status"]')!.getBoundingClientRect();
			let parts = [cell, ...cell.querySelectorAll<HTMLElement>("*")].filter(
				(part) => part.getClientRects().length > 0 && !part.closest(":popover-open, dialog"),
			);
			for (let part of parts) {
				let box = part.getBoundingClientRect();
				expect(intersects(box, title)).toBe(false);
				expect(intersects(box, status)).toBe(false);
			}
		}
	});
});

describe("Table dates and statuses", () => {
	test("keeps a comfortable date cell on one line when long titles squeeze it", async () => {
		await page.viewport(1024, 768);
		let host = mount(posts({ date: true, noActions: true }), 1024);

		for (let time of host.querySelectorAll("tbody time")) {
			expect(time.textContent).toBe("Dec 1, 2026");
			expect(lineBoxes(time)).toBe(1);
		}
	});

	test("shows a status's detail muted after its word, on one line", () => {
		let host = mount(
			<Table aria-label="Posts" density="comfortable">
				<Table.Body>
					<Table.Row>
						<Table.Cell>{POSTS[0]!.title.repeat(4)}</Table.Cell>
						<Table.StatusCell color="warning" detail="Dec 4">
							Scheduled
						</Table.StatusCell>
					</Table.Row>
				</Table.Body>
			</Table>,
			600,
		);
		host.style.setProperty("--ui-neutral-fg-muted", "rgb(110, 110, 110)");
		let label = host.querySelector<HTMLElement>('[data-slot="status-dot-label"]')!;
		let detail = host.querySelector<HTMLElement>('[data-slot="status-detail"]')!;

		expect(label.textContent).toBe("Scheduled · Dec 4");
		expect(detail.textContent).toBe(" · Dec 4");
		expect(getComputedStyle(detail).color).not.toBe(getComputedStyle(label).color);
		expect(lineBoxes(label)).toBe(1);
	});
});
