/**
 * The text a post is shared on X with, measured the way X counts it: every URL weighs 23,
 * Latin text 1 per character, everything else 2, an emoji sequence 2 once, against 280. The
 * CMS checks the author's text on save, and both share links open X's prefilled composer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";
import { failure, isFailure, success } from "@sdxc/result";

import type { Kind as RegistryKind } from "~/app/models/kinds";

import { POST_KINDS } from "~/app/models/kinds";
import { PROFILE } from "~/config/profile";

/** The most a post on X may weigh. */
export const X_LIMIT = 280;

/** What any URL weighs, whatever its length, since X shortens every link to the same size. */
const URL_WEIGHT = 23;

/** The code point ranges X counts 1 per character; every other code point counts 2. */
const LIGHT_RANGES: ReadonlyArray<readonly [number, number]> = [
	[0x0000, 0x10ff],
	[0x2000, 0x200d],
	[0x2010, 0x201f],
	[0x2032, 0x2037],
];

/** A URL as X links it in a post: a scheme up to the next whitespace. */
const URL_PATTERN = /https?:\/\/\S+/gu;

/** Punctuation closing a sentence after a URL, which X leaves out of the link. */
const URL_TRAILING_PUNCTUATION = /[.,;:!?'")\]]+$/u;

/** A grapheme X weighs as one emoji, whatever code points it joins. */
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** A stand-in permalink for a budget: every URL weighs the same, so any URL measures it. */
const ANY_URL = "https://x.com";

/**
 * Prop types for the share-text builders.
 */
export namespace PostShare {
	/** The kinds shared as a titled post with a teaser line. */
	export type Kind = Extract<RegistryKind, "article" | "tutorial">;

	/** The kinds shared whole: their content, then the permalink. */
	export type ShortKind = Extract<RegistryKind, "note" | "til">;

	/** What a note's or TIL's share text is built from. */
	export interface Short {
		kind: ShortKind;
		/** The Markdown as stored; its links are posted as their bare URLs. */
		content: string;
		/** The absolute URL the post is read at. */
		permalink: string;
	}

	/** What a titled post's share text is built from. */
	export interface Post {
		kind: Kind;
		title: string;
		/** The author's line written for X; blank lets the excerpt stand in. */
		teaser?: string | null;
		/** Stands in for a blank teaser, shortened with "…" to whatever room the title leaves. */
		excerpt?: string | null;
		/** The absolute URL the post is read at. */
		permalink: string;
	}
}

/** A share text heavier than X allows, naming the field to shorten and by how much. */
export class ShareTextOverflow extends Error {
	override name = "ShareTextOverflow";

	/**
	 * The part to shorten: the typed teaser, the title once no teaser is left to cut, or a
	 * note's or TIL's content.
	 */
	readonly field: "teaser" | "title" | "content";

	/** How much weight the text carries past the limit, which is how much to cut. */
	readonly over: number;

	/**
	 * @param field The part to shorten.
	 * @param over How much weight the text carries past the limit.
	 */
	constructor(field: "teaser" | "title" | "content", over: number) {
		super(`The ${field} is ${String(over)} characters too long to share on X`);
		this.field = field;
		this.over = over;
	}
}

/** The weight X gives `code`, by the range it falls in. */
function codePointWeight(code: number): number {
	return LIGHT_RANGES.some(([start, end]) => code >= start && code <= end) ? 1 : 2;
}

/** The weight of text holding no URL, an emoji sequence counted as one emoji. */
function plainLength(text: string): number {
	let total = 0;
	let segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
	for (let { segment } of segmenter.segment(text)) {
		if (EMOJI_PATTERN.test(segment)) {
			total += 2;
			continue;
		}
		for (let char of segment) total += codePointWeight(char.codePointAt(0) ?? 0);
	}
	return total;
}

/**
 * How much `text` weighs on X, NFC-normalized as X reads it. Only links with a scheme count as
 * URLs; a bare domain is weighed as text.
 */
export function xLength(text: string): number {
	let normalized = text.normalize("NFC");
	let total = 0;
	let cursor = 0;
	for (let match of normalized.matchAll(URL_PATTERN)) {
		let url = match[0].replace(URL_TRAILING_PUNCTUATION, "");
		total += plainLength(normalized.slice(cursor, match.index)) + URL_WEIGHT;
		cursor = match.index + url.length;
	}
	return total + plainLength(normalized.slice(cursor));
}

/** One line of text: every run of whitespace, line breaks included, becomes one space. */
function oneLine(text: string | null | undefined): string {
	return (text ?? "").replace(/\s+/gu, " ").trim();
}

/** The share text of a titled post with `line` between the title and the permalink. */
function titled(post: PostShare.Post, line: string): string {
	return `${POST_KINDS[post.kind].icon} ${oneLine(post.title)}\n\n${line}\n\n${post.permalink}`;
}

/** The share text of a titled post the title leaves no room in for a line under it. */
function titleOnly(post: PostShare.Post): string {
	return `${POST_KINDS[post.kind].icon} ${oneLine(post.title)}\n\n${post.permalink}`;
}

/**
 * How much the teaser line may weigh beside the title: 250 minus the title's weight, after
 * the emoji, the blank lines and the permalink. Zero or less means the title leaves no room.
 */
export function teaserBudget(post: Pick<PostShare.Post, "kind" | "title">): number {
	return X_LIMIT - xLength(titled({ ...post, permalink: ANY_URL }, ""));
}

/**
 * `text` cut to weigh at most `budget` with the "…" closing it, at the last whole word that
 * fits, or mid-word when not even the first word does; empty when not even the ellipsis fits.
 */
function shorten(text: string, budget: number): string {
	if (xLength(text) <= budget) return text;
	return cutAt(text, budget, "word") || cutAt(text, budget, "grapheme");
}

/** The longest run of `granularity` segments from the start that fits `budget` with "…". */
function cutAt(text: string, budget: number, granularity: "word" | "grapheme"): string {
	let kept = "";
	let segmenter = new Intl.Segmenter("en", { granularity });
	for (let { segment } of segmenter.segment(text)) {
		let next = kept + segment;
		if (xLength(`${next.trimEnd()}…`) > budget) break;
		kept = next;
	}
	let cut = kept.trimEnd();
	return cut === "" ? "" : `${cut}…`;
}

/**
 * The save-time check on a typed teaser: it fits beside the title, or fails naming how much to
 * cut. Succeeds with the teaser on one line, as it is stored; a blank teaser always fits.
 */
export function checkTeaser(
	post: Pick<PostShare.Post, "kind" | "title" | "teaser">,
): Result<string, ShareTextOverflow> {
	let teaser = oneLine(post.teaser);
	if (teaser === "") return success(teaser);
	let over = xLength(teaser) - teaserBudget(post);
	return over > 0 ? failure(new ShareTextOverflow("teaser", over)) : success(teaser);
}

/**
 * The share text as built, whether or not it fits: the typed teaser as written, else the
 * excerpt shortened to the room the title leaves, else no line at all.
 */
function draft(post: PostShare.Post): string {
	let teaser = oneLine(post.teaser);
	if (teaser !== "") return titled(post, teaser);
	let budget = teaserBudget(post);
	let excerpt = budget > 0 ? shorten(oneLine(post.excerpt), budget) : "";
	return excerpt === "" ? titleOnly(post) : titled(post, excerpt);
}

/**
 * The text the author shares an article or tutorial with: the kind's emoji and the title, a
 * blank line, the teaser, a blank line, and the permalink. A teaser that does not fit fails,
 * naming how much to cut; a standing-in excerpt is shortened instead and never fails.
 */
export function postShareText(post: PostShare.Post): Result<string, ShareTextOverflow> {
	let checked = checkTeaser(post);
	if (checked.status === "failure") return checked;
	let text = draft(post);
	let over = xLength(text) - X_LIMIT;
	return over > 0 ? failure(new ShareTextOverflow("title", over)) : success(text);
}

/** A link opening X's composer with `text` already typed, which the author can still edit. */
export function shareIntent(text: string): string {
	return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

/**
 * The author's "Post on X" link for a post. An overflowing text still opens the composer, where
 * X marks the excess for the author to trim.
 */
export function postIntent(post: PostShare.Post): string {
	return shareIntent(draft(post));
}

/** A reader's "Discuss on X" link: the post's title and permalink, for them to write around. */
export function discussIntent(post: { title: string; permalink: string }): string {
	return shareIntent(`${oneLine(post.title)} ${post.permalink}`);
}

/**
 * The names a releases post lists: all of them when they fit, else the first `shown` with
 * "and N more" for the rest.
 */
function packageList(names: ReadonlyArray<string>, shown: number): string {
	let listed = names.slice(0, shown);
	let rest = names.length - shown;
	if (rest > 0) return `${listed.join(", ")} and ${String(rest)} more`;
	if (listed.length < 2) return listed.join("");
	return `${listed.slice(0, -1).join(", ")} and ${listed.at(-1) ?? ""}`;
}

/**
 * The text the author shares a weekly releases post with: `This week I released {packages}
 * {permalink}`, naming as many packages as fit in 280 and counting the rest as "and N more",
 * so a week of dependency upgrades listing every package still fits.
 *
 * @param post The package names in the post's order, and the absolute permalink.
 */
export function releaseShareText(post: {
	packages: ReadonlyArray<string>;
	permalink: string;
}): string {
	for (let shown = post.packages.length; shown > 0; shown--) {
		let text = `This week I released ${packageList(post.packages, shown)} ${post.permalink}`;
		if (xLength(text) <= X_LIMIT) return text;
	}
	return `This week I released ${String(post.packages.length)} packages ${post.permalink}`;
}

/** What opens a short post's share text before its content: "TIL" for a TIL, nothing for a note. */
const SHORT_PREFIX: Record<PostShare.ShortKind, string> = { note: "", til: "TIL " };

/**
 * A note's or TIL's Markdown as the plain text X receives: every link becomes its bare URL,
 * which X weighs 23 whatever its text, a root-relative one on the site's origin, and the rest
 * reads as prose. A source that does not parse is posted as written.
 *
 * @param markdown The stored content.
 */
export function shortContent(markdown: string): string {
	let parsed = Markdown.parse(markdown);
	if (isFailure(parsed)) return markdown.trim();
	let walked = Markdown.walk(parsed.data.document, {
		link: (node) => ({ type: "text", value: absolute(node.href), position: node.position }),
	});
	if (isFailure(walked)) return markdown.trim();
	return toPlainText(walked.data, { code: true });
}

/** A link's address as posted: root-relative ones resolved against the site's origin. */
function absolute(href: string): string {
	return href.startsWith("/") && !href.startsWith("//")
		? new URL(href, PROFILE.canonical.origin).href
		: href;
}

/** A short post's share text with `content` already made plain. */
function shortFrame(kind: PostShare.ShortKind, content: string, permalink: string): string {
	return `${SHORT_PREFIX[kind]}${content} ${permalink}`;
}

/**
 * How much a note's or TIL's content may weigh: 280 minus the permalink's 23, the space before
 * it, and a TIL's "TIL ", which leaves 256 for a note and 252 for a TIL.
 */
export function shortBudget(kind: PostShare.ShortKind): number {
	return X_LIMIT - xLength(shortFrame(kind, "", ANY_URL));
}

/**
 * The save-time check on a note's or TIL's content: the plain text X would receive fits beside
 * the permalink, or fails naming how much to cut.
 *
 * @returns The weight the content leaves unused, which the form shows.
 */
export function checkShort(
	post: Pick<PostShare.Short, "kind" | "content">,
): Result<number, ShareTextOverflow> {
	let left = shortBudget(post.kind) - xLength(shortContent(post.content));
	return left < 0 ? failure(new ShareTextOverflow("content", -left)) : success(left);
}

/**
 * The text the author shares a note or TIL with: `{content} {permalink}`, "TIL " opening a
 * TIL's, its links as bare URLs. The CMS refuses content that would not fit, so a saved post's
 * text fits X.
 */
export function shortShareText(post: PostShare.Short): string {
	return shortFrame(post.kind, shortContent(post.content), post.permalink);
}

/** The author's "Post on X" link for a note or TIL, opening X's composer with its share text. */
export function shortIntent(post: PostShare.Short): string {
	return shareIntent(shortShareText(post));
}
