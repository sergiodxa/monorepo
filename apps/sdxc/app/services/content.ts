/**
 * The markdown vocabulary the landing page is written in, and the per-request read of
 * it. Registering a tag with an attribute schema is what turns a mistyped attribute
 * into a parse error carrying the line it sits on, instead of a section that renders
 * blank. The read happens per request because work in the worker's global scope fails
 * upload validation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MarkdownParseError, MarkdownWalkError } from "@sdxc/markdown";
import type { Result } from "@sdxc/result";

import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

import { prepareArticle } from "~/app/services/article";
import { OPTION_GROUP_NAMES } from "~/app/services/option-groups";

/**
 * The whole vocabulary a content file may use. A name absent from here stays raw
 * HTML, which is what keeps an invented tag visible as text rather than silently
 * becoming markup.
 */
export const TAGS = {
	hero: { content: "blocks" },

	/** Copy on one side and what it is about on the other, stacked on a narrow screen. */
	split: { content: "blocks" },

	"split-copy": { content: "blocks" },

	"split-media": { content: "blocks" },

	actions: {
		content: "none",
		attributes: s.object({
			"cta-href": s.string(),
			"cta-label": s.string(),
			"alt-href": s.optional(s.string()),
			"alt-label": s.optional(s.string()),
			size: s.optional(s.enum_(["sm", "lg"])),
		}),
	},

	/** A value is written as the tag's content, so it can be a counted `{% $name %}` hole. */
	stats: { content: "blocks" },

	stat: { content: "inline", attributes: s.object({ label: s.string() }) },

	copyable: { content: "inline" },

	/** A small line under a row of actions, for the secondary ways to do the same thing. */
	"fine-print": { content: "inline" },

	/** The npm form is what an author writes; the other managers are derived from it. */
	"install-command": { content: "none", attributes: s.object({ command: s.string() }) },

	"section-block": {
		content: "blocks",
		attributes: s.object({
			id: s.string(),
			title: s.optional(s.string()),
			eyebrow: s.optional(s.string()),
			tone: s.optional(s.enum_(["plain", "tinted", "grid"])),
			align: s.optional(s.enum_(["start", "center"])),
		}),
	},

	"feature-grid": {
		content: "blocks",
		attributes: s.object({ columns: s.optional(s.enum_(["2", "3"])) }),
	},

	feature: {
		content: "blocks",
		attributes: s.object({
			title: s.string(),
			icon: s.optional(s.enum_(["globe", "shield", "package", "zap", "book", "compass"])),
			metric: s.optional(s.string()),
			href: s.optional(s.string()),
			"link-label": s.optional(s.string()),
		}),
	},

	/**
	 * Every label belongs to the panel it names, so a tab and its code never drift
	 * apart. `name` states which axis of choice the tabs offer, where they offer one
	 * the reader meets elsewhere on the site: a named strip labels its tabs with that
	 * group's options and opens on the one the reader last picked, anywhere.
	 */
	"code-tabs": {
		content: "blocks",
		attributes: s.object({ name: s.optional(s.enum_(OPTION_GROUP_NAMES)) }),
	},

	"code-tab": {
		content: "blocks",
		attributes: s.object({ label: s.string(), selected: s.optional(s.boolean()) }),
	},

	"package-groups": { content: "none", attributes: s.object({ source: s.enum_(["registry"]) }) },

	/** The people funding the work now, read per request, so the page supplies its component. */
	"current-sponsors": { content: "none" },

	note: {
		content: "blocks",
		attributes: s.object({ kind: s.optional(s.enum_(["info", "caution"])) }),
	},

	/**
	 * A directory layout, written as structure rather than drawn inside a fence: the
	 * renderer supplies the icons and the alignment, and a phone keeps the tree
	 * readable instead of wrapping pre-formatted lines mid-path.
	 */
	files: { content: "blocks", attributes: s.object({ title: s.optional(s.string()) }) },

	folder: { content: "blocks", attributes: s.object({ name: s.string() }) },

	file: { content: "none", attributes: s.object({ name: s.string() }) },
} satisfies Record<string, Markdown.TagDefinition>;

/** Hoisted so every read of a content file is held to the same vocabulary. */
export const MARKDOWN_OPTIONS = { tags: TAGS } satisfies Markdown.Options;

/**
 * Parses a content file and runs it through the pass every long-form page shares.
 *
 * @param source - The raw markdown of one content file.
 * @returns The document ready to render, or the parse failure with its position.
 */
export function readContent(
	source: string,
): Result<Markdown.Document, MarkdownParseError | MarkdownWalkError> {
	let parsed = Markdown.parse(source, MARKDOWN_OPTIONS);
	if (isFailure(parsed)) return parsed;

	return prepareArticle(parsed.data.document);
}
