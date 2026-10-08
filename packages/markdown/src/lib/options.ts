/**
 * Turns the options a caller hands an entry point into the shape the parser
 * reads: tags keyed by name with their defaults applied, so the block and inline
 * phases both ask the same question and get the same answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, success } from "@sdxc/result";

import type { Markdown } from "../index.js";

import type { ElementShape } from "./elements.js";

import { holdsVariable } from "./attributes.js";
import { allowsAttribute, elementShape, isSafeAttributeValue } from "./elements.js";
import { MarkdownParseError } from "./errors.js";

/** One registered tag or allowlisted element, after `content` has taken its default. */
export interface ResolvedTag {
	name: string;
	content: "blocks" | "inline" | "none";
	attributes?: StandardSchemaV1;
	/** Present for an allowlisted HTML element, which becomes an `element` node rather than a `tag`. */
	element?: ResolvedElement;
}

/** What the allowlist says about one HTML element. */
export interface ResolvedElement {
	level: ElementShape["level"];
	allowed: ReadonlySet<string>;
}

/** What both parsing phases read, with every default already applied. */
export interface ResolvedOptions {
	tags: Map<string, ResolvedTag>;
}

/**
 * Applies the defaults once, ahead of parsing, and folds the HTML allowlist into the
 * same map, a registered tag replacing an element of its name, so a tag lookup during the walk
 * over lines is a map read rather than a fresh merge per occurrence.
 *
 * @param options - The options a caller passed to an entry point
 * @returns The same tags, keyed by name, with `content` defaulted to `"blocks"`
 */
export function resolveOptions(options: Markdown.Options): ResolvedOptions {
	let tags = new Map<string, ResolvedTag>();

	for (let [name, allowed] of Object.entries(options.html ?? {})) {
		let shape = elementShape(name);
		if (!shape || !allowed) continue;
		tags.set(name, {
			name,
			content: shape.content,
			element: { level: shape.level, allowed: new Set(allowed) },
		});
	}

	for (let [name, definition] of Object.entries(options.tags ?? {})) {
		tags.set(name, {
			name,
			content: definition.content ?? "blocks",
			attributes: definition.attributes,
		});
	}

	return { tags };
}

/**
 * Runs a tag's schema over its attributes, or an element's allowlist, and answers
 * with what passed: a coercing schema hands the tree the values it produced. While a
 * value is still a variable, only what is known now — attribute names — is checked.
 *
 * @param definition - The registered tag, schema included
 * @param attributes - The attributes the source wrote, variables filled in
 * @param position - The opening tag's span, which a failure is reported at
 * @returns The validated attributes, or a failure carrying the schema's issues
 */
export function validateTagAttributes(
	definition: Pick<ResolvedTag, "name" | "attributes" | "element">,
	attributes: Markdown.Attributes,
	position: Markdown.Position,
): Result<Markdown.Attributes, MarkdownParseError> {
	if (definition.element)
		return checkElement(definition.name, definition.element, attributes, position);
	if (holdsVariable(attributes)) return success(attributes);

	let schema = definition.attributes;
	if (!schema) return success(attributes);

	let result = schema["~standard"].validate(attributes);

	if (result instanceof Promise) {
		return failure(
			new MarkdownParseError(`The <${definition.name}> tag's attribute schema is asynchronous`, {
				position,
			}),
		);
	}

	if (result.issues) {
		return failure(
			new MarkdownParseError(`Invalid attributes for <${definition.name}>`, {
				position,
				issues: result.issues,
			}),
		);
	}

	return success(result.value as Markdown.Attributes);
}

/**
 * Holds an element to its allowlist: every attribute named, and every URL a value
 * already holds relative or of an allowed scheme. A variable's URL is checked once
 * the variables visitor fills it in.
 */
function checkElement(
	name: string,
	element: ResolvedElement,
	attributes: Markdown.Attributes,
	position: Markdown.Position,
): Result<Markdown.Attributes, MarkdownParseError> {
	for (let [key, value] of Object.entries(attributes)) {
		if (!allowsAttribute(element.allowed, key)) {
			return failure(
				new MarkdownParseError(`<${name}> does not allow the "${key}" attribute`, { position }),
			);
		}

		if (typeof value === "string" && !isSafeAttributeValue(key, value)) {
			return failure(
				new MarkdownParseError(`<${name}> refuses "${value}" as its ${key}`, { position }),
			);
		}
	}

	return success(attributes);
}

/**
 * The node a registered name is read as: an allowlisted HTML element becomes an
 * `element`, which renders as itself, and a registered tag a `tag`, which renders
 * through the component or renderer the caller supplies.
 *
 * @param definition - The resolved tag or element
 * @param attributes - Its validated attributes
 * @param children - Its children, blocks or inline content
 * @param position - Where it was written
 * @returns The node to place in the tree
 */
export function tagNode(
	definition: ResolvedTag,
	attributes: Markdown.Attributes,
	children: Markdown.Block[] | Markdown.Inline[],
	position: Markdown.Position,
): Markdown.Tag | Markdown.Element {
	if (definition.element) {
		let name = definition.name as Markdown.HtmlElement;
		return { type: "element", name, attributes, children, position };
	}

	return { type: "tag", name: definition.name, attributes, children, position };
}
