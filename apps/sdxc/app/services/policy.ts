/**
 * The root-level policy pages — what a release is supported for, and how to report
 * something privately. Both are prose a reader checks before depending on anything, so
 * both are markdown files rather than views: the sentence that has to be right is
 * edited on its own, without a component tree around it.
 *
 * They are not guides. A guide teaches the collection and sits in the tree under
 * `/docs`; a policy states what the project will and will not do, and is linked from
 * the footer of every page instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MarkdownParseError, MarkdownWalkError } from "@sdxc/markdown";
import type { Result } from "@sdxc/result";

import { Markdown } from "@sdxc/markdown";
import { isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import { prepareArticle } from "~/app/services/article";
import { MARKDOWN_OPTIONS as CONTENT_OPTIONS } from "~/app/services/content";

/**
 * What a policy page states about itself. The description is the page's own summary
 * rather than its first sentence, because the first sentence of a policy is a claim
 * and a link preview wants the subject.
 */
const frontmatterSchema = s.object({
	title: s.string(),
	description: s.string(),
	lastUpdated: s.optional(s.string()),
});

export type PolicyFrontmatter = s.InferOutput<typeof frontmatterSchema>;

/** Policy pages take the landing page's vocabulary, so an aside is a tag rather than markup. */
const MARKDOWN_OPTIONS = {
	...CONTENT_OPTIONS,
	frontmatter: frontmatterSchema,
} satisfies Markdown.Options;

/** One policy page, ready for its shell to draw the chrome and render the body. */
export interface PolicyPage {
	frontmatter: PolicyFrontmatter;
	document: Markdown.Document;
}

/**
 * Reads one policy page. The parse runs per request rather than at module scope,
 * because work in the worker's global scope fails upload validation.
 *
 * @param source - The raw markdown of one policy file.
 * @returns The page, or the failure with the line it sits on.
 */
export function readPolicy(
	source: string,
): Result<PolicyPage, MarkdownParseError | MarkdownWalkError> {
	let parsed = Markdown.parse(source, MARKDOWN_OPTIONS);
	if (isFailure(parsed)) return parsed;

	let prepared = prepareArticle(parsed.data.document);
	if (isFailure(prepared)) return prepared;

	return success({ frontmatter: parsed.data.frontmatter, document: prepared.data });
}
