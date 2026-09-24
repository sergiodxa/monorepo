/**
 * Route patterns as OpenAPI path templates: `:name` and `*name` become `{name}`. A
 * pattern OpenAPI cannot express, with an optional group, an unnamed wildcard or a
 * hostname variable, is refused, since every template variable is a required parameter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { RoutePattern } from "remix/route-pattern";

import { failure, success } from "@sdxc/result";

/** A route pattern's OpenAPI form. */
export interface PathTemplate {
	/** The template, such as `/monitors/{monitorId}`. */
	path: string;
	/** The template's variables, in order. */
	variables: string[];
}

/** A capture name as route-pattern reads it. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*/;

/**
 * Converts a route pattern into an OpenAPI path template. The pattern is read through its
 * serialized form, where `\` escapes a literal `:`, `*`, `(`, `)` or `\`.
 *
 * @param pattern - The route's parsed pattern.
 * @returns The template, or why the pattern cannot be one.
 * @example toPathTemplate(RoutePattern.parse("/monitors/:monitorId")); // { path: "/monitors/{monitorId}", variables: ["monitorId"] }
 */
export function toPathTemplate(pattern: RoutePattern): Result<PathTemplate, Error> {
	let { hostname, pathname } = pattern.toJSON();
	if (/(?<!\\)[:*]/.test(hostname)) {
		return failure(new Error(`The hostname variable in "${pattern.source}" has no OpenAPI form`));
	}

	let path = "/";
	let variables: string[] = [];
	let index = 0;
	while (index < pathname.length) {
		let character = pathname[index] ?? "";
		if (character === "\\") {
			path += pathname[index + 1] ?? "";
			index += 2;
			continue;
		}
		if (character === "(" || character === ")") {
			return failure(new Error(`The optional segment in "${pattern.source}" has no OpenAPI form`));
		}
		if (character === ":" || character === "*") {
			let name = IDENTIFIER.exec(pathname.slice(index + 1))?.[0];
			if (name === undefined) {
				return failure(
					new Error(`The unnamed wildcard in "${pattern.source}" has no OpenAPI form`),
				);
			}
			path += `{${name}}`;
			variables.push(name);
			index += name.length + 1;
			continue;
		}
		path += character;
		index += 1;
	}
	return success({ path, variables });
}
