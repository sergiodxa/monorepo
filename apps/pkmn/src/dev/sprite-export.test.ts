import { isFailure, isSuccess } from "@pkg/result";
/**
 * Verifies the pure sprite-export payload shaping: a valid name derives the
 * `src/assets/<name>.png` write path, the manifest image id, and the served
 * `/assets/<name>.png` URL; invalid names (empty, uppercase, traversal-ish,
 * bad separators, over-length) are rejected; and manifest registration adds the
 * image without mutating the input or clobbering existing entries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { validateWritePath } from "./path-safety";
import {
	deriveSpriteTarget,
	registerSpriteImage,
	SpriteNameError,
	SPRITE_ASSET_DIR,
} from "./sprite-export";

describe("deriveSpriteTarget accepts valid names", () => {
	let cases: Array<[input: string, name: string]> = [
		["hero", "hero"],
		["  hero  ", "hero"],
		["player-front", "player-front"],
		["tile01", "tile01"],
		["a", "a"],
	];

	for (let [input, name] of cases) {
		test(`${JSON.stringify(input)} -> ${name}`, () => {
			let result = deriveSpriteTarget(input);
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.name).toBe(name);
				expect(result.data.path).toBe(`${SPRITE_ASSET_DIR}/${name}.png`);
				expect(result.data.url).toBe(`/assets/${name}.png`);
			}
		});
	}

	test("the derived path always passes the path-safety guard", () => {
		let result = deriveSpriteTarget("player-front");
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(isSuccess(validateWritePath(result.data.path))).toBe(true);
		}
	});
});

describe("deriveSpriteTarget rejects invalid names", () => {
	let cases: Array<[label: string, input: string]> = [
		["empty", ""],
		["whitespace only", "   "],
		["uppercase", "Hero"],
		["underscore", "my_sprite"],
		["space", "my sprite"],
		["leading hyphen", "-hero"],
		["trailing hyphen", "hero-"],
		["dot / extension", "hero.png"],
		["slash / traversal", "../hero"],
		["nested slash", "sub/hero"],
		["over 64 chars", "a".repeat(65)],
	];

	for (let [label, input] of cases) {
		test(label, () => {
			let result = deriveSpriteTarget(input);
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) expect(result.error).toBeInstanceOf(SpriteNameError);
		});
	}
});

describe("registerSpriteImage", () => {
	test("adds the sprite under images by id → url", () => {
		let manifest = { images: {}, audio: {}, maps: {}, atlases: {} };
		let next = registerSpriteImage(manifest, {
			name: "hero",
			path: "src/assets/hero.png",
			url: "/assets/hero.png",
		});
		expect(next.images).toEqual({ hero: "/assets/hero.png" });
	});

	test("preserves existing images and other manifest kinds", () => {
		let manifest = {
			images: { existing: "/assets/existing.png" },
			audio: { theme: { url: "/audio/theme.ogg" } },
			maps: {},
			atlases: {},
		};
		let next = registerSpriteImage(manifest, {
			name: "hero",
			path: "src/assets/hero.png",
			url: "/assets/hero.png",
		});
		expect(next.images).toEqual({
			existing: "/assets/existing.png",
			hero: "/assets/hero.png",
		});
		expect(next.audio).toEqual({ theme: { url: "/audio/theme.ogg" } });
	});

	test("does not mutate the input manifest", () => {
		let manifest = { images: {} as Record<string, string>, audio: {}, maps: {} };
		registerSpriteImage(manifest, {
			name: "hero",
			path: "src/assets/hero.png",
			url: "/assets/hero.png",
		});
		expect(manifest.images).toEqual({});
	});

	test("overwrites an existing entry with the same id", () => {
		let manifest = { images: { hero: "/assets/old.png" }, audio: {}, maps: {} };
		let next = registerSpriteImage(manifest, {
			name: "hero",
			path: "src/assets/hero.png",
			url: "/assets/hero.png",
		});
		expect(next.images.hero).toBe("/assets/hero.png");
	});
});
