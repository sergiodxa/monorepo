/**
 * Per-project and third-party plugin loading: the CLI-internal machinery that
 * reads a suite's `spec.plugins.jsonc` manifest, decides which declared plugins
 * the caller authorized to launch, and connects the authorized ones over the
 * stdio transport. Launching a manifest plugin runs project-declared code, so
 * it is deny-by-default: a plugin starts only when `--allow-plugins` grants it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isAbsolute, resolve } from "node:path";

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { LoadedSuite } from "./loader";
import type { Plugin } from "./plugin";

import { LoadError, SpecError, ToolError } from "./errors";
import { connectStdioPlugin } from "./transport-stdio";

/** Conventional manifest file names, tried in this order under the suite dir. */
const MANIFEST_NAMES = ["spec.plugins.jsonc", "spec.plugins.json"] as const;

/** The `--allow-plugins` flag and its scoped form, parsed CLI-side. */
const ALLOW_PLUGINS_FLAG = "--allow-plugins";

/**
 * Namespaces the runtime provides itself; a manifest may not claim one of
 * them, because a declared plugin sharing the name would silently shadow the
 * built-in in the registry.
 */
const BUILT_IN_NAMESPACES: ReadonlySet<string> = new Set(["fs", "cli", "http", "browser", "db"]);

/**
 * Whether, and how far, the caller authorized launching manifest plugins.
 * Absent `--allow-plugins` leaves it `denied`; a bare flag is `all`; a scoped
 * `--allow-plugins=a,b` names the namespaces allowed to launch.
 */
export type PluginLaunchGrant =
	| { mode: "denied" }
	| { mode: "all" }
	| { mode: "scoped"; namespaces: string[] };

/** One plugin a project declares: its namespace and the command to launch it. */
export interface PluginDeclaration {
	/** The namespace the plugin's tools live under, e.g. `"demo"`. */
	namespace: string;
	/**
	 * The argv that launches the plugin. Relative path arguments (those starting
	 * with `.`) are already resolved absolute against the manifest's directory,
	 * so the command runs the same from any working directory.
	 */
	command: string[];
}

/** A parsed plugin manifest: the plugins a project declares, in file order. */
export interface PluginManifest {
	/** The declared plugins; empty when no manifest exists or it declares none. */
	plugins: PluginDeclaration[];
}

/** Splitting the manifest's plugins into those to launch and those refused. */
export interface LaunchPlan {
	/** Declarations the grant authorized, to be connected. */
	launch: PluginDeclaration[];
	/** Namespaces declared but not authorized to launch. */
	deniedNamespaces: string[];
}

/**
 * Extract the `--allow-plugins` grant from a raw argument list, returning the
 * remaining arguments untouched for the permission parser to handle. A bare
 * flag authorizes every declared plugin; `--allow-plugins=a,b` authorizes the
 * named namespaces; repeated flags union, and a bare flag absorbs scopes.
 * Handled here rather than in the permission engine because launching a plugin
 * is not one of the four capability families `--allow-*` grants.
 *
 * @param args - The raw CLI arguments after `run`.
 * @returns The launch grant plus the arguments that were not `--allow-plugins`.
 */
export function parsePluginGrant(
	args: string[],
): Result<{ grant: PluginLaunchGrant; remaining: string[] }, SpecError> {
	let grant: PluginLaunchGrant = { mode: "denied" };
	let remaining: string[] = [];
	for (let argument of args) {
		if (argument === ALLOW_PLUGINS_FLAG) {
			grant = grant.mode === "all" ? grant : { mode: "all" };
			continue;
		}
		if (!argument.startsWith(`${ALLOW_PLUGINS_FLAG}=`)) {
			remaining.push(argument);
			continue;
		}
		let namespaces = argument
			.slice(ALLOW_PLUGINS_FLAG.length + 1)
			.split(",")
			.map((namespace) => namespace.trim())
			.filter((namespace) => namespace.length > 0);
		if (namespaces.length === 0) {
			return failure(
				new SpecError(
					"usage-error",
					`${ALLOW_PLUGINS_FLAG}= expects a comma-separated namespace list, e.g. ${ALLOW_PLUGINS_FLAG}=demo.`,
				),
			);
		}
		grant = widenLaunchGrant(grant, namespaces);
	}
	return success({ grant, remaining });
}

