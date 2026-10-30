/**
 * Runs the looping marketing motion in a real browser: {@link Marquee} scrolls a doubled
 * track and stops on its toggle, {@link RotatingText} holds the widest word's width, and
 * {@link MotionLoop} pauses its content; under reduced motion all of it holds still.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import { entrance } from "../animations/entrance.js";

import { Marquee } from "./marquee.js";
import { MotionLoop } from "./motion-loop.js";
import { RotatingText } from "./rotating-text.js";

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 800): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The element matching `selector` inside `root`, failing the test when it is missing. */
function find<T extends Element = HTMLElement>(root: Element, selector: string): T {
	let element = root.querySelector<T>(selector);
	if (!element) throw new Error(`missing ${selector}`);
	return element;
}

/** Emulates the visitor's motion preference for the rest of the test. */
async function prefersReducedMotion(): Promise<void> {
	await cdp().send("Emulation.setEmulatedMedia", {
		features: [{ name: "prefers-reduced-motion", value: "reduce" }],
	});
}

/** Six fixed-size marks, wide enough together to overflow a 600px marquee. */
function marks(): JSX.Element[] {
	return ["Acme", "Globex", "Initech", "Umbrella", "Hooli", "Soylent"].map((name) => (
		<span key={name} style="display: inline-block; width: 120px">
			{name}
		</span>
	));
}

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(async () => {
	document.body.replaceChildren();
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

describe("Marquee", () => {
	test("scrolls a doubled track by one copy and hides the copy from assistive technology", () => {
		let host = mount(<Marquee>{marks()}</Marquee>, 600);
		let track = find(host, '[data-slot="marquee-track"]');
		let [first, copy] = host.querySelectorAll<HTMLElement>('[data-slot="marquee-group"]');

		expect(getComputedStyle(track).animationName).toBe("ui-marquee-scroll");
		expect(copy?.getAttribute("aria-hidden")).toBe("true");
		expect(copy?.inert).toBe(true);
		expect(first!.getBoundingClientRect().width).toBe(copy!.getBoundingClientRect().width);
		expect(track.getBoundingClientRect().width).toBe(2 * first!.getBoundingClientRect().width);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});

	test("pauses while its toggle is checked", async () => {
		let host = mount(<Marquee>{marks()}</Marquee>, 600);
		let track = find(host, '[data-slot="marquee-track"]');
		let toggle = find<HTMLInputElement>(host, '[data-slot="pause-toggle"] input');

		expect(toggle.getAttribute("aria-label")).toBe("Pause the scrolling logos");
		expect(getComputedStyle(track).animationPlayState).toBe("running");
		toggle.click();
		expect(getComputedStyle(track).animationPlayState).toBe("paused");
	});

	test("becomes a centered, wrapping row without the copy or toggle when motion is reduced", async () => {
		await prefersReducedMotion();
		let host = mount(<Marquee>{marks()}</Marquee>, 600);
		let track = find(host, '[data-slot="marquee-track"]');
		let [first, copy] = host.querySelectorAll<HTMLElement>('[data-slot="marquee-group"]');

		expect(getComputedStyle(track).animationName).toBe("none");
		expect(getComputedStyle(copy!).display).toBe("none");
		expect(getComputedStyle(first!).flexWrap).toBe("wrap");
		expect(getComputedStyle(find(host, '[data-slot="pause-toggle"]')).display).toBe("none");
		let viewport = find(host, '[data-slot="marquee-viewport"]');
		expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
	});
});

describe("RotatingText", () => {
	test("is as wide as its widest word and reads every word to assistive technology", () => {
		let host = mount(
			<p>
				Status pages for <RotatingText words={["teams", "agencies", "platform companies"]} />
			</p>,
		);
		let words = [...host.querySelectorAll<HTMLElement>('[data-slot="rotating-text-word"]')];
		let stack = words[0]!.parentElement!;
		let widest = Math.max(...words.map((word) => word.getBoundingClientRect().width));

		expect(stack.getBoundingClientRect().width).toBe(widest);
		expect(stack.getAttribute("aria-hidden")).toBe("true");
		expect(host.textContent).toContain("teams, agencies, platform companies");
		expect(getComputedStyle(words[1]!).animationDelay).toBe("2.5s");
		expect(getComputedStyle(words[0]!).animationIterationCount).toBe("2");
	});

	test("shows the first word only when motion is reduced", async () => {
		await prefersReducedMotion();
		let host = mount(<RotatingText words={["teams", "agencies"]} />);
		let [first, second] = host.querySelectorAll<HTMLElement>('[data-slot="rotating-text-word"]');

		expect(getComputedStyle(first!).animationName).toBe("none");
		expect(getComputedStyle(first!).opacity).toBe("1");
		expect(getComputedStyle(second!).opacity).toBe("0");
	});
});

describe("MotionLoop", () => {
	test("pauses every animation inside, pseudo-elements included, from its corner toggle", () => {
		let host = mount(
			<MotionLoop>
				<div data-spin style="width: 40px; height: 40px">
					<Marquee>{marks()}</Marquee>
				</div>
			</MotionLoop>,
		);
		let loop = find(host, '[data-slot="motion-loop"]');
		let toggle = find(host, '[data-slot="motion-loop"] > [data-slot="pause-toggle"]');
		let track = find(host, '[data-slot="marquee-track"]');

		let loopBox = loop.getBoundingClientRect();
		let toggleBox = toggle.getBoundingClientRect();
		expect(Math.round(loopBox.right - toggleBox.right)).toBe(12);
		expect(Math.round(loopBox.bottom - toggleBox.bottom)).toBe(12);

		find<HTMLInputElement>(toggle, "input").click();
		expect(getComputedStyle(track).animationPlayState).toBe("paused");
	});
});

describe("entrance", () => {
	test("staggers copy by 70ms and holds media 200ms more, and drops out under reduced motion", async () => {
		let host = mount(
			<div>
				<h1 mix={[entrance({ order: 1 })]}>Title</h1>
				<figure mix={[entrance({ order: 3, kind: "media" })]}>Shot</figure>
			</div>,
		);
		let title = find(host, "h1");
		let media = find(host, "figure");

		expect(getComputedStyle(title).animationName).toBe("ui-entrance-rise");
		expect(getComputedStyle(title).animationDelay).toBe("0.07s");
		expect(getComputedStyle(media).animationName).toBe("ui-entrance-settle");
		expect(getComputedStyle(media).animationDelay).toBe("0.41s");

		await prefersReducedMotion();
		expect(getComputedStyle(title).animationName).toBe("none");
		expect(getComputedStyle(title).opacity).toBe("1");
	});
});
