/**
 * The deny-by-default permission engine. `spec run` grants nothing; every
 * privileged capability (process execution, network, environment variables,
 * host filesystem) must be granted by the caller with an `--allow-*` flag,
 * and every check flows through this module — plugins never self-authorize.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { lstatSync, realpathSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";

import type { Result } from "@pkg/result";

import { failure, isSuccess, success } from "@pkg/result";

import { PermissionDeniedError, SpecError } from "./errors";

/** The permission families v1 knows about. */
export type PermissionKind = "run" | "net" | "env" | "host-fs";

/**
 * One permission family's grant: denied entirely, granted for everything, or
 * granted for an explicit scope list (executable names, `host[:port]`s,
 * variable names, directory prefixes).
 */
export type Grant = { mode: "denied" } | { mode: "all" } | { mode: "scoped"; scopes: string[] };

/** The caller's complete grant set, as parsed from `--allow-*` flags. */
export interface Grants {
	/** Process execution: scopes are executable basenames. */
	run: Grant;
	/** Network access: scopes are `host` or `host:port`. */
	net: Grant;
	/** Environment variables: scopes are exact variable names. */
	env: Grant;
	/** Host filesystem outside the workspace: scopes are directory prefixes. */
	hostFs: Grant;
}

/**
 * One already-validated entry of a `spec/config.jsonc` `permissions.allow`
 * list: the family it grants and its scopes. An empty `scopes` is a
 * whole-family grant (the bare-string form, e.g. `"run"`); a non-empty one is
 * the scoped-tuple form (e.g. `["run", "echo"]`). The `"plugins"` family rides
 * along here but maps to the plugin launch grant, not a capability family.
 */
export interface ConfigPermissionEntry {
	/** The family this entry grants: a {@link PermissionKind} or `"plugins"`. */
	family: PermissionKind | "plugins";
	/** The scopes; empty means the whole family. */
	scopes: string[];
}

/**
 * The runtime's single enforcement authority. Constructed once per `spec run`
 * from the caller's flags; handed to tools through their context so scoped
 * checks happen in runtime-owned code. Every failure names the permission,
 * the resource, and the exact flag that would grant it.
 */
export interface PermissionSet {
	/**
	 * May the spec execute this program? Matched against the executable's
	 * basename.
	 */
	checkRun(executable: string): Result<undefined, PermissionDeniedError>;
	/** May the spec reach this network host (and optional port)? */
	checkNet(host: string, port?: number): Result<undefined, PermissionDeniedError>;
	/** May the spec read this environment variable? */
	checkEnv(name: string): Result<undefined, PermissionDeniedError>;
	/**
	 * May the spec touch this absolute host path, outside any workspace?
	 * Granted when the path is inside a granted directory prefix.
	 */
	checkHostFs(path: string): Result<undefined, PermissionDeniedError>;
	/**
	 * The environment variable names the caller granted, for building the
	 * filtered environment of child processes — subprocesses inherit granted
	 * variables only, never the full host environment.
	 */
	grantedEnvNames(): string[];
}

/** Maps each recognized `--allow-*` flag to the grant family it feeds. */
const ALLOW_FLAGS = new Map<string, keyof Grants>([
	["--allow-run", "run"],
	["--allow-net", "net"],
	["--allow-env", "env"],
	["--allow-host-fs", "hostFs"],
]);

/**
 * Parse the `--allow-*` flags out of a `spec run` argument list. A bare flag
 * grants its whole family, `--allow-x=a,b` grants an explicit scope list, and
 * an absent flag leaves the family denied. Repeated scoped flags union their
 * scopes; a bare flag absorbs any scopes for that family. Arguments that are
 * not permission flags pass through in `remaining`, order preserved.
 *
 * @param args - The raw CLI arguments to scan.
 * @returns The parsed grants plus the untouched arguments, or a usage error
 * for an unknown `--allow-*` flag or an empty scope list.
 */
export function parseGrants(
	args: string[],
): Result<{ grants: Grants; remaining: string[] }, SpecError> {
	let grants: Grants = {
		run: { mode: "denied" },
		net: { mode: "denied" },
		env: { mode: "denied" },
		hostFs: { mode: "denied" },
	};
	let remaining: string[] = [];
	for (let argument of args) {
		if (!argument.startsWith("--allow-")) {
			remaining.push(argument);
			continue;
		}
		let separator = argument.indexOf("=");
		let flag = separator === -1 ? argument : argument.slice(0, separator);
		let family = ALLOW_FLAGS.get(flag);
		if (family === undefined) {
			return failure(
				new SpecError(
					"usage-error",
					`Unknown permission flag: ${flag}. Known flags: ${[...ALLOW_FLAGS.keys()].join(", ")}.`,
				),
			);
		}
		if (separator === -1) {
			grants[family] = { mode: "all" };
			continue;
		}
		let scopes = argument
			.slice(separator + 1)
			.split(",")
			.map((scope) => scope.trim())
			.filter((scope) => scope.length > 0);
		if (scopes.length === 0) {
			return failure(
				new SpecError(
					"usage-error",
					`${flag}= expects a comma-separated scope list, e.g. ${flag}=<scope>.`,
				),
			);
		}
		grants[family] = widenGrant(grants[family], scopes);
	}
	return success({ grants, remaining });
}

