/**
 * The default rule set: every local rule at its default weights, tuned together against the
 * labelled corpus so a submission needs several kinds of evidence to reach the spam threshold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpamCheck } from "../check.js";

import { authorName } from "./author-name.js";
import { contactBait } from "./contact-bait.js";
import { language } from "./language.js";
import { linkSyntax } from "./link-syntax.js";
import { linkTargets } from "./link-targets.js";
import { links } from "./links.js";
import { shouting } from "./shouting.js";
import { timing } from "./timing.js";
import { unicode } from "./unicode.js";

/**
 * Every built-in local rule with its default options. To reweight one, build the list from the
 * rule functions instead: `[links({ freeLinks: 3 }), unicode(), …]`.
 */
export const DEFAULT_RULES: readonly SpamCheck[] = [
	timing(),
	links(),
	linkSyntax(),
	linkTargets(),
	unicode(),
	contactBait(),
	shouting(),
	language(),
	authorName(),
];

export {
	authorName,
	contactBait,
	language,
	links,
	linkSyntax,
	linkTargets,
	shouting,
	timing,
	unicode,
};
export { ABUSED_TLDS, URL_SHORTENERS } from "./link-targets.js";
