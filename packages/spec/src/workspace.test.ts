/**
 * Tests for the isolated per-test workspace: fresh real-path roots, safe
 * relative resolution, traversal and symlink-escape refusal, delegation of
 * absolute paths to the host-fs permission, and idempotent cleanup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

import type { Result } from "@pkg/result";

import { failure, isSuccess, success, unwrap } from "@pkg/result";

import type { PermissionSet } from "./permissions";
import type { Workspace } from "./workspace";

import { PermissionDeniedError, WorkspaceEscapeError } from "./errors";
import { createWorkspace } from "./workspace";

/** Workspaces created during a test, removed again by the afterEach hook. */
const OPEN_WORKSPACES: Workspace[] = [];

/** Extra directories created outside any workspace, removed after each test. */
const OUTSIDE_DIRECTORIES: string[] = [];

afterEach(async () => {
	for (let workspace of OPEN_WORKSPACES.splice(0)) await workspace.cleanup();
	for (let directory of OUTSIDE_DIRECTORIES.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

/**
 * Narrow a result to its error, failing the test when it succeeded.
 *
 * @param result - The result expected to be a failure.
 * @returns The carried error.
 */
function expectFailure<T, E extends Error>(result: Result<T, E>): E {
	if (isSuccess(result)) throw new Error("Expected a failure, got a success");
	return result.error;
}

/**
 * Build a permission set stub whose checks all pass, with overrides.
 *
 * @param overrides - The members to replace.
 * @returns A stub `PermissionSet`.
 */
function stubPermissions(overrides: Partial<PermissionSet> = {}): PermissionSet {
	return {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkEnv: () => success(undefined),
		checkHostFs: () => success(undefined),
		grantedEnvNames: () => [],
		...overrides,
	};
}

/**
 * Create a workspace registered for automatic cleanup.
 *
 * @param permissions - The permission set to hand the workspace.
 * @returns The created workspace.
 */
async function openWorkspace(permissions: PermissionSet = stubPermissions()): Promise<Workspace> {
	let workspace = unwrap(await createWorkspace(permissions));
	OPEN_WORKSPACES.push(workspace);
	return workspace;
}

/**
 * Create a directory outside every workspace, removed after the test.
 *
 * @returns The directory's real absolute path.
 */
function makeOutsideDirectory(): string {
	let directory = realpathSync(mkdtempSync(join(tmpdir(), "spec-outside-")));
	OUTSIDE_DIRECTORIES.push(directory);
	return directory;
}

describe("createWorkspace", () => {
	test("creates a fresh absolute root that is already a real path", async () => {
		let workspace = await openWorkspace();
		expect(isAbsolute(workspace.root)).toBe(true);
		expect(existsSync(workspace.root)).toBe(true);
		expect(realpathSync(workspace.root)).toBe(workspace.root);
	});

	test("every workspace gets its own root", async () => {
		let first = await openWorkspace();
		let second = await openWorkspace();
		expect(first.root).not.toBe(second.root);
	});
});

describe("Workspace.resolve", () => {
	test("resolves relative paths against the root", async () => {
		let workspace = await openWorkspace();
		expect(unwrap(workspace.resolve("a/b.txt"))).toBe(join(workspace.root, "a/b.txt"));
		expect(unwrap(workspace.resolve("."))).toBe(workspace.root);
		expect(unwrap(workspace.resolve("deep/nested/new/file.txt"))).toBe(
			join(workspace.root, "deep/nested/new/file.txt"),
		);
	});

	test("allows traversal that stays inside the root", async () => {
		let workspace = await openWorkspace();
		expect(unwrap(workspace.resolve("a/../b.txt"))).toBe(join(workspace.root, "b.txt"));
	});

	test("refuses traversal out of the root", async () => {
		let workspace = await openWorkspace();
		let error = expectFailure(workspace.resolve("../escape.txt"));
		expect(error).toBeInstanceOf(WorkspaceEscapeError);
		expect(error.code).toBe("workspace-escape");
		if (error instanceof WorkspaceEscapeError) {
			expect(error.attemptedPath).toBe("../escape.txt");
		}
		expect(error.remedy).toBe("spec run --allow-host-fs=<directory>");
	});

	test("refuses traversal hidden behind an inside prefix", async () => {
		let workspace = await openWorkspace();
		let error = expectFailure(workspace.resolve("a/../../escape.txt"));
		expect(error).toBeInstanceOf(WorkspaceEscapeError);
	});

	test("delegates absolute paths to the host-fs permission, normalized", async () => {
		let seen: string[] = [];
		let denial = new PermissionDeniedError(
			"host-fs",
			"/etc/passwd",
			"spec run --allow-host-fs=/etc",
		);
		let workspace = await openWorkspace(
			stubPermissions({
				checkHostFs(path) {
					seen.push(path);
					return failure(denial);
				},
			}),
		);
		let error = expectFailure(workspace.resolve("/etc/nested/../passwd"));
		expect(error).toBe(denial);
		expect(seen).toEqual(["/etc/passwd"]);
	});

	test("admits absolute paths the permission set grants", async () => {
		let workspace = await openWorkspace();
		expect(unwrap(workspace.resolve("/opt//data/../data/file.txt"))).toBe("/opt/data/file.txt");
	});

	test("refuses resolution through a symlink that points outside", async () => {
		let workspace = await openWorkspace();
		let outside = makeOutsideDirectory();
		symlinkSync(outside, join(workspace.root, "link"));
		let throughLink = expectFailure(workspace.resolve("link/file.txt"));
		expect(throughLink).toBeInstanceOf(WorkspaceEscapeError);
		let linkItself = expectFailure(workspace.resolve("link"));
		expect(linkItself).toBeInstanceOf(WorkspaceEscapeError);
	});

	test("follows symlinks that stay inside the root", async () => {
		let workspace = await openWorkspace();
		mkdirSync(join(workspace.root, "real"));
		symlinkSync(join(workspace.root, "real"), join(workspace.root, "alias"));
		expect(unwrap(workspace.resolve("alias/file.txt"))).toBe(
			join(workspace.root, "alias/file.txt"),
		);
	});
});

describe("Workspace.cleanup", () => {
	test("removes the workspace and everything in it", async () => {
		let workspace = unwrap(await createWorkspace(stubPermissions()));
		mkdirSync(join(workspace.root, "nested"));
		await workspace.cleanup();
		expect(existsSync(workspace.root)).toBe(false);
	});

	test("is idempotent and never throws", async () => {
		let workspace = unwrap(await createWorkspace(stubPermissions()));
		await workspace.cleanup();
		await workspace.cleanup();
		expect(existsSync(workspace.root)).toBe(false);
	});
});
