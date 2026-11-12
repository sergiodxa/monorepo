/**
 * The strings Chorus hands to `@sdxc/ui` parts: the keyboard help sheet and the character
 * count, kept apart from the screens so every part reads the same words.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import type { CharacterCountProps } from "@sdxc/ui/character-count";

/** The keyboard help sheet's strings. */
export const HELP_LABELS: KeyboardHelp.Labels = {
	title: "Keyboard shortcuts",
	close: "Close",
	or: "or",
	open: "Show keyboard shortcuts",
	general: "General",
	other: "More",
};

/** What a screen reader hears as a draft nears or passes the limit. */
export const COUNT_LABELS: CharacterCountProps["labels"] = {
	remaining: "{count} characters left",
	over: "{count} characters over the limit",
};
