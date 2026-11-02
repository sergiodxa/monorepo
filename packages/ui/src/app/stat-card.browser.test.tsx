/**
 * Lays stat cards out in a real browser: the value's size and tabular figures, a delta toned
 * by meaning, a skeleton as tall as its card, group columns that follow the container (two
 * compact ones on a phone), ruled columns, and link tabs reachable by keyboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { StatCard } from "./stat-card.js";

import "../reset.css";
import "../theme.css";

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 960): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** A complete card for p95 latency, where a rise is bad. */
function Latency() {
	return () => (
		<StatCard>
			<StatCard.Label>p95 latency</StatCard.Label>
			<StatCard.Value>182 ms</StatCard.Value>
			<StatCard.Delta trend="up" invert trendLabel="Increased by" comparison="vs last week">
				+12 ms
			</StatCard.Delta>
			<StatCard.Footer>Slowest in eu-west</StatCard.Footer>
		</StatCard>
	);
}

/** Sentences explaining a dashboard's four stats, at the lengths a real overview writes. */
const FOOTERS = [
	"checkout-api has been down since 05:41.",
	"payments-webhooks is 4× its usual p95.",
	"41% of checkout requests fail.",
	"One SEV1, one SEV2 and one SEV3.",
];

/** Four cards for a group, the first linking as the current tab when `tabs` is set. */
function Four(handle: { props: { variant?: StatCard.Variant } }) {
	return () => {
		let tabs = handle.props.variant === "tabs";
		let metrics = ["Uptime", "p95 latency", "Error rate", "Open incidents"];
		return (
			<StatCard.Group variant={handle.props.variant} aria-label="Overview">
				{metrics.map((metric, index) => (
					<StatCard
						key={metric}
						href={tabs ? `?metric=${index}` : undefined}
						current={tabs ? index === 0 : undefined}
					>
						<StatCard.Label>{metric}</StatCard.Label>
						<StatCard.Value>{index}</StatCard.Value>
					</StatCard>
				))}
			</StatCard.Group>
		);
	};
}

/** Distinct column offsets the group's cards start at. */
function columns(host: HTMLElement): number {
	let cards = host.querySelectorAll<HTMLElement>('[data-slot="stat-card"]');
	return new Set([...cards].map((card) => Math.round(card.getBoundingClientRect().left))).size;
}

/** Resolves `variable` to a colour through a probe element. */
function colour(host: HTMLElement, variable: string): string {
	let probe = document.createElement("span");
	probe.style.color = `var(${variable})`;
	host.appendChild(probe);
	return getComputedStyle(probe).color;
}

beforeEach(async () => {
	await page.viewport(1280, 800);
});

afterEach(() => {
	document.body.replaceChildren();
});