/**
 * Read the plugin manifest that governs a suite directory. The manifest lives
 * in the directory passed to `spec run` (the suite dir); `spec.plugins.jsonc`
 * is tried before `spec.plugins.json`. A missing manifest is not an error — it
 * simply declares no plugins. The manifest is JSONC (comments and trailing
 * commas tolerated), and relative command paths resolve against its directory.
 *
 * @param suiteRoot - The suite directory `spec run` was pointed at.
 * @returns The parsed manifest, or the failure that made it unreadable.
 */
export async function loadPluginManifest(
	suiteRoot: string,
): Promise<Result<PluginManifest, SpecError>> {
	let directory = resolve(suiteRoot);
	for (let name of MANIFEST_NAMES) {
		let path = resolve(directory, name);
		let file = Bun.file(path);
		if (!(await file.exists())) continue;
		let text: string;
		try {
			text = await file.text();
		} catch (error) {
			return failure(
				new LoadError("load-error", `Cannot read plugin manifest ${path}: ${errorMessage(error)}`),
			);
		}
		let parsed = parseJsonc(text, path);
		if (isFailure(parsed)) return parsed;
		return validateManifest(parsed.data, directory, path);
	}
	return success({ plugins: [] });
}

/**
 * Split a manifest's declarations into the ones the grant authorizes and the
 * namespaces it refuses. Refusal is not yet a failure — a declared plugin the
 * suite never imports may stay unlaunched with no consequence — so this only
 * partitions; {@link deniedReferences} decides whether a refusal actually bites.
 *
 * @param manifest - The parsed manifest.
 * @param grant - The caller's `--allow-plugins` grant.
 * @returns The plugins to launch and the namespaces refused.
 */
export function planPluginLaunch(manifest: PluginManifest, grant: PluginLaunchGrant): LaunchPlan {
	let launch: PluginDeclaration[] = [];
	let deniedNamespaces: string[] = [];
	for (let declaration of manifest.plugins) {
		if (grantAdmits(grant, declaration.namespace)) launch.push(declaration);
		else deniedNamespaces.push(declaration.namespace);
	}
	return { launch, deniedNamespaces };
}

/**
 * Which refused namespaces the suite actually imports with `use`. A denied
 * declaration only matters when a spec depends on it; those it does not import
 * stay dormant. The result drives the deny-by-default diagnostic, so a caller
 * who forgot `--allow-plugins` is told exactly which grant is missing.
 *
 * @param suite - The loaded suite, for its files' `use` imports.
 * @param deniedNamespaces - The namespaces refused by {@link planPluginLaunch}.
 * @returns The refused namespaces the suite imports, in first-seen order.
 */
export function deniedReferences(suite: LoadedSuite, deniedNamespaces: string[]): string[] {
	if (deniedNamespaces.length === 0) return [];
	let denied = new Set(deniedNamespaces);
	let referenced: string[] = [];
	let seen = new Set<string>();
	for (let file of suite.files) {
		for (let use of file.uses) {
			if (denied.has(use.namespace) && !seen.has(use.namespace)) {
				seen.add(use.namespace);
				referenced.push(use.namespace);
			}
		}
	}
	return referenced;
}

/**
 * Build the deny-by-default diagnostic for a suite that imports plugins it was
 * not authorized to launch. Shaped like a permission denial — code
 * `permission-denied` with a `--allow-plugins` remedy — so it reads the same as
 * every other refused capability.
 *
 * @param namespaces - The imported-but-unauthorized namespaces.
 * @returns The error the CLI reports before any test runs.
 */
