/**
 * The link-count rule: spam exists to place links, so each link past the first adds weight, and a
 * text that is mostly links adds more. A person citing one source draws nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Signal, SpamCheck } from "../check.js";

import { extractLinks, extractWords } from "../lib/text.js";

/**
 * Scores the distinct links in the content: `perExtraLink` for each one past `freeLinks`, capped
 * at `maxCountScore`, and `densityScore` once when there is at least one link for every
 * `wordsPerLink` words and more than one link.
 *
 * @example links({ freeLinks: 3 })
 */
export function links(options: links.Options = {}): SpamCheck {
	let freeLinks = options.freeLinks ?? 1;
	let perExtraLink = options.perExtraLink ?? 2;
	let maxCountScore = options.maxCountScore ?? 10;
	let wordsPerLink = options.wordsPerLink ?? 4;
	let densityScore = options.densityScore ?? 3;

	return {
		name: "links",
		stage: "local",
		check(submission): Signal[] {
			let count = extractLinks(submission.content).length;
			let signals: Signal[] = [];
			if (count > freeLinks) {
				signals.push({
					check: "links.count",
					score: Math.min((count - freeLinks) * perExtraLink, maxCountScore),
					detail: `${count} links`,
				});
			}
			let words = extractWords(submission.content).length;
			if (count > 1 && words <= count * wordsPerLink) {
				signals.push({
					check: "links.density",
					score: densityScore,
					detail: `${count} links in ${words} words`,
				});
			}
			return signals;
		},
	};
}

/** The options {@link links} takes. */
export namespace links {
	/** Limits and weights for the link-count rule. */
	export interface Options {
		/** Links a submission may carry before any scores. @default 1 */
		freeLinks?: number;
		/** @default 2 */
		perExtraLink?: number;
		/** @default 10 */
		maxCountScore?: number;
		/** The fewest words per link that count as prose rather than a link list. @default 4 */
		wordsPerLink?: number;
		/** @default 3 */
		densityScore?: number;
	}
}
