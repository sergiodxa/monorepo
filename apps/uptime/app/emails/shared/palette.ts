/**
 * Colours this app's own email components paint with, as literals, since mail clients
 * strip the `--ui-*` custom properties the web pages read these from along with the
 * stylesheet that defines them. Centralized so the uptime bar and a digest's monitor
 * list share one green rather than risk a second, drifting copy of the same hexes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A period every check passed; `--ui-color-success-600`, the web bar's `success.solid`. */
export const UP_COLOR = "#107f04";

/** A period that answered but not well; `--ui-color-warning-600`. */
export const DEGRADED_COLOR = "#925d00";

/** A period that failed; `--ui-color-danger-600`. */
export const DOWN_COLOR = "#ba2b2e";

/** A period no check covers; `--ui-color-neutral-200`, the web bar's `neutral.border`. */
export const NO_DATA_COLOR = "#dde2e6";

/** Captions, legends, and column headers; `--ui-color-neutral-600`. */
export const MUTED_COLOR = "#636a71";

/** Colour for the email's main body copy. */
export const TEXT_COLOR = "#18181b";

/** Colour for the hairline rules that separate table rows. */
export const BORDER_COLOR = "#e4e4e7";

/**
 * Dark-mode overrides for the four status colours: the kit flips card, copy, and
 * hairlines on its own but never sees these fills, so each status keeps a separate
 * `color` and `background-color` class at the 400-weight step for legible contrast.
 */
export const DARK_STYLES = [
	".uptime-ink-up{color:#4ade80 !important;}",
	".uptime-ink-degraded{color:#fbbf24 !important;}",
	".uptime-ink-down{color:#f87171 !important;}",
	".uptime-fill-up{background-color:#4ade80 !important;}",
	".uptime-fill-degraded{background-color:#fbbf24 !important;}",
	".uptime-fill-down{background-color:#f87171 !important;}",
	".uptime-fill-none{background-color:#3f3f46 !important;}",
].join("");
