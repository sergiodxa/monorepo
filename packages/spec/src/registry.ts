/**
 * Name resolution for the whole suite: which callable a dotted target means,
 * given the plugins that are connected, the definitions that are loaded, and
 * the namespaces a file imported with `use`. Ambiguity is always an error —
 * the runtime never guesses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isSuccess, success } from "@pkg/result";

import type { CommandNode, FixtureNode } from "./ast";
import type { LoadedSuite } from "./loader";
import type { Plugin, ToolDescriptor } from "./plugin";

import { ResolutionError } from "./errors";

/** What a call target resolved to: a plugin tool or a suite command. */
export type ResolvedCallable =
	| {
			kind: "tool";
			/** The plugin owning the tool. */
			plugin: Plugin;
			/** The resolved tool's descriptor. */
			descriptor: ToolDescriptor;
			/** The tool's namespace, for diagnostics (`fs.write`). */
			namespace: string;
	  }
	| {
			kind: "command";
			/** The resolved command definition. */
			command: CommandNode;
	  };

/**
 * The suite's resolution table. Built once after loading, then consulted for
 * every call. Resolution rules: a dotted target (`fs.write`) resolves inside
 * that namespace; a bare target resolves among suite commands plus the tools
 * of namespaces the calling file imported; a name matching more than one
 * candidate is an `ambiguous-name` error listing every candidate.
 */
export interface Registry {
	/**
	 * Resolve a call target as written in some file.
	 *
	 * @param target - The dotted target text, e.g. `"login"` or `"http.post"`.
	 * @param uses - The namespaces the calling file imported, in order.
	 */
	resolveCallable(
		target: string,
		uses: readonly string[],
	): Result<ResolvedCallable, ResolutionError>;
	/** Resolve `fixture NAME` to its definition. */
	resolveFixture(name: string): Result<FixtureNode, ResolutionError>;
	/** Whether a bare name could resolve to anything callable (for `expect`). */
	isCallable(target: string, uses: readonly string[]): boolean;
}

/**
 * Build the suite's resolution table from the connected plugins and the
 * loaded definitions. Each plugin's descriptors are read once — a plugin's
 * tool set is stable for its lifetime — so every later resolution is a map
 * lookup.
 *
 * @param plugins - The connected plugins, one namespace each.
 * @param suite - The loaded suite whose commands and fixtures resolve here.
 * @returns The registry the executor consults for every call.
 */
export function createRegistry(plugins: Plugin[], suite: LoadedSuite): Registry {
	let namespaces = new Map<string, { plugin: Plugin; tools: Map<string, ToolDescriptor> }>();
	for (let plugin of plugins) {
		let tools = new Map<string, ToolDescriptor>();
		for (let descriptor of plugin.describe()) tools.set(descriptor.name, descriptor);
		namespaces.set(plugin.namespace, { plugin, tools });
	}

	/** Resolve a `ns.tool` target inside its namespace, never elsewhere. */
	function resolveQualified(
		target: string,
		namespace: string,
		tool: string,
	): Result<ResolvedCallable, ResolutionError> {
		let entry = namespaces.get(namespace);
		if (!entry) {
			return failure(
				new ResolutionError(
					"unknown-name",
					`Unknown name "${target}": no plugin provides the namespace "${namespace}".`,
				),
			);
		}
		let descriptor = entry.tools.get(tool);
		if (!descriptor) {
			let available = [...entry.tools.keys()].map((name) => `${namespace}.${name}`);
			let listing =
				available.length > 0 ? `Its tools are: ${available.join(", ")}.` : `It exposes no tools.`;
			return failure(
				new ResolutionError(
					"unknown-name",
					`Unknown tool "${tool}" in namespace "${namespace}". ${listing}`,
				),
			);
		}
		let resolved: ResolvedCallable = {
			kind: "tool",
			plugin: entry.plugin,
			descriptor,
			namespace,
		};
		return success(resolved);
	}

	/**
	 * Resolve a bare target among suite commands (which never need `use`) and
	 * the tools of the namespaces the calling file imported. More than one
	 * candidate is an ambiguity error — the runtime never guesses.
	 */
	function resolveBare(
		target: string,
		uses: readonly string[],
	): Result<ResolvedCallable, ResolutionError> {
		let candidates: Array<{ qualified: string; resolved: ResolvedCallable }> = [];
		let command = suite.commands.get(target);
		if (command) candidates.push({ qualified: target, resolved: { kind: "command", command } });
		let visited = new Set<string>();
		for (let namespace of uses) {
			if (visited.has(namespace)) continue;
			visited.add(namespace);
			let entry = namespaces.get(namespace);
			if (!entry) continue;
			let descriptor = entry.tools.get(target);
			if (!descriptor) continue;
			candidates.push({
				qualified: `${namespace}.${target}`,
				resolved: { kind: "tool", plugin: entry.plugin, descriptor, namespace },
			});
		}
		let [first] = candidates;
		if (first && candidates.length === 1) return success(first.resolved);
		if (candidates.length === 0) {
			return failure(
				new ResolutionError(
					"unknown-name",
					`Unknown name "${target}": it is not a suite command, and no namespace imported with \`use\` provides it.`,
				),
			);
		}
		let qualified = candidates.map((candidate) => candidate.qualified);
		let described = candidates.map((candidate) =>
			candidate.resolved.kind === "command"
				? `the command "${candidate.qualified}"`
				: candidate.qualified,
		);
		return failure(
			new ResolutionError(
				"ambiguous-name",
				`Ambiguous name "${target}": it matches ${described.join(" and ")}. Use the fully qualified name.`,
				qualified,
			),
		);
	}

	/** Dispatch on the target's shape: bare, `ns.tool`, or too many dots. */
	function resolveCallable(
		target: string,
		uses: readonly string[],
	): Result<ResolvedCallable, ResolutionError> {
		let segments = target.split(".");
		if (segments.length > 2) {
			return failure(
				new ResolutionError(
					"unknown-name",
					`Unknown name "${target}": a call target has at most one dot (namespace.tool).`,
				),
			);
		}
		let [head, tail] = segments;
		if (head !== undefined && tail !== undefined) return resolveQualified(target, head, tail);
		return resolveBare(target, uses);
	}

	return {
		resolveCallable,
		resolveFixture(name) {
			let fixture = suite.fixtures.get(name);
			if (fixture) return success(fixture);
			return failure(new ResolutionError("unknown-name", `Unknown fixture "${name}".`));
		},
		isCallable(target, uses) {
			return isSuccess(resolveCallable(target, uses));
		},
	};
}
