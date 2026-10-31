/**
 * Lays out {@link FanOutDiagram} in a real browser: the figure's name and target list,
 * every stub meeting its chip and every chip inside the card at phone and wider widths,
 * the source clear of the pause toggle, separate keyframes per shape, and reduced motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import { FanOutDiagram } from "./fan-out-diagram.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult[] = [];

afterEach(async () => {
	await page.viewport(414, 896);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
	for (let result of mounted) result.cleanup();
	mounted = [];
	document.body.innerHTML = "";
});

/** Six readers of one feed, one name long enough to wrap in a narrow chip. */
const TARGETS: FanOutDiagram.Target[] = [
	{ title: "Ana", detail: "+3 posts" },
	{ title: "Benjamin from the platform team", detail: "+3 posts" },
	{ title: "Chen", detail: "+3 posts" },
	{ title: "Dana", detail: "+3 posts" },
	{ title: "Eli", detail: "+3 posts" },
	{ title: "Farah", detail: "+3 posts" },
];

/** Mounts a diagram in a column of `width` pixels and returns its host. */
function mount(
	width = 280,
	targets: readonly FanOutDiagram.Target[] = TARGETS,
	direction: FanOutDiagram.Direction = "out",
): HTMLElement {
	let host = document.createElement("div");
	host.style.cssText = `inline-size: ${width}px; container-type: inline-size`;
	document.body.appendChild(host);
	mounted.push(
		render(
			<FanOutDiagram
				aria-label="One fetch, every reader"
				direction={direction}
				source={{ title: "Feed fetched once", detail: "GET /feed.xml" }}
				targets={targets}
				outcome="Delivered to every reader"
				footnote="Checked every 15 minutes"
			/>,
			{ container: host },
		),
	);
	return host;
}

