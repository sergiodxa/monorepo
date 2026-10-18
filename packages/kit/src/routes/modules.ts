/**
 * The project's modules as `sdxc routes` reads them: each file scanned once, its imports
 * resolved to project files or packages, and its route declarations evaluated with the
 * `remix/routes` helpers' rules, so a contract's routes come out with full patterns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, stat } from "node:fs/promises";
import { join, posix } from "node:path";

import { findModuleReferences, tokenize } from "@sdxc/codemod";
import { isFailure, isSuccess, wrap } from "@sdxc/result";

import type { Declarations, Node } from "./parse.js";

import { applyHelper, helperName } from "./helpers.js";
import { Reader } from "./parse.js";

/** A value a route declaration evaluates to. */
export type Value = RouteValue | MapValue | StringValue | ArrayValue | HelperValue | OpaqueValue;

/** One route; its object identity is what a router's mapping and a contract's listing share. */
export interface RouteValue {
	kind: "route";
	/** `GET`, `POST`, … or `ANY`. */
	method: string;
	pattern: string;
}

/** A route map or plain object, its entries in declaration order. */
export interface MapValue {
	kind: "map";
	entries: Map<string, Value>;
}

/** A string, which a route helper reads as a pattern, a method or an option. */
export interface StringValue {
	kind: "string";
	value: string;
}

/** An array, with spread arrays flattened into it. */
export interface ArrayValue {
	kind: "array";
	items: Value[];
}

/** A `remix/routes` helper, by its canonical name (`route`, `get`, `form`, `resources`, …). */
export interface HelperValue {
	kind: "helper";
	name: string;
}

/** A value the reader does not evaluate. */
export interface OpaqueValue {
	kind: "opaque";
}

/** What an identifier in a module refers to. */
export type Binding =
	| { kind: "import"; specifier: string; imported: string; file: string | null }
	| { kind: "local"; node: Node }
	| { kind: "unknown" };

/** One scanned project file. */
export interface Module {
	/** Project-relative, with its extension. */
	path: string;
	reader: Reader;
	declarations: Declarations;
	/** Local name to the module and export it is imported from. */
	imports: Map<string, { specifier: string; imported: string }>;
	/** Exported name to the module and export it is re-exported from. */
	reexports: Map<string, { specifier: string; imported: string }>;
	/** Every static import and re-export specifier, for telling which modules a file depends on. */
	specifiers: string[];
	/** Evaluated top-level values by local name, shared by every reference to them. */
	values: Map<string, Value>;
}

/** The extensions a specifier without one may resolve to, in the order bundlers try them. */
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", "/index.ts", "/index.tsx", "/index.js"];

/** The opaque value, shared since it carries nothing. */
const OPAQUE: OpaqueValue = { kind: "opaque" };

/**
 * The modules of the project at `root`, loaded on demand and kept for the run, so a contract
 * imported by a router and by another contract evaluates to the same route objects.
 */
export class Project {
	/** The project directory every module path is relative to. */
	readonly root: string;
	/** Problems worth telling the user, each naming the file it concerns. */
	readonly diagnostics: string[] = [];
	private readonly modules = new Map<string, Promise<Module | null>>();

	/** Reads nothing until a module is asked for. */
	constructor(root: string) {
		this.root = root;
	}

	/** The module at a project-relative path, or `null` when it cannot be read or scanned. */
	load(path: string): Promise<Module | null> {
		let cached = this.modules.get(path);
		if (cached !== undefined) return cached;
		let loading = this.read(path);
		this.modules.set(path, loading);
		return loading;
	}

