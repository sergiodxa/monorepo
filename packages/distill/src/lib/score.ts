/**
 * Decides which subtree of a page is the article. Paragraphs earn their container a
 * score, the container's own parent takes a share of it, and a container that is
 * mostly links loses most of it again — which is what tells a body of prose from a
 * navigation rail with the same tag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DOMDocument, DOMElement } from "@sdxc/html/document";

/** Tags whose subtree is furniture wherever it appears, whatever it scores. */
const FURNITURE_TAGS = new Set([
	"aside",
	"button",
	"embed",
	"footer",
	"form",
	"header",
	"iframe",
	"input",
	"nav",
	"noscript",
	"object",
	"script",
	"select",
	"style",
	"svg",
	"template",
	"textarea",
]);

/**
 * What a page calls the blocks around the article. Matched against `id`, `class` and
 * `role`, which is where a template says what a block is for when its tag does not.
 */
const FURNITURE_NAMES =
	/(^|[\s_-])(ad|ads|advert|banner|breadcrumb|byline|comment|comments|complementary|cookie|disqus|footer|header|masthead|menu|meta|navigation|newsletter|paywall|popup|promo|related|share|sharing|sidebar|social|sponsor|subscribe|toolbar|widget)([\s_-]|$)/iu;

/** Tags a page names its article with, which start ahead of an anonymous container. */
const ARTICLE_TAGS = new Set(["article", "main"]);

/** What a semantic container is worth before a single paragraph is counted. */
const SEMANTIC_BONUS = 25;

/** What one paragraph is worth before its length and its punctuation are added. */
const PARAGRAPH_BASE = 1;

/** Characters of a paragraph that earn another point, up to {@link LENGTH_CAP}. */
const LENGTH_STEP = 100;

/** How many length points one paragraph may contribute, however long it runs. */
const LENGTH_CAP = 3;

/** What share of a paragraph's score the container's own parent takes. */
const PARENT_SHARE = 0.5;

/** Characters a paragraph must run to be counted as prose at all. */
const PROSE_FLOOR = 25;

/** Tags that hold prose directly, which is what a container is scored by holding. */
const PROSE_TAGS = new Set(["blockquote", "p", "pre"]);

/** Tags a candidate container may be, since prose is grouped by one of these. */
const CONTAINER_TAGS = new Set(["article", "div", "main", "section", "td"]);

/** Whether an element is furniture by its tag, or by the name its template gave it. */
export function isFurniture(element: DOMElement): boolean {
	if (FURNITURE_TAGS.has(element.localName.toLowerCase())) return true;

	let named = [
		element.getAttribute("id") ?? "",
		element.getAttribute("class") ?? "",
		element.getAttribute("role") ?? "",
	].join(" ");

	return FURNITURE_NAMES.test(named);
}

/** Whether an element sits inside something already ruled out as furniture. */
function isBuried(element: DOMElement): boolean {
	for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
		if (isFurniture(parent)) return true;
	}
	return false;
}

/** The text an element holds, whitespace-normalized, which is what length is counted in. */
function textOf(element: DOMElement): string {
	return (element.textContent ?? "").replaceAll(/\s+/gu, " ").trim();
}

/**
 * How much of an element's text sits inside links. A rail of headlines reads as prose
 * by length alone, and this is what separates it from a body that happens to cite.
 */
function linkDensity(element: DOMElement): number {
	let total = textOf(element).length;
	if (total === 0) return 0;

	let linked = 0;
	for (let anchor of Array.from(element.querySelectorAll("a"))) linked += textOf(anchor).length;

	return Math.min(1, linked / total);
}

/** What one paragraph contributes to whichever container holds it. */
function paragraphScore(text: string): number {
	let commas = text.split(/[,،、]/u).length - 1;
	let length = Math.min(LENGTH_CAP, Math.floor(text.length / LENGTH_STEP));
	return PARAGRAPH_BASE + commas + length;
}

/** One container and what the prose inside it earned. */
interface Candidate {
	element: DOMElement;
	score: number;
}

/**
 * The element most likely to be the article, or `null` for a page whose body holds no
 * prose to find one in — a shell page, or a body a script would have built.
 *
 * @param document - The page as it was served.
 */
export function articleOf(document: DOMDocument): DOMElement | null {
	let scores = new Map<DOMElement, number>();

	for (let node of Array.from(document.querySelectorAll("*"))) {
		if (!PROSE_TAGS.has(node.localName.toLowerCase())) continue;
		if (isBuried(node)) continue;

		let text = textOf(node);
		if (text.length < PROSE_FLOOR) continue;

		let earned = paragraphScore(text);
		let parent = node.parentElement;
		if (!parent) continue;

		scores.set(parent, (scores.get(parent) ?? 0) + earned);

		let grandparent = parent.parentElement;
		if (grandparent) {
			scores.set(grandparent, (scores.get(grandparent) ?? 0) + earned * PARENT_SHARE);
		}
	}

	let best: Candidate | null = null;

	for (let [element, earned] of scores) {
		let tag = element.localName.toLowerCase();
		if (!CONTAINER_TAGS.has(tag)) continue;
		if (isFurniture(element) || isBuried(element)) continue;

		let score = earned * (1 - linkDensity(element));
		if (ARTICLE_TAGS.has(tag)) score += SEMANTIC_BONUS;

		if (best === null || score > best.score) best = { element, score };
	}

	return best?.element ?? null;
}
