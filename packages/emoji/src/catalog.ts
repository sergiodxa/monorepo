/**
 * Built-in Unicode catalog and its shortcode index. Import this entry only when
 * the app wants the generated table; root `@sdxc/emoji` never loads it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UnicodeEmoji } from "./lib/types.js";

import { emojis as generated } from "./data/emojis.data.js";
import { indexEntries } from "./lib/index-entries.js";

/** Generated Unicode emoji entries, one row per glyph. */
export const emojis: readonly UnicodeEmoji[] = generated;

/** Shortcode and emoticon index over {@link emojis}. */
export const shortcodes = indexEntries(emojis);

export { EMOJI_CATEGORIES } from "./lib/types.js";
