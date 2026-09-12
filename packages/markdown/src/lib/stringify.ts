/**
 * Writes a document back as markdown, normalized rather than reproduced. Text is
 * escaped for every construct it could otherwise begin, so a tree a visitor built
 * by hand parses back to itself and the round trip stays idempotent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { stringify as stringifyYAML } from "@sdxc/yaml";

import type { Markdown } from "../index.js";

import { MarkdownStringifyError } from "./errors.js";
import { stringifyBlocks } from "./stringify/block.js";

/**
 * @param document - The document to serialize
 * @param options - Frontmatter to prepend as a YAML block
 * @returns The markdown source, or the frontmatter value YAML could not write
 */
export function stringifyDocument(
	document: Markdown.Document,
	options: Markdown.StringifyOptions,
): Result<string, Markdown.StringifyError> {
	let blocks = stringifyBlocks(document.children);
	let body = blocks === "" ? "" : `${blocks}\n`;

	if (options.frontmatter === undefined) return success(body);

	let yaml = stringifyYAML(options.frontmatter);
	if (isFailure(yaml)) {
		return failure(
			new MarkdownStringifyError("The frontmatter holds a value YAML cannot write", {
				cause: yaml.error,
			}),
		);
	}

	return success(`---\n${yaml.data}---\n${body === "" ? "" : `\n${body}`}`);
}
