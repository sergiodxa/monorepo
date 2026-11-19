/**
 * Holds the stage to its layout in a real browser: the 16:9 surface letterboxed in any box,
 * characters placed in their columns and capped to them, speaker focus drawn with scale and
 * brightness only when it tells speakers apart, and thumbnails drawn from a saved stage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import type { FrameCharacter, FrameStage } from "../stage.js";

import { columnOf, stillStage } from "./layout.js";
import { Stage } from "./stage.js";
import { finiteAnimations, settle, stageImages } from "./transitions.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** An SVG sprite as a data URL, so images load without a server. */
function sprite(color: string, width = 200, height = 400): string {
	return `data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`,
	)}`;
}

/** A character on stage. */
function character(id: string, at: `${number}/${number}`, speaking: boolean): FrameCharacter {
	return { id, at, images: [sprite("pink")], speaking };
}

/** Mounts a stage in a box of the given size. */
function mount(stage: FrameStage, box: { width: number; height: number }, focus = true) {
	let container = document.createElement("div");
	container.style.width = `${box.width}px`;
	container.style.height = `${box.height}px`;
	document.body.append(container);
	mounted = render(<Stage stage={stage} locale="en" focus={focus} />, { container });
	return mounted;
}

/** The surface's box relative to the stage's. */
function surface(result: RenderResult) {
	let outer = result.$("[data-novel-stage]")!.getBoundingClientRect();
	let inner = result.$("[data-novel-surface]")!.getBoundingClientRect();
	return {
		left: inner.left - outer.left,
		top: inner.top - outer.top,
		width: inner.width,
		height: inner.height,
	};
}

/** A character's box relative to the surface. */
function placed(result: RenderResult, id: string) {
	let inner = result.$("[data-novel-surface]")!.getBoundingClientRect();
	let box = result.$(`[data-novel-character][data-id="${id}"]`)!.getBoundingClientRect();
	return { left: Math.round(box.left - inner.left), width: Math.round(box.width) };
}

/** An empty stage. */
const EMPTY: FrameStage = { background: null, image: null, characters: [] };

describe("Stage", () => {
	test("letterboxes the 16:9 surface top and bottom in a tall box", () => {
		let result = mount(EMPTY, { width: 800, height: 600 });
		expect(surface(result)).toEqual({ left: 0, top: 75, width: 800, height: 450 });
	});

	test("pillarboxes the surface left and right in a wide box", () => {
		let result = mount(EMPTY, { width: 1000, height: 450 });
		expect(surface(result)).toEqual({ left: 100, top: 0, width: 800, height: 450 });
	});

	test("keeps 16:9 from its width alone when its box has no height", () => {
		let container = document.createElement("div");
		container.style.width = "640px";
		document.body.append(container);
		mounted = render(<Stage stage={EMPTY} locale="en" />, { container });
		expect(mounted.$("[data-novel-surface]")!.getBoundingClientRect().height).toBe(360);
	});

	test("places each character in its column, as wide as the column", () => {
		let result = mount(
			{
				...EMPTY,
				characters: [
					character("mika", "1/3", false),
					character("ren", "2/3", false),
					character("aki", "3/3", false),
				],
			},
			{ width: 900, height: 506.25 },
		);
		expect(placed(result, "mika")).toEqual({ left: 0, width: 300 });
		expect(placed(result, "ren")).toEqual({ left: 300, width: 300 });
		expect(placed(result, "aki")).toEqual({ left: 600, width: 300 });
	});

	test("splits the stage in halves and centers a lone 1/1 character", () => {
		let result = mount(
			{ ...EMPTY, characters: [character("mika", "1/2", false), character("ren", "2/2", false)] },
			{ width: 800, height: 450 },
		);
		expect(placed(result, "mika")).toEqual({ left: 0, width: 400 });
		expect(placed(result, "ren")).toEqual({ left: 400, width: 400 });
		mounted?.cleanup();
		let alone = mount(
			{ ...EMPTY, characters: [character("mika", "1/1", false)] },
			{ width: 800, height: 450 },
		);
		expect(placed(alone, "mika")).toEqual({ left: 0, width: 800 });
	});

	test("draws a sprite no wider than its column, bottom aligned", async () => {
		let wide = sprite("teal", 2000, 400);
		let result = mount(
			{ ...EMPTY, characters: [{ id: "mika", at: "1/4", images: [wide], speaking: false }] },
			{ width: 800, height: 450 },
		);
		let image = result.$("[data-novel-character] img") as HTMLImageElement;
		await image.decode();
		let box = image.getBoundingClientRect();
		let column = result.$("[data-novel-character]")!.getBoundingClientRect();
		expect(box.width).toBeLessThanOrEqual(column.width);
		expect(getComputedStyle(image).objectFit).toBe("contain");
		expect(getComputedStyle(image).objectPosition).toBe("50% 100%");
	});

	test("stacks a layered character's images in one box", () => {
		let result = mount(
			{
				...EMPTY,
				characters: [
					{ id: "ren", at: "2/3", images: [sprite("navy"), sprite("tan")], speaking: false },
				],
			},
			{ width: 900, height: 506.25 },
		);
		let [body, face] = [...result.$$("[data-novel-character] img")].map((image) =>
			image.getBoundingClientRect(),
		);
		expect(face).toEqual(body);
	});

	test("enlarges and raises the speaker and dims the others", () => {
		let result = mount(
			{ ...EMPTY, characters: [character("mika", "1/3", true), character("ren", "3/3", false)] },
			{ width: 800, height: 450 },
		);
		let speaker = getComputedStyle(result.$('[data-id="mika"]')!);
		let listener = getComputedStyle(result.$('[data-id="ren"]')!);
		expect(speaker.transform).toBe("matrix(1.05, 0, 0, 1.05, 0, 0)");
		expect(Number(speaker.zIndex)).toBeGreaterThan(Number(listener.zIndex));
		expect(speaker.filter).toBe("none");
		expect(listener.filter).toBe("brightness(0.6)");
		expect(speaker.transitionProperty).toContain("transform");
		expect(speaker.transitionProperty).toContain("filter");
	});

	test("dims nobody when nobody on stage speaks, or one character stands alone", () => {
		let narration = mount(
			{ ...EMPTY, characters: [character("mika", "1/3", false), character("ren", "3/3", false)] },
			{ width: 800, height: 450 },
		);
		for (let element of narration.$$("[data-novel-character]")) {
			expect(getComputedStyle(element).filter).toBe("none");
		}
		mounted?.cleanup();
		let alone = mount(
			{ ...EMPTY, characters: [character("mika", "2/3", true)] },
			{ width: 800, height: 450 },
		);
		expect(getComputedStyle(alone.$('[data-id="mika"]')!).transform).toBe("none");
	});

	test("turns focus off with focus={false}", () => {
		let result = mount(
			{ ...EMPTY, characters: [character("mika", "1/3", true), character("ren", "3/3", false)] },
			{ width: 800, height: 450 },
			false,
		);
		expect(getComputedStyle(result.$('[data-id="mika"]')!).transform).toBe("none");
		expect(getComputedStyle(result.$('[data-id="ren"]')!).filter).toBe("none");
	});

	test("glides focus to the next speaker through a CSS transition", async () => {
		let stage: FrameStage = {
			...EMPTY,
			characters: [character("mika", "1/3", true), character("ren", "3/3", false)],
		};
		let result = mount(stage, { width: 800, height: 450 });
		expect(getComputedStyle(result.$('[data-id="ren"]')!).filter).toBe("brightness(0.6)");
		await result.act(() =>
			result.root.render(
				<Stage
					stage={{
						...EMPTY,
						characters: [character("mika", "1/3", false), character("ren", "3/3", true)],
					}}
					locale="en"
				/>,
			),
		);
		let running = finiteAnimations(result.$("[data-novel-stage]")!);
		expect(running.length).toBeGreaterThan(0);
		await settle(result.$("[data-novel-stage]")!);
		expect(getComputedStyle(result.$('[data-id="ren"]')!).transform).toBe(
			"matrix(1.05, 0, 0, 1.05, 0, 0)",
		);
		expect(getComputedStyle(result.$('[data-id="mika"]')!).filter).toBe("brightness(0.6)");
	});

	test("fades in a character entering with fade, and draws a custom transition as a class", () => {
		let result = mount(
			{
				...EMPTY,
				characters: [
					{ ...character("mika", "1/3", false), transition: "fade" },
					{ ...character("ren", "3/3", false), transition: "spin" },
				],
			},
			{ width: 800, height: 450 },
		);
		expect(getComputedStyle(result.$('[data-id="mika"]')!).transitionProperty).toContain("opacity");
		expect(result.$('[data-id="ren"]')!.classList.contains("spin")).toBe(true);
	});

	test("draws the background under the characters and the full-screen image over them", () => {
		let result = mount(
			{
				background: { id: "backgrounds.cafe", src: sprite("green") },
				image: { id: "images.letter", src: { en: sprite("white"), ja: sprite("black") } },
				characters: [character("mika", "1/3", false)],
			},
			{ width: 800, height: 450 },
		);
		let background = Number(getComputedStyle(result.$('[data-novel-layer="background"]')!).zIndex);
		let person = Number(getComputedStyle(result.$("[data-novel-character]")!).zIndex);
		let image = Number(getComputedStyle(result.$('[data-novel-layer="image"]')!).zIndex);
		expect(background).toBeLessThan(person);
		expect(person).toBeLessThan(image);
		expect(result.$('[data-novel-layer="image"] img')!.getAttribute("src")).toBe(sprite("white"));
		expect(result.$('[data-novel-layer="background"]')!.style.viewTransitionName).toMatch(
			/^novel-/,
		);
	});

	test("draws a saved stage as a thumbnail with no transition names", () => {
		let saved = stillStage({
			background: { id: "backgrounds.cafe", src: sprite("green"), transition: "fade" },
			image: null,
			characters: [{ id: "mika", at: "1/3", images: [sprite("pink")], transition: "slide" }],
		});
		expect(saved.background).toEqual({ id: "backgrounds.cafe", src: sprite("green") });
		expect(saved.characters[0]).toEqual({
			id: "mika",
			at: "1/3",
			images: [sprite("pink")],
			speaking: false,
		});
		let container = document.createElement("div");
		container.style.width = "192px";
		container.style.height = "108px";
		document.body.append(container);
		mounted = render(<Stage stage={saved} locale="en" transitions={false} />, { container });
		expect(mounted.$('[data-novel-layer="background"]')!.style.viewTransitionName).toBe("");
		expect(placed(mounted, "mika")).toEqual({ left: 0, width: 64 });
	});
});

describe(columnOf, () => {
	test("answers the left edge and width of a column", () => {
		expect(columnOf("2/3")).toEqual({ left: "33.3333%", width: "33.3333%", leftSide: false });
		expect(columnOf("1/2")).toEqual({ left: "0%", width: "50%", leftSide: true });
	});

	test("centers a malformed position on the whole stage", () => {
		expect(columnOf("4/3")).toEqual({ left: "0%", width: "100%", leftSide: false });
	});
});

describe(stageImages, () => {
	test("lists every file the stage draws once, localized", () => {
		let stage: FrameStage = {
			background: { id: "bg", src: "/bg.webp" },
			image: { id: "cg", src: { en: "/cg-en.webp", ja: "/cg-ja.webp" } },
			characters: [{ id: "mika", at: "1/3", images: ["/bg.webp", "/mika.webp"], speaking: false }],
		};
		expect(stageImages(stage, "ja-JP")).toEqual(["/bg.webp", "/cg-ja.webp", "/mika.webp"]);
	});
});
