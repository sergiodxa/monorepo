/**
 * The author-name rule: a person's name is a few words, while spam uses the name field as one
 * more place to put a domain or a string of search keywords.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Signal, SpamCheck } from "../check.js";

/** A URL or a bare domain such as `casino.example`. */
const DOMAIN = /https?:\/\/|\b[a-z0-9-]+\.(?:[a-z]{2,24})\b/i;

/**
 * Scores an author name containing a URL or domain, and a name longer than `maxWords` words or
 * `maxLength` characters.
 *
 * @example authorName({ maxWords: 8 })
 */
export function authorName(options: authorName.Options = {}): SpamCheck {
	let domainScore = options.domainScore ?? 5;
	let lengthScore = options.lengthScore ?? 2;
	let maxWords = options.maxWords ?? 5;
	let maxLength = options.maxLength ?? 50;

	return {
		name: "author-name",
		stage: "local",
		check(submission): Signal[] {
			let name = submission.author?.name?.trim();
			if (!name) return [];
			let signals: Signal[] = [];
			if (DOMAIN.test(name)) {
				signals.push({
					check: "author-name.domain",
					score: domainScore,
					detail: "a domain in the name",
				});
			}
			if (name.split(/\s+/).length > maxWords || name.length > maxLength) {
				signals.push({
					check: "author-name.length",
					score: lengthScore,
					detail: "a name longer than a person's",
				});
			}
			return signals;
		},
	};
}

/** The options {@link authorName} takes. */
export namespace authorName {
	/** Limits and weights for the author-name rule. */
	export interface Options {
		/** @default 5 */
		domainScore?: number;
		/** @default 2 */
		lengthScore?: number;
		/** @default 5 */
		maxWords?: number;
		/** @default 50 */
		maxLength?: number;
	}
}
