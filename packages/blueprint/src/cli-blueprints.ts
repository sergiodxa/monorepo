/**
 * Finds and loads an app's blueprints for `sdxc-blueprint`: a folder of stubs, or a single
 * `<name>.stub`, under `.config/blueprint/`. Every stub's front matter names the path
 * it writes in `to`, so file names inside a blueprint are only labels.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { Stub } from "./parse.js";
import type { Template } from "./template.js";

import { BlueprintError } from "./errors.js";
import { parse } from "./parse.js";
import { compile } from "./template.js";

/** Where blueprints live, relative to the working directory. */
export const BLUEPRINTS_DIR = ".config/blueprint";

/** The front matter a stub run by the command line holds. */
const FRONTMATTER = s.object({ to: s.string(), description: s.optional(s.string()) });

/** One stub of a loaded blueprint, with its `to` path compiled. */
export interface LoadedStub {
	stub: Stub<{ to: string; description?: string | undefined }>;
	to: Template;
}

/** A blueprint as `--list` shows it. */
export interface BlueprintEntry {
	name: string;
	description: string | undefined;
	/** Relative to the working directory. */
	path: string;
}

/** A blueprint ready to render. */
export interface Blueprint extends BlueprintEntry {
	/** The stubs, `index.stub` first, then by name. */
	stubs: LoadedStub[];
}

/** A blueprint name: no folders and no dots in front, so a name never leaves the blueprints folder. */
const NAME = /^[A-Za-z0-9][\w-]*$/;

/** The blueprints in the blueprints folder in `cwd`, by name; none when the folder does not exist. */
export async function listBlueprints(cwd: string): Promise<Result<BlueprintEntry[], Error>> {
	let dir = join(cwd, BLUEPRINTS_DIR);
	let entries = await wrap(() => readdir(dir, { withFileTypes: true }));
	if (isFailure(entries)) return success([]);
	let names = new Map<string, string>();
	for (let entry of entries.data) {
		let name = entry.isDirectory() ? entry.name : entry.name.replace(/\.stub$/, "");
		if (!(entry.isDirectory() || entry.name.endsWith(".stub")) || !NAME.test(name)) continue;
		if (names.has(name)) {
			return failure(
				new BlueprintError(`${BLUEPRINTS_DIR}/${name} is both a folder and ${name}.stub; keep one`),
			);
		}
		names.set(name, entry.name);
	}
	let list: BlueprintEntry[] = [];
	for (let name of [...names.keys()].sort()) {
		let loaded = await loadBlueprint(cwd, name);
		if (isFailure(loaded)) return loaded;
		if (loaded.data === undefined) continue;
		let { name: found, description, path } = loaded.data;
		list.push({ name: found, description, path });
	}
	return success(list);
}

/** The stub files of a blueprint folder, `index.stub` first. */
function stubOrder(a: string, b: string): number {
	if (a === "index.stub") return -1;
	if (b === "index.stub") return 1;
	return a.localeCompare(b);
}

/**
 * Loads the blueprint `name`: `<name>/` with its `.stub` files, or `<name>.stub`. A stub without
 * `to`, or whose front matter or body does not parse, fails naming it.
 *
 * @returns The blueprint, or `undefined` when there is none by that name
 */
export async function loadBlueprint(
	cwd: string,
	name: string,
): Promise<Result<Blueprint | undefined, Error>> {
	if (!NAME.test(name)) return success(undefined);
	let dir = join(cwd, BLUEPRINTS_DIR);
	let folder = await wrap(() => readdir(join(dir, name)));
	let files = isFailure(folder)
		? [{ path: `${BLUEPRINTS_DIR}/${name}.stub`, absolute: join(dir, `${name}.stub`) }]
		: folder.data
				.filter((file) => file.endsWith(".stub"))
				.sort(stubOrder)
				.map((file) => ({
					path: `${BLUEPRINTS_DIR}/${name}/${file}`,
					absolute: join(dir, name, file),
				}));
	let path = isFailure(folder) ? `${BLUEPRINTS_DIR}/${name}.stub` : `${BLUEPRINTS_DIR}/${name}`;

	let stubs: LoadedStub[] = [];
	for (let file of files) {
		let text = await wrap(() => readFile(file.absolute, "utf8"));
		if (isFailure(text)) return isFailure(folder) ? success(undefined) : text;
		let stub = parse(text.data, { schema: FRONTMATTER, source: file.path });
		if (isFailure(stub)) return stub;
		let toLine = text.data.split("\n").findIndex((line) => /^to\s*:/.test(line)) + 1;
		let to = compile(stub.data.frontmatter.to, file.path, Math.max(toLine, 1));
		if (isFailure(to)) return to;
		stubs.push({ stub: stub.data, to: to.data });
	}
	if (stubs.length === 0) {
		return failure(new BlueprintError(`${path} holds no .stub files`));
	}
	let description = stubs[0]?.stub.frontmatter.description;
	return success({ name, description, path, stubs });
}
