/**
 * The project's import graph over app source: each relative or `~/` edge between modules, so
 * architecture diagrams and the dependency doctor check share one walk of `findModuleReferences`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";

import { findModuleReferences } from "@sdxc/codemod";
import { isFailure, wrap } from "@sdxc/result";

import { isAppSource, listFiles } from "../doctor/files.js";
import { PROJECT_FOLDERS } from "../stats.js";

import type { Layer } from "./layers.js";

import { allowsDependency, layerOf } from "./layers.js";

/** One directed import from a module to another module inside the project. */
export interface ImportEdge {
	/** The importing file, relative to the project root. */
	from: string;
	/** The resolved target file when known, else the normalised specifier path. */
	to: string;
	/** The specifier as written in the source. */
	specifier: string;
	/**
	 * Whether the import is a dynamic `import()`, which loads the target on first use: a
	 * `lazy()` mapping in a router, dispatcher or command line, or a load that breaks a cycle.
	 */
	deferred: boolean;
}

/** An edge between two layers, with how many module edges it aggregates. */
export interface LayerEdge {
	from: Layer;
	to: Layer;
	count: number;
	/** Whether every underlying edge obeys the dependency rule. */
	allowed: boolean;
}

/** What {@link projectGraph} reports. */
export interface ProjectGraph {
	/** Every app-source module that was scanned. */
	modules: string[];
	/** Relative and `~/` imports that resolve inside the project. */
	edges: ImportEdge[];
	/** Imports from the project's test files into its modules, which keep a test helper in use. */
	testEdges: ImportEdge[];
	/** Module edges rolled up by layer, for the architecture diagram. */
	layers: LayerEdge[];
	/**
	 * Strongly connected components with more than one module, or a self-cycle, over static
	 * imports: a deferred import resolves after every module has loaded.
	 */
	cycles: string[][];
	/** Static module edges that point from an inner layer to an outer one. */
	violations: ImportEdge[];
}

/**
 * Builds the import graph of the project at `root` from every app-source module under the
 * layout folders. Specifiers that leave the project (packages, absolute URLs) are ignored.
 */
export async function projectGraph(root: string): Promise<ProjectGraph> {
	let modules: string[] = [];
	let tests: string[] = [];
	let known = new Set<string>();
	for (let folder of PROJECT_FOLDERS) {
		for (let file of await listFiles(root, folder)) {
			if (isAppSource(file)) {
				modules.push(file);
				known.add(file);
				known.add(withoutExtension(file));
			} else if (TEST_FILE.test(file)) {
				tests.push(file);
			}
		}
	}
	let edges = await importEdges(root, modules, known);
	let testEdges = await importEdges(root, tests, known);
	let loaded = edges.filter((edge) => !edge.deferred);
	return {
		modules,
		edges,
		testEdges,
		layers: aggregateLayers(edges),
		cycles: findCycles(modules, loaded),
		violations: loaded.filter((edge) => !allowsDependency(edge.from, edge.to)),
	};
}

/** Every import in `files` that resolves to a `known` module. */
async function importEdges(
	root: string,
	files: readonly string[],
	known: ReadonlySet<string>,
): Promise<ImportEdge[]> {
	let edges: ImportEdge[] = [];
	for (let file of files) {
		let source = await wrap(() => readFile(join(root, file), "utf8"));
		if (isFailure(source)) continue;
		let references = findModuleReferences(file, source.data);
		if (isFailure(references)) continue;
		for (let { specifier, kind } of references.data) {
			let target = resolveSpecifier(specifier, file);
			if (target === null) continue;
			let resolved = resolveKnown(target, known);
			if (resolved === null) continue;
			edges.push({ from: file, to: resolved, specifier, deferred: kind === "dynamic" });
		}
	}
	return edges;
}

/**
 * Rolls module edges into layer-to-layer counts. A deferred edge counts toward its pair and
 * leaves it allowed, since a `lazy()` mapping is how an initializer reaches what it maps.
 */
