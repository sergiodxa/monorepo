/**
 * Turns a set of matches into one answer: nothing matched, several did, or a
 * position chose among them. Every lookup routes through here, so ambiguity reads
 * the same wherever a caller meets it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { HTML, HTMLQueryError } from "../index.js";

import { HTMLAmbiguousMatchError, HTMLNotFoundError } from "../index.js";

/** What a resolution needs: the matches, what else was there, and how to name it. */
export interface Resolution {
	matched: Element[];
	available: string[];
	subject: string;
	at?: HTML.Position | undefined;
}

/** One resolved match, kept as the element so a caller can keep looking inside it. */
export interface Match {
	element: Element;
	position: number;
}

/** Reads an element as the data a report names it by. */
export type Build = (element: Element, position: number) => HTML.Element;

/**
 * Resolves a match set to the single element a caller asked for.
 *
 * @param resolution - The matches, the surrounding family, and the subject's name
 * @param build - Reads a candidate, which is what an ambiguity failure carries
 * @returns The element with its 1-based position, or why one could not be chosen
 */
export function pick(resolution: Resolution, build: Build): Result<Match, HTMLQueryError> {
	let { matched, available, subject, at } = resolution;

	if (matched.length === 0) {
		return failure(new HTMLNotFoundError(describeMissing(subject, available), available));
	}

	if (at === undefined) {
		if (matched.length === 1) return success({ element: matched[0] as Element, position: 1 });

		let candidates = matched.map((element, index) => build(element, index + 1));
		let message = describeAmbiguity(subject, candidates);
		return failure(new HTMLAmbiguousMatchError(message, available, candidates));
	}

	let index = at === "first" ? 0 : at === "last" ? matched.length - 1 : at - 1;
	if (!Number.isInteger(index) || index < 0 || index >= matched.length) {
		let message = `No ${subject} at position ${String(at)}; ${matched.length} matched.`;
		return failure(new HTMLNotFoundError(message, available));
	}

	return success({ element: matched[index] as Element, position: index + 1 });
}

/** Keeps the first spelling of each entry, so a report lists what a page carries once. */
export function unique(values: string[]): string[] {
	return Array.from(new Set(values.filter((value) => value.length > 0)));
}

/** Names what the document carried instead, which is what turns a miss into a lead. */
function describeMissing(subject: string, available: string[]): string {
	if (available.length === 0) return `No ${subject} in the document.`;
	return `No ${subject} in the document. Present: ${available.join(", ")}.`;
}

/** Lists every candidate with its position, so a report names the choice to make. */
function describeAmbiguity(subject: string, candidates: HTML.Element[]): string {
	let list = candidates
		.map((candidate) => {
			let name = candidate.name.length > 0 ? ` "${candidate.name}"` : "";
			return `#${String(candidate.position)} <${candidate.tag}>${name}`;
		})
		.join(", ");

	return `${String(candidates.length)} matches for ${subject}: ${list}. Choose one with a position.`;
}
