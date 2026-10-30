/**
 * Holds landing defects shut in a real browser: a CTA's radius losing to whichever
 * stylesheet loaded last, a stat strip leaving its odd last figure alone on a row, lead
 * copy drawn below 4.5:1 against the page, and an emphasis fragment breaking its sentence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/// <reference types="vite/client" />

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Button } from "../components/button.js";
import { Feature } from "../components/feature.js";
import { LinkButton } from "../components/link-button.js";
import { StatStrip } from "../components/stat-strip.js";
import { marketingCtaChrome } from "../styles/marketing.js";

import { LandingHero } from "./landing-hero.js";

import "../theme.css";

/** A neutral ramp an app defines, at the lightness steps every scale in the theme shares. */
const NEUTRAL_RAMP = {
	50: "oklch(0.985 0.003 275)",
	100: "oklch(0.965 0.005 275)",
	200: "oklch(0.915 0.008 275)",
	500: "oklch(0.62 0.014 275)",
	600: "oklch(0.52 0.014 275)",
	900: "oklch(0.235 0.008 275)",
} as const;

/** Hosts mounted by a test, removed after it so layout never leaks between cases. */
let hosts: HTMLElement[] = [];

afterEach(() => {
	for (let host of hosts) host.remove();
	hosts = [];
});

/** Mounts `node` in a column `width` pixels wide, attached to the document for real layout. */
function mount(node: RemixNode, width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	hosts.push(host);
	return render(node, { container: host }).container;
}

/** The sRGB channels a CSS color paints as, read back from a one-pixel canvas. */
function rgb(color: string): [number, number, number] {
	let canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	let context = canvas.getContext("2d")!;
	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	let [r, g, b] = context.getImageData(0, 0, 1, 1).data;
	return [r!, g!, b!];
}

/** WCAG relative luminance of an sRGB color. */
function luminance([r, g, b]: [number, number, number]): number {
	let [lr, lg, lb] = [r, g, b].map((channel) => {
		let c = channel / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

/** WCAG contrast ratio between two CSS colors. */
function contrast(foreground: string, background: string): number {
	let [high, low] = [luminance(rgb(foreground)), luminance(rgb(background))].sort((a, b) => b - a);
	return (high! + 0.05) / (low! + 0.05);
}

describe("marketing regressions", () => {
	test("a CTA takes the marketing radius whichever stylesheet the page loaded first", () => {
		document.documentElement.style.setProperty("--ui-marketing-cta-radius", "12px");
		let root = mount(
			<>
				<span mix={[marketingCtaChrome()]}>Chrome registered before any control</span>
				<Button>Plain first</Button>
				<Button color="brand" mix={[marketingCtaChrome()]}>
					Start free
				</Button>
				<LinkButton href="/docs" variant="surface" mix={[marketingCtaChrome()]}>
					Read the docs
				</LinkButton>
				<Button>Plain last</Button>
			</>,
			720,
		);
		let [plainFirst, cta, link, plainLast] = [...root.querySelectorAll("button, a")];

		/** The chrome's class reaches the page first, so its layer sits under the control's own. */

		expect(getComputedStyle(cta!).borderTopLeftRadius).toBe("12px");
		expect(getComputedStyle(link!).borderTopLeftRadius).toBe("12px");
		expect(getComputedStyle(plainFirst!).borderTopLeftRadius).toBe("6px");
		expect(getComputedStyle(plainLast!).borderTopLeftRadius).toBe("6px");
		document.documentElement.style.removeProperty("--ui-marketing-cta-radius");
	});

	test("a stat strip spans an odd last figure across the row on a phone", () => {
		let root = mount(
			<StatStrip>
				<StatStrip.Item label="Uptime">99.99%</StatStrip.Item>
				<StatStrip.Item label="Regions">12</StatStrip.Item>
				<StatStrip.Item label="Checks a day">4M</StatStrip.Item>
			</StatStrip>,
			375,
		);
		let strip = root.querySelector('[data-slot="stat-strip"]')!.getBoundingClientRect();
		let last = [...root.querySelectorAll('[data-slot="stat-strip-item"]')].at(-1)!;

		expect(last.getBoundingClientRect().width).toBe(strip.width);
	});

	test("a stat strip sets every figure on one row from the lg container", () => {
		let root = mount(
			<StatStrip>
				<StatStrip.Item label="Uptime">99.99%</StatStrip.Item>
				<StatStrip.Item label="Regions">12</StatStrip.Item>
				<StatStrip.Item label="Checks a day">4M</StatStrip.Item>
			</StatStrip>,
			900,
		);
		let tops = [...root.querySelectorAll('[data-slot="stat-strip-item"]')].map(
			(item) => item.getBoundingClientRect().top,
		);

		expect(new Set(tops).size).toBe(1);
	});

	test("hero lead copy reads at 4.5:1 or better against the page", () => {
		for (let [step, value] of Object.entries(NEUTRAL_RAMP)) {
			document.documentElement.style.setProperty(`--ui-color-neutral-${step}`, value);
		}
		let root = mount(
			<div style={{ backgroundColor: "var(--ui-bg)" }}>
				<LandingHero tone="plain" title="Uptime" description="Know before your users do." />
			</div>,
			720,
		);
		let lead = root.querySelector("p")!;
		let page = getComputedStyle(root.firstElementChild!).backgroundColor;

		expect(contrast(getComputedStyle(lead).color, page)).toBeGreaterThanOrEqual(4.5);
		for (let step of Object.keys(NEUTRAL_RAMP)) {
			document.documentElement.style.removeProperty(`--ui-color-neutral-${step}`);
		}
	});

	test("an emphasis fragment in a feature description stays on its sentence's line", () => {
		let root = mount(
			<Feature.Description>
				Runs from <strong>three continents</strong> at once.
			</Feature.Description>,
			720,
		);
		let description = root.querySelector('[data-slot="feature-description"]')!;
		let strong = description.querySelector("strong")!;
		let lead = document.createRange();
		lead.selectNodeContents(description.firstChild!);

		expect(strong.getBoundingClientRect().top).toBe(lead.getBoundingClientRect().top);
	});
});
