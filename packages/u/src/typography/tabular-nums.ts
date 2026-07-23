/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies `font-variant-numeric: tabular-nums`, so digits render at a fixed
 * width instead of their proportional metrics — a running total, a
 * countdown, or a one-time-code field reads without its layout shifting as
 * the displayed digits change.
 *
 * @example u.tabularNums()
 * @example css({ fontVariantNumeric: "tabular-nums" })
 */
export function tabularNums<Node extends Element = Element>() {
	return utility<Node>(() => ({ fontVariantNumeric: "tabular-nums" }));
}
