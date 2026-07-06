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

import { parse as markdocParse, transform } from "@markdoc/markdoc";
import removeMarkdown from "remove-markdown";

import { fence } from "~/components/md/fence";

export class Markdown {
	static parse(content: string, options: Omit<Config, "nodes"> = {}) {
		return transform(markdocParse(content), { ...options, nodes: { fence } });
	}

	static plain(text: string) {
		return removeMarkdown(text);
	}
}
