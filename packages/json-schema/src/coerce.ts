import { success } from "@sdxc/result";
import * as coerce from "remix/data-schema/coerce";

/**
 * Coercions for query strings, path params and form fields: the five `remix/data-schema`
 * coercions, whose input side documents the text a caller may send and whose output side
 * documents the value the parser yields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Describe } from "./node.js";
import type { JSONSchema, Schema } from "./types.js";

import { wrap } from "./node.js";

/** Describes a coercion by side: what it accepts on the input side, what it yields on the output. */
function sides(input: JSONSchema, output: JSONSchema): Describe {
	return (context) => success(context.direction === "input" ? { ...input } : { ...output });
}

/** Accepts a finite number or a numeric string, yielding a number. */
export function number(): Schema<unknown, number> {
	return wrap(coerce.number(), {
		describe: sides({ type: ["number", "string"] }, { type: "number" }),
	});
}

/** Accepts a boolean or `"true"` / `"false"` in any case, yielding a boolean. */
export function boolean(): Schema<unknown, boolean> {
	return wrap(coerce.boolean(), {
		describe: sides({ type: ["boolean", "string"] }, { type: "boolean" }),
	});
}

/**
 * Accepts a `Date` or a string `new Date()` reads, yielding a `Date`. Both sides document
 * as an RFC 3339 date-time, the form a `Date` takes in JSON.
 */
export function date(): Schema<unknown, Date> {
	return wrap(coerce.date(), {
		describe: sides(
			{ type: "string", format: "date-time" },
			{ type: "string", format: "date-time" },
		),
	});
}

/** Accepts a bigint, an integer or an integer string, yielding a bigint documented as an integer. */
export function bigint(): Schema<unknown, bigint> {
	return wrap(coerce.bigint(), {
		describe: sides({ type: ["integer", "string"] }, { type: "integer" }),
	});
}

/** Accepts a string or a primitive that stringifies, yielding a string. */
export function string(): Schema<unknown, string> {
	return wrap(coerce.string(), {
		describe: sides({ type: ["string", "number", "boolean"] }, { type: "string" }),
	});
}
