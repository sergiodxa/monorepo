/**
 * The two reading entry points, sharing one options object: the whole document,
 * or the frontmatter block alone. Stopping after the block is what lets an index
 * over a hundred posts read a hundred titles without parsing a hundred bodies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { Markdown } from "../index.js";

import { parseBlocks } from "./block.js";
import { readFrontmatterBlock, validateFrontmatter } from "./frontmatter.js";
import { resolveOptions } from "./options.js";

/**
 * Reads the frontmatter block and the body in one pass over the source.
 *
 * @param source - Markdown source, with or without a frontmatter block
 * @param options - Frontmatter schema and the tags the document may use
 * @returns The validated frontmatter and the parsed document
 */
export function parseDocument(
	source: string,
	options: Markdown.Options,
): Result<Markdown.Parsed<unknown>, Markdown.ParseError> {
	let block = readFrontmatterBlock(source);
	if (isFailure(block)) return block;

	let frontmatter = validateFrontmatter(block.data.value, block.data.position, options.frontmatter);
	if (isFailure(frontmatter)) return frontmatter;

	let document = parseBlocks(source, block.data.bodyStart, resolveOptions(options));
	if (isFailure(document)) return document;

	return success({ frontmatter: frontmatter.data, document: document.data });
}

/**
 * Reads the frontmatter block and stops, leaving the body unparsed.
 *
 * @param source - Markdown source, with or without a frontmatter block
 * @param options - The same options {@link parseDocument} takes; only the schema is read
 * @returns The validated frontmatter
 */
export function parseFrontmatter(
	source: string,
	options: Markdown.Options,
): Result<Markdown.Frontmatter<unknown>, Markdown.ParseError> {
	let block = readFrontmatterBlock(source);
	if (isFailure(block)) return block;

	let frontmatter = validateFrontmatter(block.data.value, block.data.position, options.frontmatter);
	if (isFailure(frontmatter)) return frontmatter;

	return success({ frontmatter: frontmatter.data });
}