	/**
	 * The project file `specifier` names from `from`, with its extension; `null` for a package.
	 * `~/` is the project root, the alias every app's `tsconfig.json` declares.
	 */
	async resolve(from: string, specifier: string): Promise<string | null> {
		let base: string;
		if (specifier.startsWith("~/")) base = specifier.slice(2);
		else if (specifier.startsWith("./") || specifier.startsWith("../")) {
			base = posix.normalize(posix.join(posix.dirname(from), specifier));
		} else return null;
		let candidates = /\.[cm]?[jt]sx?$/.test(base)
			? [base, base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx")]
			: EXTENSIONS.map((extension) => `${base}${extension}`);
		for (let candidate of candidates) {
			let found = await wrap(() => stat(join(this.root, candidate)));
			if (isSuccess(found) && found.data.isFile()) return candidate;
		}
		return null;
	}

	/** What `name` refers to at the top level of `module`. */
	async bind(module: Module, name: string): Promise<Binding> {
		let imported = module.imports.get(name);
		if (imported !== undefined) {
			return {
				kind: "import",
				...imported,
				file: await this.resolve(module.path, imported.specifier),
			};
		}
		let local = module.declarations.locals.get(name);
		if (local !== undefined) return { kind: "local", node: local };
		return { kind: "unknown" };
	}

	/**
	 * The node `module` exports as `name` (`default` included), following re-exports and
	 * `export default identifier`; `null` when it cannot be found.
	 */
	async exported(module: Module, name: string): Promise<{ module: Module; node: Node } | null> {
		if (name === "default" && module.declarations.defaultExport !== null) {
			return { module, node: module.declarations.defaultExport };
		}
		let local = module.declarations.exports.get(name);
		if (local !== undefined) {
			let node = module.declarations.locals.get(local);
			if (node !== undefined) return { module, node };
			let imported = module.imports.get(local);
			if (imported !== undefined) return this.exportedFrom(module, imported);
		}
		let reexport = module.reexports.get(name);
		if (reexport !== undefined) return this.exportedFrom(module, reexport);
		return null;
	}

	/** The value `module` exports as `name`. */
	async exportValue(module: Module, name: string): Promise<Value> {
		let key = `export:${name}`;
		let cached = module.values.get(key);
		if (cached !== undefined) return cached;
		module.values.set(key, OPAQUE);
		let found = await this.exported(module, name);
		let value = found === null ? OPAQUE : await this.evaluate(found.node, found.module);
		module.values.set(key, value);
		return value;
	}

	/** Evaluates a route declaration expression in `module`. */
	async evaluate(node: Node, module: Module): Promise<Value> {
		switch (node.kind) {
			case "string":
				return { kind: "string", value: node.value };
			case "identifier":
				return this.identifier(node.name, module);
			case "member": {
				let object = await this.evaluate(node.object, module);
				return object.kind === "map" ? (object.entries.get(node.property) ?? OPAQUE) : OPAQUE;
			}
			case "call": {
				let callee = await this.evaluate(node.callee, module);
				if (callee.kind !== "helper") return OPAQUE;
				let args: Value[] = [];
				for (let argument of node.args) {
					if (argument.spread) return OPAQUE;
					args.push(await this.evaluate(argument.node, module));
				}
				return applyHelper(callee.name, args, (message) =>
					this.diagnostics.push(`${module.path}: ${message}`),
				);
			}
			case "object": {
				let entries = new Map<string, Value>();
				for (let entry of node.entries) {
					if ("spread" in entry) {
						let spread = await this.evaluate(entry.spread, module);
						if (spread.kind === "map")
							for (let [key, value] of spread.entries) entries.set(key, value);
						continue;
					}
					entries.set(entry.key, await this.evaluate(entry.value, module));
				}
				return { kind: "map", entries };
			}
			case "array": {
				let items: Value[] = [];
				for (let element of node.elements) {
					let value = await this.evaluate(element.node, module);
					if (element.spread && value.kind === "array") items.push(...value.items);
					else if (!element.spread) items.push(value);
				}
				return { kind: "array", items };
			}
			default:
				return OPAQUE;
		}
	}

	/** The value of a top-level name: a `remix/routes` helper, an import, or a local `const`. */
	private async identifier(name: string, module: Module): Promise<Value> {
		let binding = await this.bind(module, name);
		if (binding.kind === "import") {
			let helper = helperName(binding.specifier, binding.imported);
			if (helper !== null) return { kind: "helper", name: helper };
			if (binding.file === null) return OPAQUE;
			let target = await this.load(binding.file);
			return target === null ? OPAQUE : this.exportValue(target, binding.imported);
		}
		if (binding.kind !== "local") return OPAQUE;
		let cached = module.values.get(name);
		if (cached !== undefined) return cached;
		module.values.set(name, OPAQUE);
		let value = await this.evaluate(binding.node, module);
		module.values.set(name, value);
		return value;
	}

	/** The node another module exports, found through an import or re-export of `from`. */
	private async exportedFrom(
		from: Module,
		reference: { specifier: string; imported: string },
	): Promise<{ module: Module; node: Node } | null> {
		let file = await this.resolve(from.path, reference.specifier);
		if (file === null) return null;
		let target = await this.load(file);
		return target === null ? null : this.exported(target, reference.imported);
	}

	/** Reads and scans one file; a file that does not scan is a diagnostic. */
	private async read(path: string): Promise<Module | null> {
		let source = await wrap(() => readFile(join(this.root, path), "utf8"));
		if (isFailure(source)) return null;
		let tokens = tokenize(path, source.data);
		let references = findModuleReferences(path, source.data);
		if (isFailure(tokens) || isFailure(references)) {
			let error = isFailure(tokens)
				? tokens.error
				: isFailure(references)
					? references.error
					: null;
			this.diagnostics.push(`${path}: could not be read (${error?.message ?? "unknown error"})`);
			return null;
		}
		let reader = new Reader(tokens.data, source.data);
		let imports = new Map<string, { specifier: string; imported: string }>();
		let reexports = new Map<string, { specifier: string; imported: string }>();
		let specifiers: string[] = [];
		for (let reference of references.data) {
			if (reference.kind !== "import" && reference.kind !== "export") continue;
			specifiers.push(reference.specifier);
			for (let bound of reference.names) {
				let target = reference.kind === "import" ? imports : reexports;
				target.set(bound.local, { specifier: reference.specifier, imported: bound.imported });
			}
		}
		return {
			path,
			reader,
			declarations: reader.declarations(),
			imports,
			reexports,
			specifiers,
			values: new Map(),
		};
	}
}
