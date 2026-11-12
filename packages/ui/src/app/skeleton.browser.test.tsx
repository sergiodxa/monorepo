/**
 * Measures the skeleton presets against the real parts they stand in for: a placeholder
 * row is as tall as a table row in either density, a placeholder stat card as tall as a
 * card, the shimmer stops under reduced motion, and the cluster announces one label.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp } from "vitest/browser";

import { Skeleton } from "./skeleton.js";
import { StatCard } from "./stat-card.js";
import { Table } from "./table.js";

import "../reset.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(node, { container: host });
	return host;
}

/** Rendered height of the first element matching `selector` inside `host`. */
function heightOf(host: HTMLElement, selector: string): number {
	return host.querySelector(selector)!.getBoundingClientRect().height;
}

describe("Skeleton.Row and Skeleton.Table", () => {
	for (let density of ["compact", "comfortable"] as const) {
		test(`match a real ${density} row's height under the real header`, () => {
			let host = mount(
				<Table density={density}>
					<Table.Header>
						<Table.Row>
							<Table.Column>Monitor</Table.Column>
							<Table.Column>Status</Table.Column>
							<Table.Column>Uptime</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						<Table.Row data-testid="real">
							<Table.Cell>Checkout API</Table.Cell>
							<Table.Cell>Up</Table.Cell>
							<Table.Cell numeric>99.98%</Table.Cell>
						</Table.Row>
					</Table.Body>
					<Skeleton.Table rows={3} columns={3} label="Loading monitors" />
				</Table>,
			);

			let real = heightOf(host, '[data-testid="real"]');
			let rows = [...host.querySelectorAll('[data-skeleton="row"]')];
			expect(rows).toHaveLength(3);
			for (let row of rows) expect(row.getBoundingClientRect().height).toBe(real);
			expect(rows[0]!.querySelectorAll("td")).toHaveLength(3);
		});
	}

	test("announce one busy label for the whole body and hide every bar", () => {
		let host = mount(
			<Table>
				<Skeleton.Table rows={2} label="Loading monitors" />
			</Table>,
		);
		let body = host.querySelector('[data-skeleton="table"]')!;

		expect(body.getAttribute("aria-busy")).toBe("true");
		expect(body.getAttribute("aria-label")).toBe("Loading monitors");
		for (let row of host.querySelectorAll('[data-skeleton="row"]')) {
			expect(row.getAttribute("aria-hidden")).toBe("true");
		}
	});
});

describe("Skeleton.Stat", () => {
	for (let [name, delta, chart] of [
		["a plain card", false, false],
		["a card with a delta", true, false],
		["a card with a chart", true, true],
	] as const) {
		test(`is as tall as ${name}`, () => {
			let host = mount(
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
					<StatCard data-testid="real">
						<StatCard.Label>p95 latency</StatCard.Label>
						{delta ? (
							<StatCard.Delta trend="up" trendLabel="Increased">
								+12 ms
							</StatCard.Delta>
						) : null}
						<StatCard.Value>182 ms</StatCard.Value>
						{chart ? (
							<StatCard.Chart>
								<span />
							</StatCard.Chart>
						) : null}
					</StatCard>
					<Skeleton.Stat delta={delta} chart={chart} />
				</div>,
			);

			expect(heightOf(host, '[data-skeleton="stat"]')).toBeCloseTo(
				heightOf(host, '[data-testid="real"]'),
				0,
			);
		});
	}

	for (let [variant, width] of [
		["tabs", 1100],
		["ruled", 1100],
		["cards", 375],
	] as const) {
		test(`places the delta where a real one sits in ${variant} at ${width}px`, () => {
			let host = mount(
				<div>
					<StatCard.Group variant={variant} aria-label="Overview">
						<StatCard data-testid="real">
							<StatCard.Label>p95 latency</StatCard.Label>
							<StatCard.Value>182 ms</StatCard.Value>
							<StatCard.Delta trend="up">+12 ms</StatCard.Delta>
						</StatCard>
					</StatCard.Group>
					<StatCard.Group variant={variant} aria-label="Loading">
						<Skeleton.Stat delta />
					</StatCard.Group>
				</div>,
				width,
			);

			expect(heightOf(host, '[data-skeleton="stat"]')).toBeCloseTo(
				heightOf(host, '[data-testid="real"]'),
				0,
			);
		});
	}

	test("becomes one named status when labelled, hidden otherwise", () => {
		let host = mount(
			<>
				<Skeleton.Stat label="Loading p95 latency" data-testid="named" />
				<Skeleton.Stat data-testid="quiet" />
			</>,
		);

		let named = host.querySelector('[data-testid="named"]')!;
		expect(named.getAttribute("role")).toBe("status");
		expect(named.getAttribute("aria-busy")).toBe("true");
		expect(named.getAttribute("aria-label")).toBe("Loading p95 latency");
		expect(host.querySelector('[data-testid="quiet"]')?.getAttribute("aria-hidden")).toBe("true");
	});
});

