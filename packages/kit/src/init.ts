/**
 * `sdxc init`: writes `.config/sdxc.jsonc` with every default spelled out, rendered from the
 * configuration schema, so a key added to the schema reaches the output with its description
 * as the comment above it. An existing configuration file is never overwritten.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { JSONSchema } from "@sdxc/json-schema";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import { CONFIG_LOCATIONS, configJSONSchema, findConfigFile } from "./config.js";

/** Where `init` writes the configuration, relative to the project root. */
export const INIT_LOCATION = CONFIG_LOCATIONS[0];

/**
 * The `$schema` reference that brings editor completion: the schema the latest `@sdxc/kit`
 * publishes, which reaches a project whether or not the kit is installed in it.
 */
export const SCHEMA_REFERENCE = "https://unpkg.com/@sdxc/kit/config.schema.json";

/** What `init` did, for the CLI to report. */
export interface InitOutcome {
	/** The file, relative to the project root. */
	path: string;
	content: string;
	/** `false` under `--dry-run`, when the content was only rendered. */
	written: boolean;
}

/**
 * Writes the rendered configuration to {@link INIT_LOCATION} in the project at `root`, creating
 * `.config/`. A configuration file at either location is a failure naming it; `dryRun` renders
 * the file and writes nothing.
 */
export async function init(
	root: string,
	options: { dryRun: boolean },
): Promise<Result<InitOutcome, Error>> {
	let existing = await findConfigFile(root);
	if (isFailure(existing)) return existing;
	if (existing.data !== null) {
		return failure(new Error(`${existing.data} already exists; sdxc init leaves it as it is`));
	}
	let content = renderConfig();
	if (isFailure(content)) return content;
	let outcome = { path: INIT_LOCATION, content: content.data, written: false };
	if (options.dryRun) return success(outcome);
	let target = join(root, INIT_LOCATION);
	let written = await wrap(async () => {
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, content.data, { flag: "wx" });
	});
	if (isFailure(written)) return written;
	return success({ ...outcome, written: true });
}

/**
 * The configuration file `init` writes: `$schema` first, then every key in schema order with
 * its description as a comment. A key with a default is written with it; a key without one is
 * written commented out with its first example.
 */
export function renderConfig(): Result<string, Error> {
	let schema = configJSONSchema();
	if (isFailure(schema)) return schema;
	let lines = ["{", `\t${JSON.stringify("$schema")}: ${JSON.stringify(SCHEMA_REFERENCE)},`];
	renderProperties(schema.data, 1, lines);
	lines.push("}");
	return success(`${lines.join("\n")}\n`);
}

/** Appends one line per key of `schema`'s properties, nesting into a group that has its own. */
function renderProperties(schema: JSONSchema, depth: number, lines: string[]): void {
	let indent = "\t".repeat(depth);
	for (let [key, property] of Object.entries(schema.properties ?? {})) {
		if (key === "$schema" || typeof property === "boolean") continue;
		if (typeof property.description === "string") lines.push(`${indent}// ${property.description}`);
		let name = JSON.stringify(key);
		if (property.properties !== undefined) {
			lines.push(`${indent}${name}: {`);
			renderProperties(property, depth + 1, lines);
			lines.push(`${indent}},`);
		} else if ("default" in property) {
			lines.push(`${indent}${name}: ${inline(property.default)},`);
		} else {
			lines.push(`${indent}// ${name}: ${inline(property.examples?.[0] ?? null)},`);
		}
	}
}

/** `value` as JSON on one line, with a space after each comma and inside each brace. */
function inline(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(inline).join(", ")}]`;
	if (typeof value === "object" && value !== null) {
		let entries = Object.entries(value).map(
			([key, item]) => `${JSON.stringify(key)}: ${inline(item)}`,
		);
		return entries.length === 0 ? "{}" : `{ ${entries.join(", ")} }`;
	}
	return JSON.stringify(value);
}