export function launchDeniedError(namespaces: string[]): SpecError {
	let list = namespaces.join(", ");
	let plural = namespaces.length === 1 ? "namespace" : "namespaces";
	let error = new SpecError(
		"permission-denied",
		`Plugin launch denied: the suite imports the plugin ${plural} ${list}, declared in the plugin manifest but not authorized to launch. Launching a manifest plugin executes the command the project declares for it, so it is denied unless you allow it.`,
	);
	error.remedy = `spec run ${ALLOW_PLUGINS_FLAG}=${namespaces.join(",")}`;
	return error;
}

/**
 * Connect the authorized plugins over the stdio transport, in declaration
 * order. Each connection spawns the plugin's command and completes its describe
 * handshake; if any fails, the ones already connected are disposed before the
 * failure is returned, so a partial launch never leaks a child process.
 *
 * @param launch - The declarations {@link planPluginLaunch} authorized.
 * @returns The connected plugins, ready to pass to `runSuite`, or the failure.
 */
export async function connectManifestPlugins(
	launch: PluginDeclaration[],
): Promise<Result<Plugin[], SpecError>> {
	let connected: Plugin[] = [];
	for (let declaration of launch) {
		let result = await connectStdioPlugin(declaration.command, declaration.namespace);
		if (isFailure(result)) {
			await disposeAll(connected);
			return failure(
				new ToolError(
					`Failed to load plugin "${declaration.namespace}" from the manifest command "${declaration.command.join(" ")}": ${result.error.message}`,
				),
			);
		}
		connected.push(result.data);
	}
	return success(connected);
}

/**
 * Dispose a set of connected plugins, best-effort. Used to unwind a partial
 * launch and by the CLI when a run never reaches the runner's own teardown;
 * a throwing or absent `dispose` is ignored, exactly as the runner treats it.
 *
 * @param plugins - The plugins to release.
 */
export async function disposeAll(plugins: Plugin[]): Promise<void> {
	for (let plugin of plugins) {
		if (plugin.dispose === undefined) continue;
		try {
			await plugin.dispose();
		} catch {
			// Teardown failures are never run failures.
		}
	}
}

/** Merge one `--allow-plugins=` occurrence into the grant so far. */
function widenLaunchGrant(current: PluginLaunchGrant, namespaces: string[]): PluginLaunchGrant {
	if (current.mode === "all") return current;
	if (current.mode === "denied") return { mode: "scoped", namespaces: [...namespaces] };
	let merged = [...current.namespaces];
	for (let namespace of namespaces) {
		if (!merged.includes(namespace)) merged.push(namespace);
	}
	return { mode: "scoped", namespaces: merged };
}

/** Whether a launch grant authorizes launching a given namespace. */
function grantAdmits(grant: PluginLaunchGrant, namespace: string): boolean {
	if (grant.mode === "all") return true;
	if (grant.mode === "scoped") return grant.namespaces.includes(namespace);
	return false;
}

/** Parse manifest text as JSONC, tolerating comments and trailing commas. */
function parseJsonc(text: string, path: string): Result<unknown, SpecError> {
	try {
		return success(JSON.parse(stripTrailingCommas(stripComments(text))));
	} catch (error) {
		return failure(
			new LoadError(
				"load-error",
				`Plugin manifest ${path} is not valid JSONC: ${errorMessage(error)}`,
			),
		);
	}
}

/**
 * Shape a parsed manifest object into a {@link PluginManifest}, rejecting every
 * malformed declaration with a `load-error` that names the offending plugin.
 * Relative command paths are resolved absolute against the manifest directory.
 */
