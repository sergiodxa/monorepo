/**
 * Keyboard shortcut combos as written once and read twice: matched against a `keydown`
 * and printed as the key caps a hint shows. One spelling (`"mod+k"`, `"?"`, `"J"`) serves
 * both, so a binding and the hint advertising it never disagree about the platform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Where a reader is typing, and so where a bare letter is a letter rather than a command.
 */
export const TYPING_TARGET_SELECTOR =
	'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

/** Modifier spellings meaning the platform's primary modifier: Command on Apple, Control elsewhere. */
const MOD_TOKENS = new Set(["mod"]);

/** Modifier spellings meaning the Control key itself, on every platform. */
const CTRL_TOKENS = new Set(["ctrl", "control"]);

/** Modifier spellings meaning the Command (Meta) key itself. */
const META_TOKENS = new Set(["cmd", "command", "meta"]);

/** Modifier spellings meaning Alt, which Apple keyboards print as Option. */
const ALT_TOKENS = new Set(["alt", "option"]);

/** Short spellings of a named key, mapped to the `KeyboardEvent.key` value they stand for. */
const KEY_ALIASES: Record<string, string> = { esc: "escape" };

/** The glyph an Apple keyboard prints on each modifier and named key. */
const APPLE_GLYPHS: Record<string, string> = {
	mod: "⌘",
	cmd: "⌘",
	command: "⌘",
	meta: "⌘",
	shift: "⇧",
	alt: "⌥",
	option: "⌥",
	ctrl: "⌃",
	control: "⌃",
	enter: "↵",
	esc: "esc",
	escape: "esc",
};

/** The spelled-out name every other keyboard prints on each modifier and named key. */
const OTHER_GLYPHS: Record<string, string> = {
	mod: "Ctrl",
	cmd: "Meta",
	command: "Meta",
	meta: "Meta",
	shift: "Shift",
	alt: "Alt",
	option: "Alt",
	ctrl: "Ctrl",
	control: "Ctrl",
	enter: "Enter",
	esc: "Esc",
	escape: "Esc",
};

/**
 * A combo split into its trigger and the modifiers held with it. A bare single character
 * is a `character` combo: it names the character typed, so its case is significant and
 * Shift is whatever produced it.
 */
export interface KeyCombo {
	/** `KeyboardEvent.key` the combo fires on; lowercased unless the combo is a bare character. */
	key: string;
	/** Whether the combo is one typed character with no modifier listed. */
	character: boolean;
	/** Whether the platform's primary modifier, Command or Control, is held. */
	mod: boolean;
	ctrl: boolean;
	meta: boolean;
	alt: boolean;
	shift: boolean;
}

/**
 * Splits a `+`-joined combo into its trigger key and modifiers, matching modifier names
 * case-insensitively. Unknown tokens before the trigger are ignored.
 *
 * @param combo The combo as written, e.g. `"mod+shift+k"`, `"escape"`, `"?"`.
 * @returns The trigger key and the modifier flags {@link matchesKeyCombo} compares.
 * @example parseKeyCombo("J") // { key: "J", character: true, … }
 */
export function parseKeyCombo(combo: string): KeyCombo {
	let tokens = combo
		.split("+")
		.map((token) => token.trim())
		.filter((token) => token.length > 0);

	let trigger = tokens.at(-1) ?? "";
	let modifiers = tokens.slice(0, -1).map((token) => token.toLowerCase());
	let character = modifiers.length === 0 && trigger.length === 1;

	let named = trigger.toLowerCase();

	return {
		key: character ? trigger : (KEY_ALIASES[named] ?? named),
		character,
		mod: modifiers.some((token) => MOD_TOKENS.has(token)),
		ctrl: modifiers.some((token) => CTRL_TOKENS.has(token)),
		meta: modifiers.some((token) => META_TOKENS.has(token)),
		alt: modifiers.some((token) => ALT_TOKENS.has(token)),
		shift: modifiers.includes("shift"),
	};
}

/**
 * Whether a keystroke strikes exactly `combo`. A character combo matches the character
 * typed with Control, Alt and Meta all up; any other combo matches its key in any case
 * with exactly the listed modifiers held, so it never fires on a larger chord.
 *
 * @param event The keystroke, or any object carrying its key and modifier flags.
 * @param combo The combo, as written or already parsed.
 * @returns Whether the keystroke is this combo.
 * @example matchesKeyCombo(event, "mod+k") // ⌘K on a Mac, Ctrl+K elsewhere
 */
export function matchesKeyCombo(
	event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
	combo: KeyCombo | string,
): boolean {
	let parsed = typeof combo === "string" ? parseKeyCombo(combo) : combo;
	if (parsed.key === "") return false;

	if (parsed.character) {
		return event.key === parsed.key && !event.ctrlKey && !event.altKey && !event.metaKey;
	}

	if (event.key.toLowerCase() !== parsed.key) return false;
	if (event.altKey !== parsed.alt || event.shiftKey !== parsed.shift) return false;

	if (parsed.mod) {
		return (event.ctrlKey || event.metaKey) && (!parsed.ctrl || event.ctrlKey);
	}

	return event.ctrlKey === parsed.ctrl && event.metaKey === parsed.meta;
}

/**
 * The key caps a hint prints for `combo`, one per key in press order, in the glyphs of
 * the keyboard in front of the reader. A bare character prints as written, since its case
 * is the binding; a key inside a chord prints upper-cased, the way a key cap shows it.
 *
 * @param combo The combo as written, e.g. `"mod+shift+z"`.
 * @param apple Whether the reader's keyboard carries the Apple modifier glyphs.
 * @returns The caps to render, each already the glyph to print.
 * @example keyComboGlyphs("mod+k", true) // ["⌘", "K"]
 * @example keyComboGlyphs("mod+k", false) // ["Ctrl", "K"]
 */
export function keyComboGlyphs(combo: string, apple: boolean): string[] {
	let glyphs = apple ? APPLE_GLYPHS : OTHER_GLYPHS;
	let tokens = combo
		.split("+")
		.map((token) => token.trim())
		.filter((token) => token.length > 0);

	if (tokens.length === 1 && tokens[0]?.length === 1) return tokens;

	return tokens.map((token) => {
		let named = glyphs[token.toLowerCase()];
		return named ?? (token.length === 1 ? token.toUpperCase() : token);
	});
}

/**
 * Whether a keystroke was aimed at a field the reader is typing in, where a bare letter
 * shortcut would swallow the letter.
 *
 * @param target The keystroke's target.
 * @returns Whether the target is, or sits inside, an editable control.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
	if (target === null || typeof Element === "undefined" || !(target instanceof Element)) {
		return false;
	}

	return target.closest(TYPING_TARGET_SELECTOR) !== null;
}
