/**
 * Turns a submission into the tokens the classifier counts: content words, linked hosts and the
 * author's email domain. Classifying and training share this one function, so a token learned
 * from a report is spelled exactly as the check later looks it up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Submission } from "../check.js";

import { extractLinks, extractWords } from "../lib/text.js";

/** Apostrophes a word starts or ends with, which quote the word rather than belong to it. */
const EDGE_APOSTROPHES = /^['’]+|['’]+$/g;

/**
 * The distinct tokens of `submission`, hosts first, then the email domain, then words in order of
 * appearance, up to `maxTokens`. Hosts drop a leading `www.` and carry the `host:` prefix, the
 * domain carries `email-domain:`, and words are lowercased and kept within the length window.
 *
 * @example tokenize({ content: "Buy at https://www.shop.example" }); // ["host:shop.example", "buy"]
 */
export function tokenize(submission: Submission, options: tokenize.Options = {}): string[] {
	let minLength = options.minLength ?? 3;
	let maxLength = options.maxLength ?? 24;
	let maxTokens = options.maxTokens ?? 200;
	let emailDomain = options.emailDomain ?? true;

	let tokens = new Set<string>();
	let urls = extractLinks(submission.content);
	let authorUrl = submission.author?.url;
	if (authorUrl !== undefined && URL.canParse(authorUrl)) urls.push(new URL(authorUrl));
	for (let url of urls) {
		let host = url.hostname.toLowerCase().replace(/^www\./, "");
		if (host.length > 0) tokens.add(`host:${host}`);
	}

	let email = submission.author?.email;
	if (emailDomain && email !== undefined) {
		let domain = email
			.slice(email.lastIndexOf("@") + 1)
			.trim()
			.toLowerCase();
		if (email.includes("@") && domain.length > 0) tokens.add(`email-domain:${domain}`);
	}

	for (let raw of extractWords(submission.content)) {
		let word = raw.replace(EDGE_APOSTROPHES, "").toLowerCase();
		let length = Array.from(word).length;
		if (length >= minLength && length <= maxLength) tokens.add(word);
	}

	return [...tokens].slice(0, maxTokens);
}

/** The types {@link tokenize} reads. */
export namespace tokenize {
	/** How content becomes tokens; the classifier and its training must share these values. */
	export interface Options {
		/** Shorter words carry no meaning worth counting. @default 3 */
		minLength?: number;
		/** Longer words are hashes, encodings or keyboard mashing. @default 24 */
		maxLength?: number;
		/** Bounds the store reads and writes a single submission can cause. @default 200 */
		maxTokens?: number;
		/** Counts the author's email domain as an `email-domain:` token. @default true */
		emailDomain?: boolean;
	}
}
