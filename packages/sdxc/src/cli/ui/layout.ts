/**
 * Where copied components live and how the project spells an import of one: the folder from
 * `ui.directory`, the prefix from `ui.alias` or the tsconfig `paths` entry covering that folder,
 * and the extension from the tsconfig's module resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { dirname, join, posix, relative, resolve, sep } from "node:path";

import type { Result } from "@sdxc/result";

import * as JSONC from "@sdxc/jsonc";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { Config } from "../config.js";

/** How the project imports its copies. */
export interface CopyLayout {
	/** The copies' folder relative to the project root, with `/` separators. */
	directory: string;
	/** The import prefix for the folder, or `null` when files import copies relatively. */
	alias: string | null;
	/** `.js` under `node16` and `nodenext` resolution, which require it; empty otherwise. */
	extension: "" | ".js";
}

/** The `compilerOptions` the layout reads, merged down an `extends` chain. */
export interface CompilerOptions {
	paths?: Record<string, string[]>;
	/** The directory `paths` targets resolve against, absolute. */
	pathsBase?: string;
	moduleResolution?: string;
	module?: string;
}

/** How deep an `extends` chain is followed before the rest is ignored. */
const MAX_EXTENDS = 8;

/** The module resolution modes that require an extension on relative imports. */
const NODE_RESOLUTION = new Set(["node16", "nodenext"]);

/**
 * The layout of the project at `root`: `ui.alias` when configured, otherwise inferred from the
 * root `tsconfig.json`. A project without a tsconfig imports copies relatively, without an
 * extension.
 */
export async function readLayout(root: string, config: Config): Promise<Result<CopyLayout, Error>> {
	let directory = posix.normalize(config.ui.directory.split(sep).join("/")).replace(/\/$/, "");
	let options = await readCompilerOptions(join(root, "tsconfig.json"), 0);
	if (isFailure(options)) return options;
	let resolution = (options.data.moduleResolution ?? options.data.module ?? "").toLowerCase();
	return success({
		directory,
		alias: config.ui.alias?.replace(/\/$/, "") ?? inferAlias(root, directory, options.data),
		extension: NODE_RESOLUTION.has(resolution) ? ".js" : "",
	});
}

/**
 * The import prefix a tsconfig `paths` entry gives `directory`: the `<prefix>/*` entry whose
 * target folder contains it, the deepest such target when several do.
 */
export function inferAlias(
	root: string,
	directory: string,
	options: CompilerOptions,
): string | null {
	let best: { alias: string; depth: number } | null = null;
	for (let [key, targets] of Object.entries(options.paths ?? {})) {
		if (!key.endsWith("/*")) continue;
		for (let target of targets) {
			if (!target.endsWith("*")) continue;
			let folder = projectPath(root, options.pathsBase ?? root, target.slice(0, -1));
			if (folder === null) continue;
			let rest: string | null = null;
			if (folder === directory) rest = "";
			else if (folder === "") rest = directory;
			else if (directory.startsWith(`${folder}/`)) rest = directory.slice(folder.length + 1);
			if (rest === null) continue;
			let prefix = key.slice(0, -1);
			let alias = rest === "" ? prefix.slice(0, -1) : `${prefix}${rest}`;
			let depth = folder === "" ? 0 : folder.split("/").length;
			if (best === null || depth > best.depth) best = { alias, depth };
		}
	}
	return best?.alias ?? null;
}

/**
 * The specifier `file` (relative to the project root) imports the copy of `name` with: relative
 * inside the copies' folder and without an alias, the alias elsewhere.
 */
export function copySpecifier(layout: CopyLayout, file: string, name: string): string {
	let from = posix.dirname(file);
	if (layout.alias !== null && from !== layout.directory) {
		return `${layout.alias}/${name}${layout.extension}`;
	}
	let path = posix.relative(from, posix.join(layout.directory, name));
	return `${path.startsWith(".") ? "" : "./"}${path}${layout.extension}`;
}

/**
 * Whether `specifier`, imported from `file`, names the copy of `name`: through the alias or a
 * relative path, with or without an extension, however the project spelled it.
 */
export function namesCopy(
	layout: CopyLayout,
	file: string,
	specifier: string,
	name: string,
): boolean {
	let bare = specifier.replace(/\.(?:js|jsx|ts|tsx)$/, "");
	if (layout.alias !== null && bare === `${layout.alias}/${name}`) return true;
	if (!bare.startsWith(".")) return false;
	return posix.join(posix.dirname(file), bare) === posix.join(layout.directory, name);
}

/**
 * The options of the tsconfig at `path` merged over those it extends, nearest first. Only a
 * relative `extends` is followed, since a package's tsconfig sets no project paths; a missing
 * root file answers no options.
 */
async function readCompilerOptions(
	path: string,
	depth: number,
): Promise<Result<CompilerOptions, Error>> {
	let text = await wrap(() => readFile(path, "utf8"));
	if (isFailure(text)) return success({});
	let parsed = JSONC.parse(text.data);
	if (isFailure(parsed)) return failure(new Error(`${path}: ${parsed.error.message}`));
	let config = parsed.data as {
		extends?: unknown;
		compilerOptions?: {
			paths?: Record<string, string[]>;
			baseUrl?: string;
			moduleResolution?: string;
			module?: string;
		};
	};
	let inherited: CompilerOptions = {};
	let parents = typeof config.extends === "string" ? [config.extends] : config.extends;
	if (Array.isArray(parents) && depth < MAX_EXTENDS) {
		for (let parent of parents) {
			if (typeof parent !== "string" || !parent.startsWith(".")) continue;
			let file = resolve(dirname(path), parent.endsWith(".json") ? parent : `${parent}.json`);
			let options = await readCompilerOptions(file, depth + 1);
			if (isFailure(options)) return options;
			inherited = { ...inherited, ...options.data };
		}
	}
	let own = config.compilerOptions ?? {};
	let merged: CompilerOptions = { ...inherited };
	if (own.moduleResolution !== undefined) merged.moduleResolution = own.moduleResolution;
	if (own.module !== undefined) merged.module = own.module;
	if (own.paths !== undefined) {
		merged.paths = own.paths;
		merged.pathsBase = resolve(dirname(path), own.baseUrl ?? ".");
	} else if (own.baseUrl !== undefined && merged.paths !== undefined) {
		merged.pathsBase = resolve(dirname(path), own.baseUrl);
	}
	return success(merged);
}

/** `target` under `base` relative to `root` with `/` separators, or `null` outside the project. */
function projectPath(root: string, base: string, target: string): string | null {
	let path = relative(root, resolve(base, target)).split(sep).join("/");
	if (path.startsWith("..")) return null;
	return path.replace(/\/$/, "");
}