/** Whether two boxes share any area. */
function overlaps(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** The boxes of every target's stub, chip and bus, in list order. */
function targetBoxes(host: HTMLElement) {
	return [...host.querySelectorAll<HTMLElement>('[data-slot="fan-out-diagram-target"]')].map(
		(target) => ({
			stub: target.querySelector('[data-slot="fan-out-diagram-stub"]')!.getBoundingClientRect(),
			chip: target.querySelector('[data-slot="fan-out-diagram-chip"]')!.getBoundingClientRect(),
			bus: target.querySelector('[data-slot="fan-out-diagram-bus"]')!.getBoundingClientRect(),
		}),
	);
}

describe("FanOutDiagram", () => {
	test("names the figure and lists every target", () => {
		let host = mount();
		let figure = host.querySelector("figure")!;
		expect(figure.getAttribute("aria-label")).toBe("One fetch, every reader");
		expect(figure.querySelector("ul")!.children).toHaveLength(TARGETS.length);
		expect(host.textContent).toContain("Feed fetched once");
		expect(host.textContent).toContain("Delivered to every reader");
		expect(host.textContent).toContain("Checked every 15 minutes");
	});

	test("uses two columns in a phone column and three once the card is wide", () => {
		let columns = (host: HTMLElement) =>
			getComputedStyle(host.querySelector("ul")!).gridTemplateColumns.split(" ").length;
		expect(columns(mount(280))).toBe(2);
		expect(columns(mount(480))).toBe(3);
		expect(columns(mount(480, TARGETS.slice(0, 2)))).toBe(2);
	});

	for (let width of [280, 480]) {
		for (let direction of ["out", "in"] as const) {
			test(`meets every chip with its stub and keeps chips inside the card at ${width}px, ${direction}`, () => {
				for (let count of [2, 3, 4, 5, 6]) {
					let host = mount(width, TARGETS.slice(0, count), direction);
					let card = host.querySelector("figure")!.getBoundingClientRect();
					for (let { bus, chip, stub } of targetBoxes(host)) {
						if (direction === "out") {
							expect(Math.abs(stub.bottom - chip.top)).toBeLessThanOrEqual(2);
							expect(Math.abs(stub.top - bus.top)).toBeLessThanOrEqual(2);
						} else {
							expect(Math.abs(stub.top - chip.bottom)).toBeLessThanOrEqual(2);
							expect(Math.abs(stub.bottom - bus.bottom)).toBeLessThanOrEqual(2);
						}
						expect(stub.left).toBeGreaterThanOrEqual(bus.left - 1);
						expect(stub.right).toBeLessThanOrEqual(bus.right + 1);
						expect(chip.left).toBeGreaterThanOrEqual(card.left);
						expect(chip.right).toBeLessThanOrEqual(card.right);
					}
					expect(host.scrollWidth).toBeLessThanOrEqual(width);
				}
			});
		}
	}

	test("meets the trunk with the nearest row's bus", () => {
		for (let direction of ["out", "in"] as const) {
			for (let count of [3, 4, 5]) {
				let host = mount(280, TARGETS.slice(0, count), direction);
				let trunk = host
					.querySelector('[data-slot="fan-out-diagram-trunk"]')!
					.getBoundingClientRect();
				let center = (trunk.left + trunk.right) / 2;
				let buses = targetBoxes(host).map(({ bus }) => bus);
				let touching = buses.filter((bus) =>
					direction === "out"
						? Math.abs(bus.top - trunk.bottom) <= 2
						: Math.abs(bus.bottom - trunk.top) <= 2,
				);
				expect(touching.some((bus) => bus.left <= center && center <= bus.right)).toBe(true);
			}
		}
	});

	/** Swept across phone widths, because where the source's words wrap decides the reach. */
	test("keeps the source text and the top targets clear of the pause toggle", async () => {
		let hits: string[] = [];
		for (let direction of ["out", "in"] as const) {
			for (let width = 260; width <= 420; width += 8) {
				await page.viewport(width, 900);
				let result = render(
					<div style={{ padding: "0 16px" }}>
						<FanOutDiagram
							aria-label="One incident, every channel"
							direction={direction}
							source={{ title: "Checkout is failing in every region", detail: "checkout.http" }}
							targets={TARGETS}
						/>
					</div>,
				);
				let toggle = result.$('[data-slot="motion-loop"] > :last-child')!.getBoundingClientRect();
				let walker = document.createTreeWalker(result.$("figure")!, NodeFilter.SHOW_TEXT);
				while (walker.nextNode()) {
					let range = document.createRange();
					range.selectNodeContents(walker.currentNode);
					if ([...range.getClientRects()].some((line) => overlaps(line, toggle))) {
						hits.push(`${direction}@${width}`);
					}
				}
				result.cleanup();
			}
		}
		expect(hits).toEqual([]);
	});

	test("animates different counts and directions on separate keyframes", () => {
		let chipAnimation = (host: HTMLElement) =>
			getComputedStyle(host.querySelector('[data-slot="fan-out-diagram-chip"]')!).animationName;
		let six = chipAnimation(mount(320));
		let four = chipAnimation(mount(320, TARGETS.slice(0, 4)));
		let sixIn = chipAnimation(mount(320, TARGETS, "in"));
		expect(six).toMatch(/^ui-fan-out-diagram-out-chip-6-0/);
		expect(new Set([six, four, sixIn]).size).toBe(3);
	});

	test("holds still on the delivered state under reduced motion", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		let host = mount(320);
		let animated = [...host.querySelectorAll("figure *")].filter(
			(element) => getComputedStyle(element).animationName !== "none",
		);
		expect(animated).toEqual([]);
		let outcome = host.querySelector('[data-slot="fan-out-diagram-outcome"]')!;
		expect(getComputedStyle(outcome).opacity).toBe("1");
		let check = host.querySelector('[data-slot="fan-out-diagram-chip"] svg')!;
		expect(getComputedStyle(check).opacity).toBe("1");
	});
});