export function aggregateLayers(edges: readonly ImportEdge[]): LayerEdge[] {
	let counts = new Map<string, LayerEdge>();
	for (let edge of edges) {
		let from = layerOf(edge.from);
		let to = layerOf(edge.to);
		if (from === null || to === null || from === to) continue;
		let key = `${from}->${to}`;
		let existing = counts.get(key);
		if (existing) {
			existing.count += 1;
			if (!edge.deferred && !allowsDependency(edge.from, edge.to)) existing.allowed = false;
			continue;
		}
		counts.set(key, {
			from,
			to,
			count: 1,
			allowed: edge.deferred || allowsDependency(edge.from, edge.to),
		});
	}
	return [...counts.values()].sort((a, b) =>
		a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from),
	);
}

/**
 * Resolves `specifier` written in `file` to a project-relative path without extension, or
 * `null` when it names a package or a URL.
 */
export function resolveSpecifier(specifier: string, file: string): string | null {
	if (specifier.startsWith("~/")) return specifier.slice(2);
	if (!specifier.startsWith(".")) return null;
	return posix.normalize(posix.join(dirname(file).split("\\").join("/"), specifier));
}

/** A test file, whose imports keep a module in use without being part of the app's graph. */
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/** Matches a resolved specifier against known modules, trying common extensions. */
function resolveKnown(target: string, known: ReadonlySet<string>): string | null {
	let candidates = [
		target,
		`${target}.ts`,
		`${target}.tsx`,
		`${target}.js`,
		`${target}.jsx`,
		`${target}.mts`,
		`${target}.cts`,
		joinIndex(target),
	];
	for (let candidate of candidates) {
		if (candidate === null) continue;
		if (known.has(candidate)) return withPreferredExtension(candidate, known);
		let bare = withoutExtension(candidate);
		if (known.has(bare)) {
			for (let module of known) {
				if (withoutExtension(module) === bare && module.includes(".")) return module;
			}
		}
	}
	return null;
}

/** `dir/index.ts` when `target` names a folder the project holds as an index module. */
function joinIndex(target: string): string | null {
	if (target.endsWith("/")) return `${target}index`;
	return `${target}/index`;
}

/** The first known module path that matches `candidate`'s bare name. */
function withPreferredExtension(candidate: string, known: ReadonlySet<string>): string {
	if (known.has(candidate) && candidate.includes(".")) return candidate;
	let bare = withoutExtension(candidate);
	for (let module of known) {
		if (withoutExtension(module) === bare && module.includes(".")) return module;
	}
	return candidate;
}

/** Drops a trailing `.ts` / `.tsx` / `.js` / … extension. */
function withoutExtension(path: string): string {
	return path.replace(/\.[cm]?[jt]sx?$/, "");
}

/**
 * Every cycle in the directed graph, as the modules on the cycle in visit order. A module that
 * imports itself is a one-node cycle.
 */
export function findCycles(modules: readonly string[], edges: readonly ImportEdge[]): string[][] {
	let adjacency = new Map<string, string[]>();
	for (let module of modules) adjacency.set(module, []);
	for (let edge of edges) {
		let list = adjacency.get(edge.from);
		if (list && !list.includes(edge.to)) list.push(edge.to);
	}
	let index = 0;
	let stack: string[] = [];
	let onStack = new Set<string>();
	let indices = new Map<string, number>();
	let lowlink = new Map<string, number>();
	let cycles: string[][] = [];

	function strongconnect(node: string): void {
		indices.set(node, index);
		lowlink.set(node, index);
		index += 1;
		stack.push(node);
		onStack.add(node);
		for (let next of adjacency.get(node) ?? []) {
			if (!indices.has(next)) {
				strongconnect(next);
				lowlink.set(node, Math.min(lowlink.get(node)!, lowlink.get(next)!));
			} else if (onStack.has(next)) {
				lowlink.set(node, Math.min(lowlink.get(node)!, indices.get(next)!));
			}
		}
		if (lowlink.get(node) === indices.get(node)) {
			let component: string[] = [];
			let member: string | undefined;
			do {
				member = stack.pop();
				if (member === undefined) break;
				onStack.delete(member);
				component.push(member);
			} while (member !== node);
			let self = (adjacency.get(node) ?? []).includes(node);
			if (component.length > 1 || self) cycles.push(component.reverse());
		}
	}

	for (let module of modules) {
		if (!indices.has(module)) strongconnect(module);
	}
	return cycles.sort((a, b) => a[0]!.localeCompare(b[0]!));
}
