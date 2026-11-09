/**
 * Renders a compiled stub with values. Rendering is strict: a placeholder without a value, a
 * filter nobody defined, or a value of the wrong shape for where it is used fails with the
 * stub, the line and what the stub accepts, so a stub never writes a half-filled file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Filter } from "./filters.js";
import type { Node, Template } from "./template.js";

import { BlueprintError } from "./errors.js";
import { FILTERS } from "./filters.js";
import { compile } from "./template.js";

/** A value a stub reads: text for `{{name}}`, a flag for `{{#if}}`, a list for `{{#each}}`. */
export type Value = string | boolean | readonly string[];

/** The values one render fills placeholders with, by name. */
export type Values = Readonly<Record<string, Value>>;

/** How `render` reads a stub given as text, and the filters it adds. */
export interface RenderOptions {
	/** Filters beside the built-in ones; one with a built-in name replaces it. */
	filters?: Readonly<Record<string, Filter>>;
	/** The name errors use for a stub given as text. @default "template" */
	source?: string;
}

/** What `render` accepts: anything holding a compiled template, or stub text. */
export type Renderable = Template | { template: Template } | string;

/** The compiled template of `input`, compiling text on the spot. */
export function templateOf(
	input: Renderable,
	source = "template",
): Result<Template, BlueprintError> {
	if (typeof input === "string") return compile(input, source);
	if ("template" in input) return success(input.template);
	return success(input);
}

/**
 * `input` rendered with `values`. Inside `{{#each list}}`, `{{item}}` is the current item.
 *
 * @example blueprint.render("export const {{name | camel}} = 1;", { name: "user-count" })
 * @example blueprint.render(stub, values, { filters: { year: () => "2026" } })
 */
export function render(
	input: Renderable,
	values: Values,
	options: RenderOptions = {},
): Result<string, BlueprintError> {
	let template = templateOf(input, options.source);
	if (isFailure(template)) return template;
	let filters = { ...FILTERS, ...options.filters };
	return renderNodes(template.data.nodes, values, filters, template.data.source, null);
}

/** The value `name` resolves to, with the current `each` item shadowing a value called `item`. */
function lookup(name: string, values: Values, item: string | null): Value | undefined {
	if (name === "item" && item !== null) return item;
	return Object.hasOwn(values, name) ? values[name] : undefined;
}

/** A failure for a placeholder without a value, listing every value the render has. */
function missing(name: string, values: Values, source: string, line: number): BlueprintError {
	let accepted = Object.keys(values)
		.map((key) => `{{${key}}}`)
		.join(", ");
	let hint = accepted === "" ? "no values were given" : `it accepts ${accepted}`;
	return new BlueprintError(`{{${name}}} has no value; ${hint}`, { source, line });
}

/** Renders `nodes`, the body of the stub or of a block. */
function renderNodes(
	nodes: readonly Node[],
	values: Values,
	filters: Readonly<Record<string, Filter>>,
	source: string,
	item: string | null,
): Result<string, BlueprintError> {
	let output = "";
	for (let node of nodes) {
		if (node.type === "text") {
			output += node.text;
			continue;
		}
		let value = lookup(node.name, values, item);
		if (value === undefined) return failure(missing(node.name, values, source, node.line));

		if (node.type === "value") {
			if (typeof value !== "string") {
				let kind = typeof value === "boolean" ? "a flag" : "a list";
				let use = typeof value === "boolean" ? "{{#if}}" : "{{#each}}";
				return failure(
					new BlueprintError(`{{${node.name}}} is ${kind}; use it in ${use}`, {
						source,
						line: node.line,
					}),
				);
			}
			let text = value;
			for (let name of node.filters) {
				let filter = filters[name];
				if (filter === undefined) {
					let known = Object.keys(filters).sort().join(", ");
					return failure(
						new BlueprintError(`No filter "${name}"; the filters are ${known}`, {
							source,
							line: node.line,
						}),
					);
				}
				text = filter(text);
			}
			output += node.indent === null ? text : text.replaceAll(/\n(?=.)/g, `\n${node.indent}`);
			continue;
		}

		if (node.type === "if") {
			let truthy = typeof value === "boolean" ? value : value.length > 0;
			if (!truthy) continue;
			let body = renderNodes(node.children, values, filters, source, item);
			if (isFailure(body)) return body;
			output += body.data;
			continue;
		}

		if (typeof value === "string" || typeof value === "boolean") {
			return failure(
				new BlueprintError(`{{#each ${node.name}}} needs a list`, { source, line: node.line }),
			);
		}
		for (let entry of value) {
			let body = renderNodes(node.children, values, filters, source, entry);
			if (isFailure(body)) return body;
			output += body.data;
		}
	}
	return success(output);
}
