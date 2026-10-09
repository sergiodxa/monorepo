/**
 * The link-syntax rule: markup a field does not render. BBCode belongs to forum software few
 * sites run, and HTML or Markdown pasted into a plain-text field shows up as literal markup, so
 * posting it there is what a bot aiming at every kind of form does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Signal, SpamCheck } from "../check.js";

/** The opening of a BBCode link, `[url]` or `[url=`; the latter needs a `]` somewhere after it. */
const BBCODE_OPEN = /\[url[=\]]/i;

/** The opening of an HTML anchor, tried only where a `<` stands. */
const ANCHOR_OPEN = /<a\s/iy;

/** An `href` attribute, tried only inside an open anchor tag. */
const HREF_ATTRIBUTE = /href\s*=/iy;

/** The absolute-URL target that turns a bracketed label into a Markdown link. */
const MARKDOWN_TARGET = /\(\s*https?:\/\//iy;

/**
 * Whether `content` holds a BBCode link: `[url]`, or `[url=` with a `]` after it. Only the first
 * opening is checked, since a `]` after any later one also follows the first.
 */
function hasBbcodeLink(content: string): boolean {
	let open = BBCODE_OPEN.exec(content);
	if (open === null) return false;
	return open[0].endsWith("]") || content.includes("]", open.index + open[0].length);
}

/**
 * Whether an HTML anchor tag in `content` carries an `href`. One pass tracks whether the scan is
 * inside an anchor tag opened since the last `>`, so the cost stays linear in the submission.
 */
function hasHtmlLink(content: string): boolean {
	let inAnchor = false;
	for (let at = 0; at < content.length; at += 1) {
		let character = content.charAt(at);
		if (character === ">") {
			inAnchor = false;
		} else if (character === "<") {
			ANCHOR_OPEN.lastIndex = at;
			if (ANCHOR_OPEN.test(content)) inAnchor = true;
		} else if (inAnchor && (character === "h" || character === "H")) {
			HREF_ATTRIBUTE.lastIndex = at;
			if (HREF_ATTRIBUTE.test(content)) return true;
		}
	}
	return false;
}

/**
 * Whether `content` holds a Markdown inline link to an absolute URL: a non-empty `[label]` followed
 * by `(http…`. One pass remembers the first `[` since the last `]`, so the cost stays linear.
 */
function hasMarkdownLink(content: string): boolean {
	let open = -1;
	for (let at = 0; at < content.length; at += 1) {
		let character = content.charAt(at);
		if (character === "[") {
			if (open === -1) open = at;
		} else if (character === "]") {
			if (open !== -1 && at - open > 1) {
				MARKDOWN_TARGET.lastIndex = at + 1;
				if (MARKDOWN_TARGET.test(content)) return true;
			}
			open = -1;
		}
	}
	return false;
}

/**
 * Scores BBCode links in any format, HTML anchors outside `html`, and Markdown links in `text`.
 * Each kind scores once however many links use it.
 *
 * @example linkSyntax({ markdownScore: 0 }) // for a text field whose readers write Markdown
 */
export function linkSyntax(options: linkSyntax.Options = {}): SpamCheck {
	let bbcodeScore = options.bbcodeScore ?? 8;
	let htmlScore = options.htmlScore ?? 8;
	let markdownScore = options.markdownScore ?? 3;

	return {
		name: "link-syntax",
		stage: "local",
		check(submission): Signal[] {
			let format = submission.format ?? "text";
			let content = submission.content;
			let signals: Signal[] = [];
			if (hasBbcodeLink(content)) {
				signals.push({
					check: "link-syntax.bbcode",
					score: bbcodeScore,
					detail: "BBCode link markup",
				});
			}
			if (format !== "html" && hasHtmlLink(content)) {
				signals.push({
					check: "link-syntax.html",
					score: htmlScore,
					detail: `HTML anchors in a ${format} field`,
				});
			}
			if (format === "text" && hasMarkdownLink(content)) {
				signals.push({
					check: "link-syntax.markdown",
					score: markdownScore,
					detail: "Markdown links in a text field",
				});
			}
			return signals;
		},
	};
}

/** The options {@link linkSyntax} takes. */
export namespace linkSyntax {
	/** Weights for the link-syntax rule. */
	export interface Options {
		/** @default 8 */
		bbcodeScore?: number;
		/** @default 8 */
		htmlScore?: number;
		/** @default 3 */
		markdownScore?: number;
	}
}
