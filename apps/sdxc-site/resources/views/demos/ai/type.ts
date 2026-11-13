/**
 * Margin's type and ink: the system sans the notes are typed in, the hand the margins are
 * written in, the mono timestamps, and the highlighter and pen colours the page marks with.
 * Every part of the page reads these, so the paper looks the same in every band.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The typed face of the notes and the page, a humanist sans every platform ships. */
export const SANS =
	'"Avenir Next", Avenir, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

/** The hand the margins are written in, from the system's own handwriting faces. */
export const HAND = '"Bradley Hand", "Segoe Print", "Chalkboard SE", "Comic Neue", cursive';

/** Timestamps and the drafting log. */
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

/** The highlighter's yellow, set behind dark ink in both schemes. */
export const HIGHLIGHTER = "var(--margin-highlighter)";

/** Ink kept dark on the highlighter, so a marked word reads in both schemes. */
export const HIGHLIGHTER_INK = "var(--margin-highlighter-ink)";

/** The red pen corrections and the notebook's margin line are drawn in. */
export const RED_PEN = "var(--margin-red-pen)";

/** The faint blue the notebook's lines are ruled in. */
export const RULE = "var(--margin-rule)";

/** Height of one ruled line, which every line of text on a sheet snaps to. */
export const LINE = "1.75rem";

/**
 * A ruled sheet's background: one faint line at the foot of every {@link LINE}, so text set
 * at that line height sits on the rules.
 */
export const RULED_PAPER = `repeating-linear-gradient(to bottom, transparent 0 calc(${LINE} - 1px), ${RULE} calc(${LINE} - 1px) ${LINE})`;
