/**
 * Expands Unicode emoji shortcodes and ASCII emoticons for demo-app display.
 * Custom shortcodes stay as typed; demos pass the built-in catalog only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { replaceShortcodes } from "@sdxc/emoji";
import { shortcodes } from "@sdxc/emoji/catalog";

/**
 * @param text - Stored composer or field text that may contain `:name:` tokens
 * @returns The same string with known Unicode shortcodes and emoticons expanded
 */
export function expandEmoji(text: string): string {
	return replaceShortcodes(text, shortcodes);
}
