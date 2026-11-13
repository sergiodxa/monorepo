/**
 * Tests the sponsors page's two lists in a real browser, inside the blog's 85ch column:
 * current sponsors named under their pictures, past ones as a wall of circles, and both
 * kept inside a 375px screen with the ways to join closing the last list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { Sponsor } from "~/app/services/sponsors";

import { SponsorLists } from "~/resources/views/sponsors";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** The lists the current test mounted, unmounted after it. */
let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** A sponsor whose fields derive from their login; no picture, so the circle shows initials. */
function sponsor(login: string, name = `${login} the sponsor`): Sponsor {
	return { login, name, avatarUrl: "", url: `https://github.com/${login}` };
}

/** `count` sponsors with distinct logins under `prefix`. */
function sponsors(prefix: string, count: number): Sponsor[] {
	return Array.from({ length: count }, (_, index) => sponsor(`${prefix}${index}`));
}

/** Mounts the lists in the blog's column at `width` and returns the column. */
async function mount(width: number, current: Sponsor[], past: Sponsor[]): Promise<HTMLElement> {
	await page.viewport(width, 900);
	mounted = render(
		<div style={{ maxInlineSize: "85ch", marginInline: "auto", paddingInline: "1rem" }}>
			<SponsorLists roster={{ current, past }} />
		</div>,
	);
	return mounted.container.firstElementChild as HTMLElement;
}

/** The elements inside `root` whose box crosses the viewport's right edge. */
function overflowing(root: HTMLElement): Element[] {
	let edge = document.documentElement.clientWidth;
	return [...root.querySelectorAll("*")].filter(
		(element) => element.getBoundingClientRect().right > edge + 0.5,
	);
}

describe("SponsorLists", () => {
	test("names each current sponsor under a large circle, every name the same width", async () => {
		let column = await mount(
			1440,
			[
				sponsor("remix-run", "Remix"),
				sponsor("long", "A sponsor whose display name runs well past one line"),
				...sponsors("c", 6),
			],
			[],
		);
		let current = column.querySelector("#current")!;
		let names = [...current.querySelectorAll<HTMLElement>('[data-slot="sponsor-wall-name"]')];

		expect(names.map((name) => name.textContent)).toContain("Remix");
		expect(names).toHaveLength(8);
		for (let name of names) expect(name.getBoundingClientRect().height).toBeGreaterThan(0);
		let widths = new Set(
			[...current.querySelectorAll('[data-slot="sponsor-wall-person"]')].map(
				(person) => person.getBoundingClientRect().width,
			),
		);
		expect(widths.size).toBe(1);
	});

	test("draws past sponsors as unnamed circles and closes on the ways to join", async () => {
		let column = await mount(1440, sponsors("c", 3), sponsors("p", 75));
		let past = column.querySelector("#past")!;
		let current = column.querySelector("#current")!;

		expect(past.querySelectorAll('[data-slot="sponsor-wall-person"]')).toHaveLength(75);
		expect(past.querySelector('[data-slot="sponsor-wall-name"]')).toBeNull();
		expect(past.querySelector('a[aria-label="p0 the sponsor"]')).not.toBeNull();
		expect(past.querySelector('a[href="https://github.com/sponsors/sergiodxa"]')).not.toBeNull();
		expect(current.querySelector('a[href="https://github.com/sponsors/sergiodxa"]')).toBeNull();
	});

	test("keeps both lists inside a 375px screen", async () => {
		let column = await mount(375, sponsors("c", 8), sponsors("p", 75));

		expect(overflowing(column)).toEqual([]);
	});
});