/**
 * Build the runtime's single {@link PermissionSet} from a parsed grant set.
 * Every check denies by default and every denial carries the exact
 * `spec run --allow-*` flag that would grant the attempted resource.
 *
 * @param grants - The caller's grants, from {@link parseGrants}.
 * @returns The permission set every capability check flows through.
 */
export function createPermissionSet(grants: Grants): PermissionSet {
	return {
		checkRun(executable) {
			let name = basename(executable);
			if (grants.run.mode === "all") return success(undefined);
			if (grants.run.mode === "scoped" && grants.run.scopes.includes(name)) {
				return success(undefined);
			}
			return failure(new PermissionDeniedError("run", executable, `spec run --allow-run=${name}`));
		},
		checkNet(host, port) {
			if (grants.net.mode === "all") return success(undefined);
			if (grants.net.mode === "scoped") {
				for (let scope of grants.net.scopes) {
					if (netScopeAdmits(scope, host, port)) return success(undefined);
				}
			}
			let resource = port === undefined ? host : `${host}:${port}`;
			return failure(
				new PermissionDeniedError("net", resource, `spec run --allow-net=${resource}`),
			);
		},
		checkEnv(name) {
			if (grants.env.mode === "all") return success(undefined);
			if (grants.env.mode === "scoped" && grants.env.scopes.includes(name)) {
				return success(undefined);
			}
			return failure(new PermissionDeniedError("env", name, `spec run --allow-env=${name}`));
		},
		checkHostFs(path) {
			let resolved = resolve(path);
			if (grants.hostFs.mode === "all") return success(undefined);
			if (grants.hostFs.mode === "scoped") {
				// A lexical prefix test alone would let a pre-existing symlink
				// inside a granted directory reach outside it: compare real
				// paths on both sides, refusing what cannot be resolved.
				let followed = followExistingAncestors(resolved);
				if (followed !== undefined) {
					for (let scope of grants.hostFs.scopes) {
						let granted = followExistingAncestors(resolve(scope));
						if (granted !== undefined && directoryContains(granted, followed)) {
							return success(undefined);
						}
					}
				}
			}
			return failure(
				new PermissionDeniedError("host-fs", path, `spec run --allow-host-fs=${dirname(resolved)}`),
			);
		},
		grantedEnvNames() {
			if (grants.env.mode === "all") return Object.keys(process.env);
			if (grants.env.mode === "scoped") return [...grants.env.scopes];
			return [];
		},
	};
}

/** Maps each config permission family that feeds a capability grant to its key. */
const CONFIG_GRANT_KEYS = new Map<string, keyof Grants>([
	["run", "run"],
	["net", "net"],
	["env", "env"],
	["host-fs", "hostFs"],
]);

/**
 * Fold a validated `permissions.allow` list into a {@link Grants} set. A bare
 * family entry grants the whole family; a scoped entry widens with the same
 * logic repeated CLI flags use, so a config tuple and an `--allow-*` flag merge
 * identically. `"plugins"` entries are skipped — plugin launch is not a
 * capability family and is threaded through the project-config loader instead.
 *
 * @param entries - The validated allow-list entries.
 * @returns The grants the config declares, families it never names left denied.
 */
export function grantsFromConfig(entries: readonly ConfigPermissionEntry[]): Grants {
	let grants: Grants = {
		run: { mode: "denied" },
		net: { mode: "denied" },
		env: { mode: "denied" },
		hostFs: { mode: "denied" },
	};
	for (let entry of entries) {
		let key = CONFIG_GRANT_KEYS.get(entry.family);
		if (key === undefined) continue;
		grants[key] =
			entry.scopes.length === 0 ? { mode: "all" } : widenGrant(grants[key], entry.scopes);
	}
	return grants;
}

/**
 * Union two grant sets family by family: the wider mode wins and two scoped
 * grants merge their scope lists. Used to combine the caller's CLI grants with
 * the config's declared grants when `--allow-config` opts in — CLI flags only
 * ever add to the config set, never subtract from it.
 *
 * @param base - The caller's CLI grants.
 * @param extra - The config's declared grants to fold in.
 * @returns The unioned grant set.
 */
export function mergeGrants(base: Grants, extra: Grants): Grants {
	return {
		run: mergeGrant(base.run, extra.run),
		net: mergeGrant(base.net, extra.net),
		env: mergeGrant(base.env, extra.env),
		hostFs: mergeGrant(base.hostFs, extra.hostFs),
	};
}

