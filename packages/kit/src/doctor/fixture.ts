/**
 * Fixture projects for the `sdxc doctor` check tests: a temporary directory holding the given
 * files and the context a check runs with, so each test states only the files its check reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { unwrap } from "@sdxc/result";

import { parseConfig } from "../config.js";
import { packageManager } from "../package-manager.js";

import type { DoctorContext } from "./check.js";

import { createDoctorContext } from "./check.js";

/** Every fixture directory created since the last {@link removeFixtures}. */
const CREATED: string[] = [];

/** What a fixture project is built from. */
export interface FixtureOptions {
	/** Further `.config/sdxc.jsonc` keys. */
	config?: Record<string, unknown>;
	/** The `@sdxc/kit` package the context compares copied components with. */
	packageRoot?: string;
	/** Seconds since the epoch to stamp on a file as its modification time, by path. */
	modified?: Record<string, number>;
}

/** A bun project holding `files`, keyed by path relative to its root, and its check context. */
export async function fixture(
	files: Record<string, string>,
	options: FixtureOptions = {},
): Promise<DoctorContext> {
	let root = await writeTree(files);
	for (let [path, seconds] of Object.entries(options.modified ?? {})) {
		await utimes(join(root, path), seconds, seconds);
	}
	let manifest = { packageManager: "bun@1.4.2" };
	return createDoctorContext({
		root,
		manifest,
		config: unwrap(parseConfig(options.config ?? {}, root, null)).config,
		manager: await packageManager({ declared: manifest.packageManager, findLockFile: () => null }),
		packageRoot: options.packageRoot ?? join(root, "node_modules/@sdxc/kit"),
	});
}

/** A temporary directory holding `files`, removed by {@link removeFixtures}. */
export async function writeTree(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-doctor-check-"));
	CREATED.push(root);
	for (let [path, content] of Object.entries({ "package.json": "{}", ...files })) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** Removes every fixture directory, for an `afterEach`. */
export async function removeFixtures(): Promise<void> {
	let created = CREATED.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
}
