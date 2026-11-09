/**
 * Reads a `.stub` file: an optional YAML front matter block between `---` lines, then the body.
 * The front matter is checked by whatever Standard Schema the caller passes, so each tool decides
 * its own keys, and the body is compiled once so syntax errors surface before any render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, isFailure, success } from "@sdxc/result";
import { parse as parseYAML } from "@sdxc/yaml";

import type { Template } from "./template.js";

import { BlueprintError } from "./errors.js";
import { compile } from "./template.js";

/** A parsed stub. */
export interface Stub<Frontmatter = unknown> {
	/** The name errors use for this stub, such as its path. */
	source: string;
	/** The front matter as the schema produced it, or as YAML read it without one; `{}` when absent. */
	frontmatter: Frontmatter;
	/** The text after the front matter. */
	body: string;
	template: Template;
}

/** How `parse` names the stub and checks its front matter. */
export interface ParseOptions<Schema extends StandardSchemaV1 | undefined> {
	/** Validates the front matter; its output becomes `frontmatter`. */
	schema?: Schema;
	/** The name errors use. @default "stub" */
	source?: string;
}

/** The front matter block at the very start of a file, and the body after it. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/;

/**
 * Parses `text` as a stub. A front matter block that is not YAML, fails the schema or is checked
 * by an asynchronous schema is a failure, as is a body whose blocks do not close.
 *
 * @example blueprint.parse(text, { schema: s.object({ to: s.string() }), source: "index.stub" })
 */
export function parse<Schema extends StandardSchemaV1 | undefined = undefined>(
	text: string,
	options: ParseOptions<Schema> = {},
): Result<
	Stub<Schema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<Schema> : unknown>,
	BlueprintError
> {
	let source = options.source ?? "stub";
	let match = FRONTMATTER.exec(text);
	let raw: unknown = {};
	if (match !== null) {
		let yaml = parseYAML(match[1] ?? "");
		if (isFailure(yaml)) {
			return failure(
				new BlueprintError(`Front matter is not YAML: ${yaml.error.message}`, { source }),
			);
		}
		raw = yaml.data ?? {};
	}
	let body = match === null ? text : text.slice(match[0].length);
	let firstLine = match === null ? 1 : match[0].split("\n").length;

	let frontmatter: unknown = raw;
	if (options.schema !== undefined) {
		let checked = options.schema["~standard"].validate(raw);
		if (checked instanceof Promise) {
			return failure(
				new BlueprintError("The front matter schema must validate synchronously", { source }),
			);
		}
		if (checked.issues !== undefined) {
			let problems = checked.issues.map((issue) => {
				let path = (issue.path ?? [])
					.map((key) => String(typeof key === "object" ? key.key : key))
					.join(".");
				return path === "" ? issue.message : `${path}: ${issue.message}`;
			});
			return failure(new BlueprintError(`Front matter ${problems.join("; ")}`, { source }));
		}
		frontmatter = checked.value;
	}

	let template = compile(body, source, firstLine);
	if (isFailure(template)) return template;
	return success({ source, frontmatter: frontmatter as never, body, template: template.data });
}
