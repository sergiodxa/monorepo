/**
 * Checks {@link LandingHero}'s release pin and load entrance in a real browser: the pin
 * sits under the actions in mono type, and the entrance staggers the parts in reading
 * order, media last, and drops out when motion is reduced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp } from "vitest/browser";

import { LandingHero } from "./landing-hero.js";

/** Mounts a hero with every part and returns the host. */
function mount(entrance: boolean): HTMLElement {
	let host = document.createElement("div");
	host.style.width = "1024px";
	document.body.appendChild(host);
	render(
		<LandingHero
			entrance={entrance}
			eyebrow="New"
			title="Ship the release"
			description="A lead."
			actions={<a href="/start">Start</a>}
			release={<a href="/changelog/8-1">v8.1 — released Oct 28</a>}
			media={<div style="height: 200px">Shot</div>}
		/>,
		{ container: host },
	);
	return host;
}

/** The element matching `selector` inside `root`, failing the test when it is missing. */
function find(root: Element, selector: string): HTMLElement {
	let element = root.querySelector<HTMLElement>(selector);
	if (!element) throw new Error(`missing ${selector}`);
	return element;
}

afterEach(async () => {
	document.body.replaceChildren();
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

describe("LandingHero release", () => {
	test("pins the release under the actions in mono type", () => {
		let host = mount(false);
		let pin = find(host, '[data-slot="landing-hero-release"]');
		let actions = find(
			host,
			'[data-slot="cta-group"], [data-slot="landing-hero-copy"] > div:has(a[href="/start"])',
		);

		expect(pin.getBoundingClientRect().top).toBeGreaterThan(actions.getBoundingClientRect().bottom);
		expect(getComputedStyle(pin).fontFamily).toMatch(/mono/i);
		expect(getComputedStyle(find(pin, "a")).textDecorationLine).toBe("none");
	});
});

describe("LandingHero entrance", () => {
	test("staggers the parts in reading order and settles the media last", () => {
		let host = mount(true);
		let title = find(host, "h1");
		let pin = find(host, '[data-slot="landing-hero-release"]');
		let media = find(host, '[data-slot="landing-hero-media"]');

		expect(getComputedStyle(title).animationName).toBe("ui-entrance-rise");
		expect(getComputedStyle(title).animationDelay).toBe("0.07s");
		expect(getComputedStyle(pin).animationDelay).toBe("0.28s");
		expect(getComputedStyle(media).animationName).toBe("ui-entrance-settle");
		expect(getComputedStyle(media).animationDelay).toBe("0.48s");
	});

	test("stays at rest without the prop, and when motion is reduced", async () => {
		expect(getComputedStyle(find(mount(false), "h1")).animationName).toBe("none");
		document.body.replaceChildren();

		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		expect(getComputedStyle(find(mount(true), "h1")).animationName).toBe("none");
	});
});
