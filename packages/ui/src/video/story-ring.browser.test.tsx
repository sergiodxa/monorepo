/**
 * Lays the story ring out in a real page: its outer size, the picture filling the space inside
 * the ring with a gap, and the quiet ring a seen story gets in place of the bright one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { StoryRing } from "./story-ring.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("StoryRing", () => {
	test("draws its picture inside a ring of the size it is given", () => {
		mounted = render(
			<StoryRing size={4}>
				<span id="face" style="background: rgb(10 20 30)" />
			</StoryRing>,
		);
		let ring = mounted.container.querySelector<HTMLElement>("[data-slot=story-ring]")!;
		let face = mounted.container.querySelector<HTMLElement>("#face")!;
		expect(ring.getBoundingClientRect().width).toBe(64);
		expect(face.getBoundingClientRect().width).toBeGreaterThan(52);
		expect(face.getBoundingClientRect().width).toBeLessThan(62);
		expect(getComputedStyle(face).borderRadius).not.toBe("0px");
	});

	test("takes a CSS length, so a page can size it by breakpoint", () => {
		mounted = render(
			<div style="--ring: 80px">
				<StoryRing size="var(--ring)">
					<span />
				</StoryRing>
			</div>,
		);
		let ring = mounted.container.querySelector<HTMLElement>("[data-slot=story-ring]")!;
		expect(ring.getBoundingClientRect().width).toBe(80);
	});

	test("paints a seen ring quietly whatever its size, after rings of other sizes", () => {
		mounted = render(
			<div style="--ui-story-ring: rgb(220 60 40); --ui-neutral-border-strong: rgb(160 160 160)">
				<StoryRing size={3}>
					<span />
				</StoryRing>
				<StoryRing id="big-seen" seen size={7}>
					<span />
				</StoryRing>
			</div>,
		);
		let seen = getComputedStyle(mounted.container.querySelector("#big-seen")!).backgroundColor;
		expect(seen).toBe("rgb(160, 160, 160)");
	});

	test("paints a seen ring in a different colour than an unseen one", () => {
		mounted = render(
			<div style="--ui-story-ring: rgb(220 60 40); --ui-neutral-border-strong: rgb(160 160 160)">
				<StoryRing id="new">
					<span />
				</StoryRing>
				<StoryRing id="old" seen>
					<span />
				</StoryRing>
			</div>,
		);
		let fresh = getComputedStyle(mounted.container.querySelector("#new")!).backgroundColor;
		let seen = getComputedStyle(mounted.container.querySelector("#old")!).backgroundColor;
		expect(fresh).toBe("rgb(220, 60, 40)");
		expect(seen).toBe("rgb(160, 160, 160)");
	});
});