describe("Skeleton.List", () => {
	test("keeps each row at the list row height, with avatars when asked", () => {
		let host = mount(<Skeleton.List rows={4} avatar label="Loading conversations" />);
		let rows = [...host.querySelectorAll('[data-slot="skeleton-list-row"]')];

		expect(rows).toHaveLength(4);
		for (let row of rows) expect(row.getBoundingClientRect().height).toBe(56);
		expect(rows[0]!.querySelectorAll('[data-slot="skeleton-bar"]')).toHaveLength(3);
	});

	test("follows --ui-skeleton-list-row-block-size", () => {
		let host = mount(
			<div style={{ "--ui-skeleton-list-row-block-size": "40px" }}>
				<Skeleton.List rows={2} lines={1} />
			</div>,
		);

		expect(heightOf(host, '[data-slot="skeleton-list-row"]')).toBe(40);
	});

	test("fits 320px without overflowing", () => {
		let host = mount(<Skeleton.List rows={3} avatar />, 320);
		let list = host.querySelector<HTMLElement>('[data-slot="skeleton-list"]')!;

		expect(list.scrollWidth).toBeLessThanOrEqual(320);
	});
});

describe("Skeleton shimmer", () => {
	test("sweeps while motion is allowed and holds still under reduced motion", async () => {
		let host = mount(<Skeleton.List rows={1} />);
		let bar = host.querySelector('[data-slot="skeleton-bar"]')!;

		expect(getComputedStyle(bar).animationName).toBe("ui-skeleton-shimmer");

		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});

		expect(getComputedStyle(bar).animationName).toBe("none");
	});
});

/** A bio long enough to wrap in a phone's column and stay on fewer lines in a desktop's. */
const BIO =
	"Browser engineer. Layout, text and the CSS you didn't know shipped. Threads about the platform, most weeks.";

describe("Skeleton.Text", () => {
	for (let width of [240, 600]) {
		test(`wraps like the text it stands in for at ${width}px`, () => {
			let host = mount(
				<div>
					<p data-testid="real" style="margin:0;line-height:1.45">
						{BIO}
					</p>
					<p data-testid="ghost" style="margin:0;line-height:1.45">
						<Skeleton.Text>{BIO}</Skeleton.Text>
					</p>
				</div>,
				width,
			);

			expect(heightOf(host, '[data-testid="ghost"]')).toBe(heightOf(host, '[data-testid="real"]'));
			expect(heightOf(host, '[data-testid="real"]')).toBeGreaterThan(20);
		});
	}

	test("paints a bar per line and keeps the text out of reach", () => {
		let host = mount(
			<p style="--ui-neutral-border: rgb(220, 220, 220)">
				<Skeleton.Text>Priya Raman</Skeleton.Text>
			</p>,
		);
		let bar = host.querySelector<HTMLElement>('[data-slot="skeleton-text"]')!;
		let text = bar.firstElementChild!;

		expect(bar.getAttribute("aria-hidden")).toBe("true");
		expect(getComputedStyle(bar).backgroundColor).toBe("rgb(220, 220, 220)");
		expect(getComputedStyle(text).visibility).toBe("hidden");
	});

	test("block wraps one pill around a box the size of its content", () => {
		let host = mount(
			<div>
				<span data-testid="real" style="display:inline-flex;padding:4px 12px">
					Follow
				</span>
				<Skeleton.Text block data-testid="ghost">
					<span style="display:inline-flex;padding:4px 12px">Follow</span>
				</Skeleton.Text>
			</div>,
		);
		let real = host.querySelector('[data-testid="real"]')!.getBoundingClientRect();
		let ghost = host.querySelector('[data-testid="ghost"]')!.getBoundingClientRect();

		expect(Math.round(ghost.width)).toBe(Math.round(real.width));
		expect(Math.round(ghost.height)).toBe(Math.round(real.height));
	});
});
