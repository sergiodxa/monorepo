/**
 * Checks the colour and edge tokens a landing page reads, in a real browser with the theme
 * loaded: text on brand and inverse bands, muted copy, surfaces under a scoped palette in
 * dark, eyebrow pills, band padding and the edge an inset band's copy starts on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Button } from "../components/button.js";
import { MarketingHeader } from "../components/marketing-header.js";
import { MarketingSection } from "../components/marketing-section.js";
import { marketingCtaChrome, themeScope } from "../styles/marketing.js";
import { Eyebrow } from "../utils/eyebrow.js";

import "../reset.css";
import "../theme.css";

/** Lightness of each palette step, shared by every ramp below. */
const LIGHTNESS = {
	50: 0.985,
	100: 0.965,
	200: 0.915,
	300: 0.84,
	400: 0.73,
	500: 0.62,
	600: 0.52,
	700: 0.42,
	800: 0.32,
	900: 0.235,
	950: 0.155,
} as const;

/** Hosts mounted by a test, removed after it so layout never leaks between cases. */
let hosts: HTMLElement[] = [];

/** The page's own palette: a cool neutral and a green brand, as an app's stylesheet sets. */
const PAGE_PALETTE = { ...ramp("neutral", 275, 0.012), ...ramp("brand", 168, 0.12) };

beforeEach(() => {
	for (let [name, value] of Object.entries(PAGE_PALETTE)) {
		document.documentElement.style.setProperty(name, value);
	}
});

afterEach(() => {
	for (let host of hosts) host.remove();
	hosts = [];
	for (let name of Object.keys(PAGE_PALETTE)) document.documentElement.style.removeProperty(name);
});

/** Palette declarations for a ramp of `tone` at `hue` and `chroma`. */
function ramp(tone: string, hue: number, chroma: number): Record<string, string> {
	return Object.fromEntries(
		Object.entries(LIGHTNESS).map(([step, l]) => [
			`--ui-color-${tone}-${step}`,
			`oklch(${l} ${chroma} ${hue})`,
		]),
	);
}

/**
 * Mounts `node` in a column `width` pixels wide, forced into dark when `scheme` asks.
 */
function mount(node: RemixNode, width = 720, scheme: "light" | "dark" = "light"): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	if (scheme === "dark") host.className = "dark";
	document.body.appendChild(host);
	hosts.push(host);
	return render(node, { container: host }).container;
}

