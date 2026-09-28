/**
 * Spam scoring for user-generated submissions: the check contract, the filter that adds up the
 * signals of every check into a verdict, and the built-in local rules. Remote providers, the
 * classifier and the test check live under their own export paths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Label, Signal, SpamCheck, Submission } from "./check.js";
export type { SpamFilter } from "./filter.js";

export { SpamCheckError } from "./check.js";
export { createSpamFilter, DEFAULT_THRESHOLDS, verdictFor } from "./filter.js";
export {
	ABUSED_TLDS,
	authorName,
	contactBait,
	DEFAULT_RULES,
	language,
	links,
	linkSyntax,
	linkTargets,
	shouting,
	timing,
	unicode,
	URL_SHORTENERS,
} from "./rules/index.js";
