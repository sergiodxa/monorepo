/**
 * Renders `TitleHero` in a real browser: the art fills the hero behind its text and fades into
 * the page, the hero tucks under a top bar by its offset, the heading takes the level asked
 * for, and the feature size stands taller than the title size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { TitleHero } from "./title-hero.js";

import "../reset.css";
import "../theme.css";

/** Mounts a hero `width` pixels wide and returns its section. */
function mount(width: number, size: TitleHero.Size, level: 1 | 2 = 1): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	host.style.setProperty("--ui-title-hero-offset", "64px");
	host.style.paddingTop = "64px";
	document.body.appendChild(host);
	render(
		<TitleHero
			size={size}
			art={<span style={{ background: "rgb(30 60 90)" }} />}
			aria-labelledby="hero"
		>
			<TitleHero.Eyebrow>Original</TitleHero.Eyebrow>
			<TitleHero.Title id="hero" level={level}>
				Tidewater
			</TitleHero.Title>
			<TitleHero.Facts>
				<TitleHero.Rating>16+</TitleHero.Rating>
				<span>2026</span>
			</TitleHero.Facts>
			<TitleHero.Summary>A harbour town keeps one secret a season.</TitleHero.Summary>
			<TitleHero.Actions>
				<a href="/watch">Play</a>
			</TitleHero.Actions>
		</TitleHero>,
		{ container: host },
	);
	return host.querySelector<HTMLElement>("[data-slot=title-hero]")!;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("TitleHero", () => {
	test("fills itself with the art and pulls up under the top bar by its offset", () => {
		let hero = mount(1000, "feature");
		let host = hero.parentElement!.getBoundingClientRect();
		let box = hero.getBoundingClientRect();
		let art = hero.querySelector<HTMLElement>("[data-slot=title-hero-art] > span")!;
		expect(box.top).toBeCloseTo(host.top, 0);
		expect(art.offsetWidth).toBeCloseTo(box.width, 0);
		expect(art.offsetHeight).toBeCloseTo(box.height, 0);
		let title = hero.querySelector("h1")!.getBoundingClientRect();
		expect(title.top).toBeGreaterThan(box.top + 64);
	});

	test("labels itself by its heading at the level asked for", () => {
		let hero = mount(800, "title", 2);
		expect(hero.querySelector("h1")).toBeNull();
		expect(hero.querySelector("h2")?.id).toBe(hero.getAttribute("aria-labelledby"));
	});

	test("stands taller as a feature than at the head of a title's page", () => {
		let feature = mount(1000, "feature").getBoundingClientRect().height;
		document.body.replaceChildren();
		let title = mount(1000, "title").getBoundingClientRect().height;
		expect(feature).toBeGreaterThan(title);
	});

	test("keeps its text within a phone's width", () => {
		let hero = mount(360, "feature");
		let content = hero.querySelector("[data-slot=title-hero-content]")!.getBoundingClientRect();
		expect(content.right).toBeLessThanOrEqual(hero.getBoundingClientRect().right);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});
});
