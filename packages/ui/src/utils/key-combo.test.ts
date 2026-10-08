/**
 * Unit tests for the combo parser, matcher and glyph formatter, driven with plain objects
 * standing in for a `keydown` so every rule about case, Shift and the platform modifier
 * is asserted without a document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { isTypingTarget, keyComboGlyphs, matchesKeyCombo, parseKeyCombo } from "./key-combo.js";

/** A keystroke with every modifier up unless the assertion holds one down. */
function key(
	value: string,
	held: Partial<Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">> = {},
) {
	return { key: value, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...held };
}

describe(parseKeyCombo.name, () => {
	test("keeps a bare character's case and marks it a character combo", () => {
		expect(parseKeyCombo("J")).toMatchObject({ key: "J", character: true, shift: false });
	});

	test("lowercases the trigger of a chord and reads every modifier spelling", () => {
		expect(parseKeyCombo("Mod+Shift+K")).toMatchObject({
			key: "k",
			character: false,
			mod: true,
			shift: true,
		});
		expect(parseKeyCombo("control+option+cmd+x")).toMatchObject({
			ctrl: true,
			alt: true,
			meta: true,
			mod: false,
		});
	});

	test("lowercases a named key with no modifier", () => {
		expect(parseKeyCombo("Escape")).toMatchObject({ key: "escape", character: false });
	});
});

describe(matchesKeyCombo.name, () => {
	test("a bare character matches the character typed, whatever Shift produced it", () => {
		expect(matchesKeyCombo(key("?", { shiftKey: true }), "?")).toBe(true);
		expect(matchesKeyCombo(key("J", { shiftKey: true }), "J")).toBe(true);
		expect(matchesKeyCombo(key("J", { shiftKey: true }), "j")).toBe(false);
		expect(matchesKeyCombo(key("j"), "J")).toBe(false);
	});

	test("a bare character stands down with Control, Alt or Meta held", () => {
		expect(matchesKeyCombo(key("j", { ctrlKey: true }), "j")).toBe(false);
		expect(matchesKeyCombo(key("j", { altKey: true }), "j")).toBe(false);
		expect(matchesKeyCombo(key("j", { metaKey: true }), "j")).toBe(false);
	});

	test("`mod` is satisfied by Command or by Control", () => {
		expect(matchesKeyCombo(key("k", { metaKey: true }), "mod+k")).toBe(true);
		expect(matchesKeyCombo(key("k", { ctrlKey: true }), "mod+k")).toBe(true);
		expect(matchesKeyCombo(key("k"), "mod+k")).toBe(false);
	});

	test("a chord requires exactly its modifiers, so a larger chord does not fire it", () => {
		expect(matchesKeyCombo(key("K", { metaKey: true, shiftKey: true }), "mod+shift+k")).toBe(true);
		expect(matchesKeyCombo(key("K", { metaKey: true, shiftKey: true }), "mod+k")).toBe(false);
		expect(matchesKeyCombo(key("k", { metaKey: true, altKey: true }), "mod+k")).toBe(false);
	});

	test("`ctrl` and `cmd` each name their own key", () => {
		expect(matchesKeyCombo(key("b", { ctrlKey: true }), "ctrl+b")).toBe(true);
		expect(matchesKeyCombo(key("b", { metaKey: true }), "ctrl+b")).toBe(false);
		expect(matchesKeyCombo(key("b", { metaKey: true }), "cmd+b")).toBe(true);
	});

	test("a named key matches in any case with no modifier held", () => {
		expect(matchesKeyCombo(key("Escape"), "esc")).toBe(true);
		expect(matchesKeyCombo(key("Escape"), "escape")).toBe(true);
		expect(matchesKeyCombo(key("Escape", { shiftKey: true }), "escape")).toBe(false);
	});

	test("an empty combo never matches", () => {
		expect(matchesKeyCombo(key(""), "")).toBe(false);
		expect(matchesKeyCombo(key("k", { metaKey: true }), "mod+")).toBe(false);
	});
});

describe(keyComboGlyphs.name, () => {
	test("prints the Apple glyphs on an Apple keyboard", () => {
		expect(keyComboGlyphs("mod+shift+z", true)).toEqual(["⌘", "⇧", "Z"]);
		expect(keyComboGlyphs("ctrl+alt+enter", true)).toEqual(["⌃", "⌥", "↵"]);
	});

	test("spells the modifiers out on every other keyboard", () => {
		expect(keyComboGlyphs("mod+k", false)).toEqual(["Ctrl", "K"]);
		expect(keyComboGlyphs("esc", false)).toEqual(["Esc"]);
	});

	test("prints a bare character as written, since its case is the binding", () => {
		expect(keyComboGlyphs("j", true)).toEqual(["j"]);
		expect(keyComboGlyphs("J", false)).toEqual(["J"]);
		expect(keyComboGlyphs("?", false)).toEqual(["?"]);
	});

	test("upper-cases each key of a sequence", () => {
		expect(keyComboGlyphs("g+i", true)).toEqual(["G", "I"]);
	});
});

describe(isTypingTarget.name, () => {
	test("is false for a target that is not an element", () => {
		expect(isTypingTarget(null)).toBe(false);
		expect(isTypingTarget(new EventTarget())).toBe(false);
	});
});
