/**
 * The plugin protocol: the single extension seam of the runtime. Built-in
 * capabilities, external stdio plugins, and test fakes all implement the same
 * typed-tool interface, so the executor, permission engine, and diagnostics
 * never know which kind they are talking to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Random } from "@sdxc/sample";

import type { SpecError } from "./errors";
import type { PermissionKind, PermissionSet } from "./permissions";
import type { ToolArg, Value } from "./values";
import type { Workspace } from "./workspace";

/** One declared parameter of a tool, for diagnostics and documentation. */
export interface ToolParam {
	/** The parameter's name as documentation shows it. */
	name: string;
	/** Whether the parameter is a value or a bare-word symbol. */
	kind: "value" | "word";
	/** Whether a call must supply it. */
	required: boolean;
	/** One-line description of what the parameter means. */
	summary: string;
}

/**
 * A tool a plugin exposes. `kind` separates mutations from observations: only
 * observables may run inside `eventually` or head the observable form of
 * `expect`. `requires` declares the permission family the runtime enforces.
 */
export interface ToolDescriptor {
	/** The tool's name inside its namespace, e.g. `"write"`. */
	name: string;
	/** One-line description shown in diagnostics and docs. */
	summary: string;
	/** Whether the tool mutates (`action`) or only observes (`observable`). */
	kind: "action" | "observable";
	/** Permission family the tool needs, absent for workspace-safe tools. */
	requires?: PermissionKind;
	/** Declared parameters, in positional order. */
	params: ToolParam[];
}

/**
 * What the runtime hands a tool for one call: the test's workspace and the
 * caller's grants. The `PermissionSet` is runtime-owned — a plugin calling
 * `check*` asks the runtime, since every call is already gated on `requires`.
 */
export interface ToolContext {
	/** The current test's isolated workspace. */
	workspace: Workspace;
	/** The caller's grant set, for scoped checks (which host? which binary?). */
	permissions: PermissionSet;
	/**
	 * The test's own seeded stream, created from the run's seed and the test's
	 * identity. A plugin draws every random value from here, which is what makes
	 * generated data reproduce regardless of how tests interleave.
	 */
	random: Random;
	/**
	 * The instant the test started, frozen for its whole run so a tool that
	 * reports or generates a time answers consistently within one test.
	 */
	now: Date;
}

/**
 * A connected plugin: one namespace exposing typed tools. Implementations
 * must not throw; every failure is a `Result` error.
 */
export interface Plugin {
	/** The namespace the plugin's tools live under, e.g. `"fs"`. */
	namespace: string;
	/** The tools this plugin exposes. Stable for the plugin's lifetime. */
	describe(): ToolDescriptor[];
	/**
	 * Execute one tool call.
	 *
	 * @param tool - The tool name within this namespace.
	 * @param args - Evaluated arguments, values and words, in call order.
	 * @param context - The test's workspace and the caller's grants.
	 * @returns The tool's result value, or a structured failure.
	 */
	call(tool: string, args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>>;
	/**
	 * Release any process-external resources the plugin accumulated — browser
	 * sessions, connections, spawned daemons. Optional because built-ins hold
	 * nothing to release; must be best-effort so teardown never fails a run.
	 */
	dispose?(): Promise<void>;
}
