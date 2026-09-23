/**
 * The glyphs a shortcut hint prints for each modifier. A hint is wrong on the other
 * platform, so the mapping is a pure function of which keyboard is in front of the reader
 * and the abstract combo an app writes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The Apple glyphs, which are what a Mac keyboard has printed on it. */
const APPLE_GLYPHS: Record<string, string> = {
	mod: "⌘",
	shift: "⇧",
	alt: "⌥",
	ctrl: "⌃",
	enter: "↵",
	esc: "esc",
};

/** The spelled-out names every other platform uses. */
const OTHER_GLYPHS: Record<string, string> = {
	mod: "Ctrl",
	shift: "Shift",
	alt: "Alt",
	ctrl: "Ctrl",
	enter: "Enter",
	esc: "Esc",
};

/**
 * One shortcut as separate keys, ready to render a chip each.
 *
 * @param combo - The abstract combo, e.g. `"mod+shift+k"`, where `mod` stands for the
 * platform's own primary modifier.
 * @param appleKeyboard - Whether the reader's keyboard carries the Apple glyphs.
 * @returns The keys in press order, each already the glyph to print.
 * @example shortcutKeys("mod+k", true) // ["⌘", "K"]
 */
export function shortcutKeys(combo: string, appleKeyboard: boolean): string[] {
	let glyphs = appleKeyboard ? APPLE_GLYPHS : OTHER_GLYPHS;

	return combo.split("+").map((key) => {
		let named = glyphs[key.toLowerCase()];
		return named ?? (key.length === 1 ? key.toUpperCase() : key);
	});
}
