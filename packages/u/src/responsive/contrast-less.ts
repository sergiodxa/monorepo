/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("(prefers-contrast: less)", input)`.
 *
 * The counterpart to `u.contrastMore()`, for softening a rule when the user
 * has asked for less contrast. Note it is far less widely honoured by
 * platforms than `more` — treat anything declared here as an enhancement,
 * never as the only place a style is set.
 *
 * @example u.contrastLess(u.border("neutral"))
 * @example css({ "@media (prefers-contrast: less)": { borderColor: "var(--ui-neutral-border)" } })
 */
export function contrastLess<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-contrast: less)", input);
}