/** Union one family's two grants, widening `base` by whatever `extra` adds. */
function mergeGrant(base: Grant, extra: Grant): Grant {
	if (extra.mode === "denied") return base;
	if (extra.mode === "all") return { mode: "all" };
	return widenGrant(base, extra.scopes);
}

/**
 * Whether a grant set would admit a denied resource. Used only to decide the
 * `--allow-config` DX hint: the CLI asks whether the project's declared grants
 * would have covered a denial, dispatching on the family and reusing the exact
 * checks enforcement runs, so the hint matches what `--allow-config` would do.
 *
 * @param grants - The grant set to test against (the config's declared grants).
 * @param permission - The denied family.
 * @param resource - The denial's resource string, as the denial reported it.
 * @returns Whether the grants would have admitted that resource.
 */
export function grantsAdmit(grants: Grants, permission: PermissionKind, resource: string): boolean {
	let set = createPermissionSet(grants);
	if (permission === "run") return isSuccess(set.checkRun(resource));
	if (permission === "env") return isSuccess(set.checkEnv(resource));
	if (permission === "host-fs") return isSuccess(set.checkHostFs(resource));
	let parsed = splitNetResource(resource);
	return isSuccess(set.checkNet(parsed.host, parsed.port));
}

/** Split a `host[:port]` denial resource back into host and optional port. */
function splitNetResource(resource: string): { host: string; port: number | undefined } {
	let separator = resource.lastIndexOf(":");
	if (separator === -1) return { host: resource, port: undefined };
	let suffix = resource.slice(separator + 1);
	if (!/^\d+$/.test(suffix)) return { host: resource, port: undefined };
	return { host: resource.slice(0, separator), port: Number(suffix) };
}

/**
 * Merge one flag occurrence into a family's accumulated grant: an existing
 * grant-all absorbs later scopes, repeated scoped flags union their scope
 * lists, and a denied family upgrades to the new scopes.
 *
 * @param current - The grant accumulated so far.
 * @param scopes - The scope list of the flag being merged.
 * @returns The widened grant.
 */
function widenGrant(current: Grant, scopes: string[]): Grant {
	if (current.mode === "all") return current;
	if (current.mode === "denied") return { mode: "scoped", scopes: [...scopes] };
	let merged = [...current.scopes];
	for (let scope of scopes) {
		if (!merged.includes(scope)) merged.push(scope);
	}
	return { mode: "scoped", scopes: merged };
}

/**
 * Does one `host[:port]` scope admit this host/port pair? A scope without a
 * port admits every port of its host; a scope that pins a port requires the
 * check to name that exact port.
 *
 * @param scope - A granted `host` or `host:port` scope.
 * @param host - The host being reached.
 * @param port - The port being reached, when known.
 * @returns Whether the scope covers the attempt.
 */
function netScopeAdmits(scope: string, host: string, port: number | undefined): boolean {
	let separator = scope.lastIndexOf(":");
	if (separator === -1) return scope === host;
	let scopePort = scope.slice(separator + 1);
	if (!/^\d+$/.test(scopePort)) return scope === host;
	return scope.slice(0, separator) === host && port !== undefined && Number(scopePort) === port;
}

/**
 * Re-resolve the symlinks among a path's existing ancestors: the deepest
 * component that exists on disk is realpathed and the not-yet-existing
 * remainder is appended back untouched — so a symlink planted inside a
 * granted directory cannot smuggle the containment check outside it.
 *
 * @param path - An absolute, syntactically resolved path.
 * @returns The symlink-free spelling, or undefined when the existing ancestor
 * cannot be resolved (e.g. a dangling symlink) — refuse what you cannot verify.
 */
function followExistingAncestors(path: string): string | undefined {
	let ancestor = path;
	while (!entryExists(ancestor)) {
		let parent = dirname(ancestor);
		if (parent === ancestor) break;
		ancestor = parent;
	}
	try {
		return realpathSync(ancestor) + path.slice(ancestor.length);
	} catch {
		return undefined;
	}
}

/**
 * Does a filesystem entry exist at this path, without following symlinks?
 *
 * @param path - The absolute path to probe.
 * @returns Whether lstat finds an entry there.
 */
function entryExists(path: string): boolean {
	try {
		lstatSync(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Path-segment-aware prefix test: `/a/b` contains itself and `/a/b/c`, and
 * never `/a/bc`. Both sides must already be resolved absolute paths.
 *
 * @param directory - The granted directory.
 * @param path - The absolute path being checked.
 * @returns Whether the path lives inside the directory.
 */
function directoryContains(directory: string, path: string): boolean {
	if (path === directory) return true;
	let prefix = directory.endsWith(sep) ? directory : directory + sep;
	return path.startsWith(prefix);
}
