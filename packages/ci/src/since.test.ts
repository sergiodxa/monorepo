/**
 * Tests for `--since`: mapping a git diff onto workspace paths, and falling back to every
 * entry when a changed file sits outside every workspace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { isSuccess } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { scopeSince } from "./since.js";
import { createRepo, gitIn, removeRepos, writeFiles } from "./test-repo.js";

afterEach(removeRepos);

/** A tiny monorepo with one package and one app that depends on it. */
const MONOREPO = {
	"package.json": JSON.stringify({
		workspaces: ["apps/*", "packages/*"],
	}),
	"packages/ui/package.json": JSON.stringify({ name: "@acme/ui" }),
	"packages/ui/src/index.ts": "export {}",
	"apps/blog/package.json": JSON.stringify({
		name: "blog",
		dependencies: { "@acme/ui": "workspace:*" },
	}),
	"apps/blog/src/index.ts": "export {}",
};

describe("scopeSince", () => {
	test("maps changed workspace files onto those workspaces", async () => {
		let root = await createRepo(MONOREPO);
		gitIn(root, "checkout", "-b", "topic");
		await writeFiles(root, { "packages/ui/src/index.ts": "export const x = 1;" });
		gitIn(root, "add", "-A");
		gitIn(root, "commit", "--quiet", "--no-verify", "-m", "Change ui");
		let scoped = await scopeSince(root, "main");
		expect(isSuccess(scoped)).toBe(true);
		if (!isSuccess(scoped)) return;
		expect(scoped.data).toMatchObject({
			scope: ["packages/ui"],
			fallback: null,
		});
	});

	test("includes uncommitted changes", async () => {
		let root = await createRepo(MONOREPO);
		await writeFile(join(root, "apps/blog/src/index.ts"), "export const y = 2;");
		let scoped = await scopeSince(root, "HEAD");
		expect(isSuccess(scoped)).toBe(true);
		if (!isSuccess(scoped)) return;
		expect(scoped.data.scope).toEqual(["apps/blog"]);
	});

	test("falls back to every entry when a root file changes", async () => {
		let root = await createRepo(MONOREPO);
		await writeFile(join(root, "package.json"), JSON.stringify({ workspaces: ["apps/*"] }));
		let scoped = await scopeSince(root, "HEAD");
		expect(isSuccess(scoped)).toBe(true);
		if (!isSuccess(scoped)) return;
		expect(scoped.data.scope).toBeNull();
		expect(scoped.data.fallback).toBe("package.json");
	});
});
