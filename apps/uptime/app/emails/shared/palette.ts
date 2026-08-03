/**
 * The colours this app's own email components paint with, as the literals mail clients keep.
 *
 * They exist as literals because the web pages' colours do not survive the trip: every one of
 * them is a `--ui-*` custom property in `resources/css/colors.css`, and Gmail drops custom
 * properties along with the stylesheet that defines them, leaving an element with no colour
 * rather than with a fallback.
 *
 * They are in one module, and not in the component that first needed them, because more than
 * one component paints the same states: the uptime bar fills segments and a digest colours the
 * rows of a monitor list. A second copy of these hexes is how the two would drift.
 *
 * Two sources, and the split is deliberate. The four status fills and the caption grey are the
 * app's own tokens, read out of `resources/css/colors.css`, so a bar in an email and the same
 * bar on the dashboard are the same green. The copy and hairline colours are `@pkg/mail`'s
 * instead: a monitor list sits between an `Email.Text` and an `Email.Button` inside that kit's
 * card, so it has to read as part of the layout it is in rather than as a component from
 * somewhere else.
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

/** Copy that carries the message, matching `@pkg/mail`'s body colour. */
export const TEXT_COLOR = "#18181b";

/** Hairlines between rows, matching the ones `Email.Table` draws. */
export const BORDER_COLOR = "#e4e4e7";