function validateManifest(
	parsed: unknown,
	directory: string,
	path: string,
): Result<PluginManifest, SpecError> {
	if (!isRecord(parsed)) {
		return failure(new LoadError("load-error", `Plugin manifest ${path} must be a JSON object.`));
	}
	let pluginsField = parsed.plugins;
	if (pluginsField === undefined) return success({ plugins: [] });
	if (!isRecord(pluginsField)) {
		return failure(
			new LoadError(
				"load-error",
				`Plugin manifest ${path} must map "plugins" to an object of namespace → { command }.`,
			),
		);
	}
	let plugins: PluginDeclaration[] = [];
	for (let [namespace, declaration] of Object.entries(pluginsField)) {
		let validated = validateDeclaration(namespace, declaration, directory, path);
		if (isFailure(validated)) return validated;
		plugins.push(validated.data);
	}
	return success({ plugins });
}

/** Validate one namespace → declaration entry from the manifest. */
function validateDeclaration(
	namespace: string,
	declaration: unknown,
	directory: string,
	path: string,
): Result<PluginDeclaration, SpecError> {
	if (namespace.length === 0 || namespace.includes(".")) {
		return failure(
			new LoadError(
				"load-error",
				`Plugin manifest ${path} declares an invalid namespace "${namespace}": a namespace is non-empty and contains no dot.`,
			),
		);
	}
	if (BUILT_IN_NAMESPACES.has(namespace)) {
		return failure(
			new LoadError(
				"load-error",
				`Plugin manifest ${path} declares the namespace "${namespace}", which is a built-in capability and cannot be overridden.`,
			),
		);
	}
	if (!isRecord(declaration) || !Array.isArray(declaration.command)) {
		return failure(
			new LoadError(
				"load-error",
				`Plugin "${namespace}" in ${path} must be an object with a "command" array, e.g. { "command": ["bun", "./plugin.ts"] }.`,
			),
		);
	}
	let command = declaration.command;
	if (command.length === 0 || !command.every((part) => typeof part === "string")) {
		return failure(
			new LoadError(
				"load-error",
				`Plugin "${namespace}" in ${path} needs a non-empty "command" array of strings.`,
			),
		);
	}
	let resolved = command.map((part) => resolveCommandPart(part, directory));
	return success({ namespace, command: resolved });
}

/**
 * Resolve one command argument. An argument starting with `.` is a manifest-
 * relative path, made absolute against the manifest directory so the command
 * runs identically from any working directory; every other argument (an
 * executable found on `PATH`, an absolute path, a plain flag) is left verbatim.
 */
function resolveCommandPart(part: string, directory: string): string {
	if (part.startsWith(".")) return resolve(directory, part);
	if (isAbsolute(part)) return part;
	return part;
}

/** Whether a value is a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Remove `//` line and block comments from JSONC text without touching comment
 * markers that appear inside string literals.
 */
function stripComments(source: string): string {
	let out = "";
	let inString = false;
	let escaped = false;
	let index = 0;
	while (index < source.length) {
		let char = source[index];
		if (inString) {
			out += char;
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') inString = false;
			index += 1;
			continue;
		}
		if (char === '"') {
			inString = true;
			out += char;
			index += 1;
			continue;
		}
		if (char === "/" && source[index + 1] === "/") {
			index += 2;
			while (index < source.length && source[index] !== "\n") index += 1;
			continue;
		}
		if (char === "/" && source[index + 1] === "*") {
			index += 2;
			while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
				index += 1;
			}
			index += 2;
			continue;
		}
		out += char;
		index += 1;
	}
	return out;
}

/**
 * Remove commas that immediately precede a `}` or `]` (ignoring whitespace),
 * again leaving string contents untouched — the second half of JSONC leniency.
 */
function stripTrailingCommas(source: string): string {
	let out = "";
	let inString = false;
	let escaped = false;
	for (let index = 0; index < source.length; index++) {
		let char = source[index];
		if (inString) {
			out += char;
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') {
			inString = true;
			out += char;
			continue;
		}
		if (char === ",") {
			let ahead = index + 1;
			while (ahead < source.length && /\s/.test(source[ahead] ?? "")) ahead += 1;
			let next = source[ahead];
			if (next === "}" || next === "]") continue;
		}
		out += char;
	}
	return out;
}

/** Render an unknown thrown value as a one-line message. */
function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
