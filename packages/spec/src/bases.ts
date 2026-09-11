/**
 * Named bases and named database connections: the run-level address book a
 * spec writes relative targets against. A spec names `"/portfolios"` and,
 * where more than one base exists, which one with `on "web"`; the operator's
 * `spec/config.jsonc` decides what those names point at.
 *
 * Resolution lives here rather than in `http`, `browser`, or `db` so the same
 * target text means the same thing in all three, and so one run header can
 * print every address the suite will actually reach.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { SpecError } from "./errors.js";

import { ToolError } from "./errors.js";

/** One configured base: the name a spec selects, and where it points. */
export interface Base {
	/** The name `on "…"` selects, as `spec/config.jsonc` spells it. */
	name: string;
	/** The absolute origin (and optional path prefix) targets resolve against. */
	url: string;
}

/** One configured database connection: the name a spec selects, and its DSN. */
export interface Connection {
	/** The name `on "…"` selects, as `spec/config.jsonc` spells it. */
	name: string;
	/** The connection string the driver opens. */
	url: string;
}

/** The run's configured bases, and how a spec's target resolves against them. */
export interface BaseSet {
	/** Every configured base in config order, which the run header prints. */
	list(): Base[];
	/**
	 * Resolve a target as a spec wrote it.
	 *
	 * @param target - The target text: `/path` relative, or an absolute URL.
	 * @param name - The base `on "…"` selected, absent when the spec named none.
	 * @returns The absolute URL to reach, or why the target could not resolve.
	 */
	resolve(target: string, name?: string): Result<URL, SpecError>;
}

/** The run's configured database connections, selected the same way bases are. */
export interface ConnectionSet {
	/** Every configured connection in config order, which the run header prints. */
	list(): Connection[];
	/**
	 * Resolve which connection a query runs against.
	 *
	 * @param name - The connection `on "…"` selected, absent when none was named.
	 * @returns The chosen connection, or why the choice could not be made.
	 */
	resolve(name?: string): Result<Connection, SpecError>;
}

/**
 * Build the run's base set from configured entries.
 *
 * @param bases - The configured bases, in `spec/config.jsonc` order.
 * @returns The set every `http`, `browser`, and `fetch` target resolves through.
 */
export function createBaseSet(bases: readonly Base[]): BaseSet {
	let entries = [...bases];
	return {
		list() {
			return [...entries];
		},
		resolve(target, name) {
			let absolute = absoluteTarget(target);
			if (absolute !== undefined) return success(absolute);
			if (!target.startsWith("/")) {
				return failure(
					new ToolError(
						`The target ${JSON.stringify(target)} is neither absolute nor relative to a base; write it as ${JSON.stringify(`/${target}`)} to resolve it against a base, or give it a scheme to reach it directly.`,
					),
				);
			}
			let chosen = select(entries, name, "base", 'on "web"');
			if (chosen.kind === "failure") return failure(chosen.error);
			let base = chosen.value;
			let root: URL;
			try {
				root = new URL(base.url);
			} catch {
				return failure(
					new ToolError(
						`The base ${JSON.stringify(base.name)} is configured as ${JSON.stringify(base.url)}, which is not an absolute URL.`,
					),
				);
			}
			return success(new URL(joinPath(root.pathname, target), root));
		},
	};
}

/**
 * Build the run's connection set from configured entries.
 *
 * @param connections - The configured connections, in `spec/config.jsonc` order.
 * @returns The set every `db` tool selects its connection through.
 */
export function createConnectionSet(connections: readonly Connection[]): ConnectionSet {
	let entries = [...connections];
	return {
		list() {
			return [...entries];
		},
		resolve(name) {
			let chosen = select(entries, name, "database connection", 'on "web"');
			if (chosen.kind === "failure") return failure(chosen.error);
			return success(chosen.value);
		},
	};
}

/** A chosen entry, or the error explaining why the choice could not be made. */
type Selection<T> = { kind: "value"; value: T } | { kind: "failure"; error: SpecError };

/**
 * Pick the entry a spec meant: the named one, or the only one when the spec
 * named none. Every failure lists the configured names, so a spec that guessed
 * wrong is one edit away from right.
 *
 * @param entries - The configured entries, in config order.
 * @param name - The name the spec selected with `on "…"`, when it did.
 * @param kind - What is being selected, for the message.
 * @param example - An example `on "…"` clause, for the message.
 */
function select<T extends { name: string }>(
	entries: readonly T[],
	name: string | undefined,
	kind: string,
	example: string,
): Selection<T> {
	if (name !== undefined) {
		let match = entries.find((entry) => entry.name === name);
		if (match !== undefined) return { kind: "value", value: match };
		return {
			kind: "failure",
			error: new ToolError(
				`No ${kind} named ${JSON.stringify(name)} is configured. ${describeConfigured(entries, kind)}`,
			),
		};
	}
	let [only] = entries;
	if (only !== undefined && entries.length === 1) return { kind: "value", value: only };
	if (entries.length === 0) {
		return {
			kind: "failure",
			error: new ToolError(
				`No ${kind} is configured; declare one in spec/config.jsonc before a spec can select it.`,
			),
		};
	}
	return {
		kind: "failure",
		error: new ToolError(
			`Several ${kind}s are configured, so this call must select one with ${example}. ${describeConfigured(entries, kind)}`,
		),
	};
}

/** The configured names, as a sentence a failure ends with. */
function describeConfigured<T extends { name: string }>(
	entries: readonly T[],
	kind: string,
): string {
	if (entries.length === 0) return `No ${kind} is configured.`;
	let names = entries.map((entry) => JSON.stringify(entry.name)).join(", ");
	return `Configured: ${names}.`;
}

/**
 * The absolute URL a target already names, or undefined when it is relative.
 * A target carrying a scheme is taken as written, and `//host/path` inherits
 * `https`, which is the scheme a host reached without one serves today.
 */
function absoluteTarget(target: string): URL | undefined {
	if (target.startsWith("//")) {
		try {
			return new URL(`https:${target}`);
		} catch {
			return undefined;
		}
	}
	try {
		return new URL(target);
	} catch {
		return undefined;
	}
}

/** Join a base's own path prefix with a spec's `/path`, collapsing the seam. */
function joinPath(prefix: string, path: string): string {
	if (prefix === "" || prefix === "/") return path;
	return `${prefix.replace(/\/$/, "")}${path}`;
}