describe("StatCard", () => {
	test("sets the value at 30px semibold in tabular figures", () => {
		let host = mount(<Latency />, 320);
		let value = getComputedStyle(host.querySelector('[data-slot="stat-card-value"]')!);

		expect(value.fontSize).toBe("30px");
		expect(value.fontWeight).toBe("600");
		expect(value.fontVariantNumeric).toBe("tabular-nums");
	});

	test("sets the value at 24px in ruled columns", () => {
		let host = mount(<Four variant="ruled" />);
		let value = getComputedStyle(host.querySelector('[data-slot="stat-card-value"]')!);
		let card = getComputedStyle(host.querySelector('[data-slot="stat-card"]')!);

		expect(value.fontSize).toBe("24px");
		expect(card.borderBlockStartWidth).toBe("1px");
		expect(card.borderInlineStartWidth).toBe("0px");
	});

	test("tones a rise as bad when the number should fall, and speaks the trend", async () => {
		let host = mount(
			<div>
				<Latency />
				<StatCard>
					<StatCard.Label>Uptime</StatCard.Label>
					<StatCard.Value>99.98%</StatCard.Value>
					<StatCard.Delta trend="up">+0.02%</StatCard.Delta>
				</StatCard>
			</div>,
		);
		let [inverted, plain] = host.querySelectorAll<HTMLElement>(
			'[data-slot="stat-card-delta-pill"]',
		);

		expect(inverted!.dataset.tone).toBe("danger");
		expect(getComputedStyle(inverted!).color).toBe(colour(host, "--ui-danger-fg"));
		expect(plain!.dataset.tone).toBe("success");
		expect(getComputedStyle(plain!).color).toBe(colour(host, "--ui-success-fg"));
		expect(inverted!.textContent).toBe("Increased by+12 ms");
		expect(inverted!.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
	});

	test("sets the delta at the end of the label's line in a card", () => {
		let host = mount(<Latency />, 480);
		let label = host.querySelector('[data-slot="stat-card-label"]')!.getBoundingClientRect();
		let delta = host.querySelector('[data-slot="stat-card-delta"]')!.getBoundingClientRect();
		let card = host.querySelector('[data-slot="stat-card"]')!.getBoundingClientRect();

		expect(Math.abs(delta.top + delta.height / 2 - (label.top + label.height / 2))).toBeLessThan(2);
		expect(delta.right).toBeCloseTo(card.right - 21, 0);
	});

	for (let width of [320, 960]) {
		test(`keeps a skeleton exactly as tall as the card at ${width}px`, () => {
			let host = mount(
				<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
					<Latency />
					<StatCard.Skeleton />
				</div>,
				width,
			);
			let [card, skeleton] = host.querySelectorAll<HTMLElement>('[data-slot="stat-card"]');

			expect(skeleton!.getAttribute("aria-hidden")).toBe("true");
			expect(skeleton!.getBoundingClientRect().height).toBeCloseTo(
				card!.getBoundingClientRect().height,
				0,
			);
		});
	}

	for (let variant of ["cards", "tabs"] as const) {
		for (let width of [375, 768, 1440]) {
			for (let delta of [true, false]) {
				test(`keeps ${variant} skeletons as tall as cards ${delta ? "with" : "without"} a delta in a ${width}px group`, () => {
					let host = mount(
						<div>
							<StatCard.Group variant={variant} aria-label="Overview">
								{FOOTERS.map((footer) => (
									<StatCard key={footer}>
										<StatCard.Label>Uptime</StatCard.Label>
										<StatCard.Value>99.98%</StatCard.Value>
										{delta ? (
											<StatCard.Delta trend="up" comparison="vs previous 24 hours">
												+0.02%
											</StatCard.Delta>
										) : null}
										<StatCard.Footer>{footer}</StatCard.Footer>
									</StatCard>
								))}
							</StatCard.Group>
							<StatCard.Group variant={variant} aria-hidden="true">
								{FOOTERS.map((footer) => (
									<StatCard.Skeleton key={footer} delta={delta} />
								))}
							</StatCard.Group>
						</div>,
						width,
					);
					let cards = [...host.querySelectorAll<HTMLElement>('[data-slot="stat-card"]')];
					let heights = cards.map((card) => card.getBoundingClientRect().height);

					for (let index of FOOTERS.keys()) {
						expect(
							Math.abs(heights[index + FOOTERS.length]! - heights[index]!),
						).toBeLessThanOrEqual(1);
					}
				});
			}
		}
	}

	for (let width of [375, 1440]) {
		test(`wraps a skeleton given the footer exactly like the card in a ${width}px group`, () => {
			let footer = "Out of 43,200 estimated";
			let host = mount(
				<div>
					<StatCard.Group aria-label="Monitor">
						{[0, 1, 2, 3].map((index) => (
							<StatCard key={index}>
								<StatCard.Label>Pings</StatCard.Label>
								<StatCard.Value>290</StatCard.Value>
								<StatCard.Footer>{footer}</StatCard.Footer>
							</StatCard>
						))}
					</StatCard.Group>
					<StatCard.Group aria-hidden="true">
						{[0, 1, 2, 3].map((index) => (
							<StatCard.Skeleton
								key={index}
								label="Pings"
								footer={footer}
								footerLines={1}
								delta={false}
							/>
						))}
					</StatCard.Group>
				</div>,
				width,
			);
			let cards = [...host.querySelectorAll<HTMLElement>('[data-slot="stat-card"]')];
			let real = cards[0]!.querySelector<HTMLElement>('[data-slot="stat-card-footer"]')!;
			let lines = Math.round(
				real.getBoundingClientRect().height / parseFloat(getComputedStyle(real).lineHeight),
			);
			expect(lines).toBe(width === 375 ? 2 : 1);
			let heights = cards.map((card) => card.getBoundingClientRect().height);
			for (let index of [0, 1, 2, 3]) {
				expect(Math.abs(heights[index + 4]! - heights[index]!)).toBeLessThanOrEqual(1);
			}
		});

		test(`wraps a skeleton given the label exactly like the card in a ${width}px group`, () => {
			let label = "Monthly Pings Usage";
			let host = mount(
				<div>
					<StatCard.Group aria-label="Monitor">
						{[0, 1, 2, 3].map((index) => (
							<StatCard key={index}>
								<StatCard.Label>{label}</StatCard.Label>
								<StatCard.Value>290</StatCard.Value>
								<StatCard.Footer>Out of 176,429 estimated</StatCard.Footer>
							</StatCard>
						))}
					</StatCard.Group>
					<StatCard.Group aria-hidden="true">
						{[0, 1, 2, 3].map((index) => (
							<StatCard.Skeleton key={index} label={label} delta={false} />
						))}
					</StatCard.Group>
				</div>,
				width,
			);
			let cards = [...host.querySelectorAll<HTMLElement>('[data-slot="stat-card"]')];
			let heights = cards.map((card) => card.getBoundingClientRect().height);
			for (let index of [0, 1, 2, 3]) {
				expect(Math.abs(heights[index + 4]! - heights[index]!)).toBeLessThanOrEqual(1);
			}
			let real = cards[0]!.querySelector<HTMLElement>('[data-slot="stat-card-label"]')!;
			let lines = Math.round(
				real.getBoundingClientRect().height / parseFloat(getComputedStyle(real).lineHeight),
			);
			expect(lines).toBe(width === 375 ? 2 : 1);
			let text = host.querySelector<HTMLElement>('[data-slot="stat-card-skeleton-label"]')!;
			expect(getComputedStyle(text).color).toBe("rgba(0, 0, 0, 0)");
			expect(text.closest('[aria-hidden="true"]')).not.toBeNull();
		});
	}

	for (let [width, footer] of [
		[343, "checkout-api is down since 05:41."],
		[1100, "checkout-api has been down since 05:41 and is still failing."],
	] as const) {
		test(`reserves two footer lines with footerLines={2} in a ${width}px four-column group`, () => {
			let host = mount(
				<div>
					<StatCard.Group variant="tabs" columns={4} aria-label="Overview">
						{[0, 1, 2, 3].map((index) => (
							<StatCard key={index} href={`#${index}`}>
								<StatCard.Label>Uptime</StatCard.Label>
								<StatCard.Value>99.98%</StatCard.Value>
								<StatCard.Delta trend="down" comparison="vs previous 24 hours">
									-0.11 pts
								</StatCard.Delta>
								<StatCard.Footer>{footer}</StatCard.Footer>
							</StatCard>
						))}
					</StatCard.Group>
					<StatCard.Group variant="tabs" columns={4} aria-hidden="true">
						{[0, 1, 2, 3].map((index) => (
							<StatCard.Skeleton key={index} footerLines={2} />
						))}
					</StatCard.Group>
				</div>,
				width,
			);
			let cards = [...host.querySelectorAll<HTMLElement>('[data-slot="stat-card"]')];
			let footers = cards
				.slice(0, 4)
				.map((card) => card.querySelector<HTMLElement>('[data-slot="stat-card-footer"]')!);
			for (let element of footers) {
				let lineHeight = parseFloat(getComputedStyle(element).lineHeight);
				expect(Math.round(element.getBoundingClientRect().height / lineHeight)).toBe(2);
			}
			let heights = cards.map((card) => card.getBoundingClientRect().height);
			for (let index of [0, 1, 2, 3]) {
				expect(Math.abs(heights[index + 4]! - heights[index]!)).toBeLessThanOrEqual(1);
			}
		});
	}

	for (let [width, count] of [
		[272, 1],
		[320, 2],
		[600, 2],
		[1100, 4],
	] as const) {
		test(`lays a group out in ${count} column(s) in a ${width}px container`, () => {
			let host = mount(<Four />, width);
			let group = host.querySelector<HTMLElement>('[data-slot="stat-group"]')!;

			expect(columns(host)).toBe(count);
			expect(group.scrollWidth).toBeLessThanOrEqual(width);
		});
	}

	test("sets four full cards as two compact rows of two in a 375px container", () => {
		let host = mount(
			<StatCard.Group aria-label="Overview">
				<Latency />
				<Latency />
				<Latency />
				<Latency />
			</StatCard.Group>,
			375,
		);
		let group = host.querySelector<HTMLElement>('[data-slot="stat-group"]')!;
		let cards = [...host.querySelectorAll<HTMLElement>('[data-slot="stat-card"]')];
		let rows = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top)));
		let value = getComputedStyle(host.querySelector('[data-slot="stat-card-value"]')!);

		expect(columns(host)).toBe(2);
		expect(rows.size).toBe(2);
		expect(group.scrollWidth).toBeLessThanOrEqual(375);
		for (let card of cards) expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
		expect(Number.parseFloat(value.fontSize)).toBeLessThan(30);
	});

	test("sets four full cards in one row at 1280px", () => {
		let host = mount(
			<StatCard.Group aria-label="Overview">
				<Latency />
				<Latency />
				<Latency />
				<Latency />
			</StatCard.Group>,
			1280,
		);
		let cards = [...host.querySelectorAll<HTMLElement>('[data-slot="stat-card"]')];
		let rows = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top)));
		let value = getComputedStyle(host.querySelector('[data-slot="stat-card-value"]')!);

		expect(columns(host)).toBe(4);
		expect(rows.size).toBe(1);
		expect(value.fontSize).toBe("30px");
	});

	test("makes tab cards links reachable by Tab, marking the current metric", async () => {
		let host = mount(<Four variant="tabs" />);
		let links = [...host.querySelectorAll<HTMLAnchorElement>("a[data-slot='stat-card']")];

		expect(links).toHaveLength(4);
		expect(links[0]!.getAttribute("aria-current")).toBe("true");
		expect(links[1]!.hasAttribute("aria-current")).toBe(false);
		await expect.element(page.getByRole("group", { name: "Overview" })).toBeInTheDocument();
		await expect
			.element(page.getByRole("link", { name: "Error rate 2" }))
			.toHaveAttribute("href", "?metric=2");

		await userEvent.keyboard("{Tab}");
		expect(document.activeElement).toBe(links[0]);
		await userEvent.keyboard("{Tab}");
		expect(document.activeElement).toBe(links[1]);
		expect(getComputedStyle(links[1]!).outlineStyle).toBe("solid");
		expect(getComputedStyle(links[0]!).boxShadow).toContain("inset");
	});

	test("divides tab cards with rules and no doubled edge at the strip's border", () => {
		let host = mount(<Four variant="tabs" />, 1100);
		let group = host
			.querySelector<HTMLElement>('[data-slot="stat-group"]')!
			.getBoundingClientRect();
		let last = [...host.querySelectorAll<HTMLElement>("a")].at(-1)!.getBoundingClientRect();

		expect(last.right).toBeGreaterThan(group.right - 1);
		expect(last.bottom).toBeGreaterThan(group.bottom - 1);
	});
});
