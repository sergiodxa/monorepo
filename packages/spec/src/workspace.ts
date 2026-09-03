/**
 * The isolated per-test workspace: a runtime primitive every capability
 * shares, not a filesystem-plugin detail. Each test gets a fresh ephemeral
 * directory that `fs` tools write into, `cli` processes start in, and
 * assertions inspect; the runtime cleans it up when the test ends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { lstatSync, realpathSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve as resolvePath, sep } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { PermissionSet } from "./permissions";

import { SpecError, WorkspaceEscapeError } from "./errors";

/**
 * One test's isolated workspace. Path resolution is the safety boundary:
 * workspace-relative paths are safe by default, while absolute paths and
 * paths that traverse out of the root require a host-filesystem grant.
 */
export interface Workspace {
	/** Absolute host path of the workspace root (a fresh temp directory). */
	root: string;
	/**
	 * Resolve a spec-written path to an absolute host path. Relative paths
	 * must stay inside the root, symlinks re-resolved before the check;
	 * absolute paths delegate to the host-fs permission grant.
	 *
	 * @param path - The spec-written path to resolve.
	 * @returns The absolute host path, or a `WorkspaceEscapeError` when the
	 * path would escape the root — including when an existing ancestor's
	 * symlink target cannot be verified — or the host-fs permission's denial
	 * for absolute paths.
	 */
	resolve(path: string): Result<string, SpecError>;
	/**
	 * Remove the workspace directory and everything in it; resolves
	 * unconditionally, keeping removal failures harmless to the test run.
	 */
	cleanup(): Promise<undefined>;
}

/**
 * Create a fresh isolated workspace: a temp directory whose real path
 * (often behind a symlink) bounds every relative path, symlinked
 * ancestors included; absolute paths delegate to the host-fs permission.
 *
 * @param permissions - The run's permission set, consulted for absolute paths.
 * @returns The workspace, or the error that prevented creating its directory.
 */
export async function createWorkspace(
	permissions: PermissionSet,
): Promise<Result<Workspace, SpecError>> {
	let root: string;
	try {
		let created = await mkdtemp(join(tmpdir(), "spec-workspace-"));
		root = await realpath(created);
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(new SpecError("tool-error", `Failed to create a test workspace: ${reason}`));
	}
	let workspace: Workspace = {
		root,
		resolve(path) {
			if (isAbsolute(path)) {
				let resolved = resolvePath(path);
				let checked = permissions.checkHostFs(resolved);
				if (isFailure(checked)) return checked;
				return success(resolved);
			}
			let resolved = resolvePath(root, path);
			if (!isInside(root, resolved)) return failure(new WorkspaceEscapeError(path));
			let ancestor = deepestExistingAncestor(resolved);
			let realAncestor: string;
			try {
				realAncestor = realpathSync(ancestor);
			} catch {
				return failure(new WorkspaceEscapeError(path));
			}
			let followed = realAncestor + resolved.slice(ancestor.length);
			if (!isInside(root, followed)) return failure(new WorkspaceEscapeError(path));
			return success(resolved);
		},
		async cleanup() {
			try {
				await rm(root, { recursive: true, force: true });
			} catch {}
			return undefined;
		},
	};
	return success(workspace);
}

/**
 * Walk up from a resolved path to the deepest component that exists on disk
 * (symlinks count as existing without being followed), so symlinked ancestors
 * can be re-resolved before the containment check.
 *
 * @param path - An absolute, syntactically resolved path.
 * @returns The deepest existing ancestor, at worst the filesystem root.
 */
function deepestExistingAncestor(path: string): string {
	let current = path;
	while (!entryExists(current)) {
		let parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return current;
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
 * Path-segment-aware containment test: the root contains itself and its
 * descendants, never a sibling that merely shares a name prefix.
 *
 * @param root - The workspace root, already an absolute real path.
 * @param path - The absolute path being checked.
 * @returns Whether the path stays inside the root.
 */
function isInside(root: string, path: string): boolean {
	if (path === root) return true;
	let prefix = root.endsWith(sep) ? root : root + sep;
	return path.startsWith(prefix);
}
