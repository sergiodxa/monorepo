/**
 * Lays tables out in a real browser: a sticky header, both densities, aligned typed cells,
 * select-all and shift-click ranges, row actions revealed by hover except on touch, a
 * whole-row link, a pinned first column whose shadow waits for a scroll, and the states.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { Table } from "./table.js";

/** One monitor row, enough columns to overflow a phone. */
interface Monitor {
	id: string;
	name: string;
	region: string;
	ms: number;
}

const MONITORS: Monitor[] = Array.from({ length: 12 }, (_, index) => ({
	id: `mon_${index}`,
	name: `api-${index}.example.com`,
	region: "Frankfurt, Germany",
	ms: 100 + index * 7,
}));

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** A monitors table with selection, a row link and actions, in a container `height` tall. */
function monitors(props: Partial<Table.Props> = {}, height?: number): JSX.Element {
	return (
		<Table.Container mix={[]} style={height ? { maxHeight: `${height}px` } : undefined}>
			<Table aria-label="Monitors" {...props}>
				<Table.Header>
					<Table.Row>
						<Table.SelectAll label="Select all monitors" />
						<Table.Column>Name</Table.Column>
						<Table.Column>Region</Table.Column>
						<Table.Column numeric>Response</Table.Column>
						<Table.ActionsColumn label="Actions" />
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{MONITORS.map((monitor) => (
						<Table.Row key={monitor.id}>
							<Table.Select name="monitor" value={monitor.id} label={`Select ${monitor.name}`} />
							<Table.Cell>
								<Table.RowLink href={`#${monitor.id}`}>{monitor.name}</Table.RowLink>
							</Table.Cell>
							<Table.Cell>{monitor.region}</Table.Cell>
							<Table.NumberCell
								value={monitor.ms}
								locale="en"
								format={{ style: "unit", unit: "millisecond" }}
							/>
							<Table.Actions>
								<button type="button">Pause</button>
								<button type="button">Delete</button>
							</Table.Actions>
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		</Table.Container>
	);
}

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
	await cdp().send("Emulation.setTouchEmulationEnabled", { enabled: false });
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

	test("always shows row actions where the pointer cannot hover", async () => {
		await cdp().send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
		let host = mount(monitors());

		expect(matchMedia("(hover: none)").matches).toBe(true);
		for (let cell of host.querySelectorAll<HTMLElement>('[data-slot="row-actions"]')) {
			expect(getComputedStyle(cell).opacity).toBe("1");
		}
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

describe("Table pinned first column", () => {
	test("keeps the first column in place and casts its shadow only once scrolled", async () => {
		await page.viewport(320, 640);
		let host = mount(monitors({ pinFirstColumn: true }), 320);
		let container = host.querySelector<HTMLElement>('[data-slot="container"]')!;
		let pinned = host.querySelector<HTMLElement>("tbody td:first-child")!;
		let start = pinned.getBoundingClientRect().left;

		expect(getComputedStyle(pinned, "::after").opacity).toBe("0");

		container.scrollLeft = 120;
		await expect.poll(() => container.scrollLeft).toBe(120);

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
