/**
 * Name resolution for the whole suite: which callable a dotted target means,
 * given the plugins that are connected, the definitions that are loaded, and
 * the namespaces a file imported with `use`. Ambiguity is always an error —
 * the runtime never guesses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isSuccess, success } from "@sdxc/result";

import type { CommandNode } from "./ast.js";
import type { Plugin, ToolDescriptor } from "./plugin.js";
import type { LoadedSuite } from "./sources.js";

import { ResolutionError } from "./errors.js";

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
 * The suite's resolution table, built once after loading and consulted for
 * every call. A dotted target resolves inside its namespace; a bare target
 * resolves among suite commands and imported namespaces, erring on ambiguity.
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
	/** Whether a bare name could resolve to anything callable (for `expect`). */
	isCallable(target: string, uses: readonly string[]): boolean;
}

/**
 * Build the suite's resolution table from the connected plugins and loaded
 * definitions. Each plugin's descriptors are read once, since a plugin's tool
 * set is stable for its lifetime, making every later resolution a map lookup.
 *
 * @param plugins - The connected plugins, one namespace each.
 * @param suite - The loaded suite whose commands resolve here.
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

	/**
	 * Dispatch on the target's shape. The first dot separates a namespace from
	 * a tool name, and everything after it is the name — a namespace may spell
	 * a tool `fetch.post`, and after `use browser` that same spelling is bare.
	 */
	function resolveCallable(
		target: string,
		uses: readonly string[],
	): Result<ResolvedCallable, ResolutionError> {
		let dot = target.indexOf(".");
		if (dot < 0) return resolveBare(target, uses);
		let head = target.slice(0, dot);
		if (namespaces.has(head)) return resolveQualified(target, head, target.slice(dot + 1));

		let bare = resolveBare(target, uses);
		if (isSuccess(bare) || bare.error.code === "ambiguous-name") return bare;
		return failure(
			new ResolutionError(
				"unknown-name",
				`Unknown name "${target}": no plugin provides the namespace "${head}", and no namespace imported with \`use\` spells a tool "${target}".`,
			),
		);
	}

	return {
		resolveCallable,
		isCallable(target, uses) {
			return isSuccess(resolveCallable(target, uses));
		},
	};
}