/** The sRGB channels a CSS color paints as, read back from a one-pixel canvas. */
function rgb(color: string): [number, number, number, number] {
	let canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	let context = canvas.getContext("2d")!;
	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	let [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
	return [r!, g!, b!, a!];
}

/** `color` composited over the opaque `backdrop`, as the eye sees text with alpha. */
function over(color: string, backdrop: string): [number, number, number] {
	let [r, g, b, a] = rgb(color);
	let [br, bg, bb] = rgb(backdrop);
	let alpha = a / 255;
	return [r * alpha + br * (1 - alpha), g * alpha + bg * (1 - alpha), b * alpha + bb * (1 - alpha)];
}

/** WCAG relative luminance of an sRGB color. */
function luminance([r, g, b]: [number, number, number]): number {
	let [lr, lg, lb] = [r, g, b].map((channel) => {
		let c = channel / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

/** WCAG contrast of `text` (alpha composited) on the opaque `backdrop`. */
function contrast(text: string, backdrop: string): number {
	let [r, g, b] = rgb(backdrop);
	let a = luminance(over(text, backdrop));
	let z = luminance([r, g, b]);
	return (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05);
}

/** A band with an eyebrow, title and lead, as a closing or feature band composes them. */
function band(tone: MarketingSection.Tone): RemixNode {
	return (
		<MarketingSection tone={tone}>
			<MarketingHeader eyebrow="Ready when you are" description="Send your first event today.">
				Ship usage pricing
			</MarketingHeader>
		</MarketingSection>
	);
}

describe("band tokens", () => {
	for (let scheme of ["light", "dark"] as const) {
		test(`a brand band's lead and eyebrow read at 4.5:1 in ${scheme}`, () => {
			let root = mount(band("brand"), 720, scheme);
			let section = root.querySelector("section")!;
			let fill = getComputedStyle(section).backgroundColor;
			let lead = root.querySelector("header p")!;
			let label = root.querySelector("header span[data-variant]")!;

			expect(contrast(getComputedStyle(lead).color, fill)).toBeGreaterThanOrEqual(4.5);
			expect(contrast(getComputedStyle(label).color, fill)).toBeGreaterThanOrEqual(4.5);
		});
	}

	test("an inverse band's lead and eyebrow read at 4.5:1, over a page's brand eyebrow", () => {
		let root = mount(
			<div style={{ "--ui-marketing-eyebrow-color": "var(--ui-color-brand-600)" }}>
				{band("inverse")}
			</div>,
		);
		let fill = getComputedStyle(root.querySelector("section")!).backgroundColor;

		for (let text of root.querySelectorAll("header p, header span[data-variant]")) {
			expect(contrast(getComputedStyle(text).color, fill)).toBeGreaterThanOrEqual(4.5);
		}
	});

	test("muted copy reads at 4.5:1 on a tinted band and stays quieter than body copy", () => {
		let root = mount(
			<div style={{ backgroundColor: "var(--ui-color-neutral-100)" }}>
				<p style={{ color: "var(--ui-neutral-fg-muted)" }}>Muted</p>
				<p style={{ color: "var(--ui-neutral-fg)" }}>Body</p>
			</div>,
		);
		let [muted, body] = [...root.querySelectorAll("p")].map((p) => getComputedStyle(p).color);

		let tint = getComputedStyle(root.firstElementChild!).backgroundColor;

		expect(contrast(muted!, tint)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(muted!, tint)).toBeLessThan(contrast(body!, tint));
	});

	test("themeScope gives raised surfaces and hairlines the scoped palette's hue in dark", () => {
		let warm = ramp("neutral", 55, 0.012);
		let root = mount(
			<div style={warm} mix={[themeScope()]}>
				<div data-cell style={{ backgroundColor: "var(--ui-surface-raised)" }} />
				<div
					data-expected
					style={{
						backgroundColor: `color-mix(in oklch, ${warm["--ui-color-neutral-950"]}, ${warm["--ui-color-neutral-900"]})`,
					}}
				/>
			</div>,
			720,
			"dark",
		);

		expect(getComputedStyle(root.querySelector("[data-cell]")!).backgroundColor).toBe(
			getComputedStyle(root.querySelector("[data-expected]")!).backgroundColor,
		);
	});

	test("a numbered eyebrow draws its index at full ink", () => {
		let root = mount(
			<Eyebrow variant="numbered" index="02">
				Platform
			</Eyebrow>,
		);
		let index = root.querySelector('[data-slot="eyebrow-index"]')!;

		expect(getComputedStyle(index).opacity).toBe("1");
		expect(getComputedStyle(index).color).toBe(getComputedStyle(index.parentElement!).color);
	});

	test("a pill eyebrow that wraps rounds its corners at 1rem instead of a lozenge", () => {
		let root = mount(
			<Eyebrow variant="quiet">Status pages now support custom domains for every plan</Eyebrow>,
			200,
		);
		let pill = root.querySelector("span[data-variant]")!;

		expect(pill.getBoundingClientRect().height).toBeGreaterThan(32);
		expect(getComputedStyle(pill).borderTopLeftRadius).toBe("16px");
	});

	test("band padding lands on whole pixels", () => {
		for (let width of [375, 768, 1111]) {
			let root = mount(band("plain"), width);
			let padding = Number.parseFloat(getComputedStyle(root.querySelector("section")!).paddingTop);

			expect(Number.isInteger(padding)).toBe(true);
		}
	});

	test("an inset band's copy starts on the same edge as a plain band's", () => {
		for (let width of [375, 768, 1440]) {
			let root = mount(
				<>
					{band("plain")}
					<MarketingSection tone="tinted" inset>
						<MarketingHeader>Inset</MarketingHeader>
					</MarketingSection>
				</>,
				width,
			);
			let [plain, inset] = [...root.querySelectorAll("h2")].map(
				(title) => title.getBoundingClientRect().left,
			);

			expect({ width, inset }).toEqual({ width, inset: expect.closeTo(plain!, 0) });
		}
	});

	test("an inset band frames the content measure instead of the viewport", () => {
		let root = mount(
			<MarketingSection tone="tinted" inset>
				<MarketingHeader>Inset</MarketingHeader>
			</MarketingSection>,
			1440,
		);
		let section = root.querySelector("section")!.getBoundingClientRect();

		expect(section.width).toBeLessThanOrEqual(80 * 16);
		expect(section.left - root.getBoundingClientRect().left).toBeCloseTo(
			root.getBoundingClientRect().right - section.right,
			0,
		);
	});

	test("marketing CTA chrome animates only colour and shadow", () => {
		let root = mount(<Button mix={[marketingCtaChrome()]}>Start</Button>);

		expect(getComputedStyle(root.querySelector("button")!).transitionProperty).toBe(
			"background-color, box-shadow, color",
		);
	});
});
