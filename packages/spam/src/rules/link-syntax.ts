/**
 * The link-syntax rule: markup a field does not render. BBCode belongs to forum software few
 * sites run, and HTML or Markdown pasted into a plain-text field shows up as literal markup, so
 * posting it there is what a bot aiming at every kind of form does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Signal, SpamCheck } from "../check.js";

/** A BBCode link, `[url=…]` or `[url]…[/url]`. */
const BBCODE_LINK = /\[url(?:=[^\]]*)?\]/i;

/** An HTML anchor with an `href`. */
const HTML_LINK = /<a\s[^>]*href\s*=/i;

/** A Markdown inline link to an absolute URL. */
const MARKDOWN_LINK = /\[[^\]]+\]\(\s*https?:\/\//i;

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
			if (BBCODE_LINK.test(content)) {
				signals.push({
					check: "link-syntax.bbcode",
					score: bbcodeScore,
					detail: "BBCode link markup",
				});
			}
			if (format !== "html" && HTML_LINK.test(content)) {
				signals.push({
					check: "link-syntax.html",
					score: htmlScore,
					detail: `HTML anchors in a ${format} field`,
				});
			}
			if (format === "text" && MARKDOWN_LINK.test(content)) {
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
