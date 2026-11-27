/**
 * The walk every static reader of a scene shares, and the rules for who counts as met and who the
 * characters screen lists, which the library, `check()` and the dev tools all apply.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Directive } from "./directives.js";

import { eachDirective, isListed, isMet, walkBranches } from "./unlocks.js";

import { cast, character, createScene, scene, scenes } from "./index.js";

const SCENES = scenes({ opening: scene() });

const CAST = cast({
	mika: character({ name: "cast.mika" }),
	extra: character({ name: "cast.ren", lore: { listed: false } }),
});

const OPENING = createScene(SCENES.opening, (ctx) => [
	ctx.narrate("opening.welcome"),
	ctx.when(
		() => true,
		[ctx.narrate("opening.lucky")],
		[ctx.choose({ "cafe.stay": [ctx.narrate("opening.unlucky")] })],
	),
	ctx.narrate("opening.done"),
]);

/** The key of a line directive, or its type for any other. */
function label(directive: Directive): string {
	return directive.type === "narrate" ? directive.key : directive.type;
}

describe(eachDirective, () => {
	test("visits every directive in document order, each branch right after its holder", () => {
		let seen: string[] = [];
		eachDirective(OPENING.directives, (directive) => seen.push(label(directive)));
		expect(seen).toEqual([
			"opening.welcome",
			"when",
			"opening.lucky",
			"choose",
			"opening.unlucky",
			"opening.done",
		]);
	});
});

describe(walkBranches, () => {
	test("hands each branch its own scope and resumes the list with the scope before it", () => {
		let depths: [string, number][] = [];
		walkBranches(
			OPENING.directives,
			0,
			(directive, depth) => depths.push([label(directive), depth]),
			(depth) => depth + 1,
		);
		expect(depths).toEqual([
			["opening.welcome", 0],
			["when", 0],
			["opening.lucky", 1],
			["choose", 1],
			["opening.unlucky", 2],
			["opening.done", 0],
		]);
	});
});

describe(isMet, () => {
	test("counts any one of introduced, a line spoken or a look drawn", () => {
		let none = { introduced: false, spoke: false, drawn: false };
		expect(isMet(none)).toBe(false);
		expect(isMet({ ...none, introduced: true })).toBe(true);
		expect(isMet({ ...none, spoke: true })).toBe(true);
		expect(isMet({ ...none, drawn: true })).toBe(true);
	});
});

describe(isListed, () => {
	test("leaves out only a character declared listed: false", () => {
		expect(isListed(CAST.mika)).toBe(true);
		expect(isListed(CAST.extra)).toBe(false);
	});
});
