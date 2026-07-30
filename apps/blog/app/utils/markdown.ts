/**
 * Markdown utilities for the blog app. Wraps Markdoc in a Markdown class that
 * parses and transforms content into a renderable tree using the custom fence
 * node, and offers a plain() helper that strips markup to yield plain text (used
 * for excerpts and word counts). This is the shared entry point for rendering
 * post content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Config } from "@markdoc/markdoc";
import type { PlainTextOptions } from "@pkg/markdown";

import { parse as markdocParse, transform } from "@markdoc/markdoc";
import { toPlainText } from "@pkg/markdown";

import { fence } from "~/components/md/fence";

/**
 * Defaults for {@link Markdown.plain}: code blocks and image alternative text
 * are part of a post's text for word-count and search purposes, so both are kept
 * unless a caller building an excerpt asks for them to be dropped.
 */
const PLAIN_TEXT_DEFAULTS: PlainTextOptions = { fences: true, images: true };

export class Markdown {
	/**
	 * Parses post content into a renderable tree with the app's custom fence node,
	 * which is what gives code blocks their syntax highlighting.
	 *
	 * @param content Markdown source of a post
	 * @param options Markdoc config, minus `nodes` which this method owns
	 */
	static parse(content: string, options: Omit<Config, "nodes"> = {}) {
		return transform(markdocParse(content), { ...options, nodes: { fence } });
	}

	/**
	 * Extracts a post's prose by walking the parsed markdown, so link targets,
	 * reference definitions, and raw HTML disappear while the words around them
	 * survive. Blocks are separated by a blank line rather than collapsed.
	 *
	 * @param text Markdown source of a post
	 * @param options Overrides for the code-block and image-alt defaults
	 * @returns The post's text, with markdown syntax removed
	 * @example Markdown.plain("# Hi\n\nA [link](https://example.com).") // "Hi\n\nA link."
	 */
	static plain(text: string, options: PlainTextOptions = {}) {
		return toPlainText(text, { ...PLAIN_TEXT_DEFAULTS, ...options });
	}
}
