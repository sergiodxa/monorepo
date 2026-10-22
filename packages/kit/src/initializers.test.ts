/**
 * How `sdxc initializers` reads an initializer's exports and the factories that build them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vite-plus/test";

import { exportedNames, formatInitializers, listInitializers } from "./initializers.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	await Promise.all(DIRECTORIES.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("exportedNames", () => {
	test("reads declarations, a default export and an export list in source order", () => {
		let source = [
			"export const logger = createLogger();",
			"export function createWebRouter() {}",
			"let a = 1;",
			"export { a as alias };",
			"export default handler;",
		].join("\n");

		expect(exportedNames(source)).toEqual(["logger", "createWebRouter", "alias", "default"]);
	});
});

describe("listInitializers", () => {
	test("names the package factories each initializer calls, tests left out", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-initializers-"));
		DIRECTORIES.push(root);
		await mkdir(join(root, "app/initializers"), { recursive: true });
		await writeFile(
			join(root, "app/initializers/logger.ts"),
			[
				'import { createHash } from "node:crypto";',
				'import { createLogger } from "@sdxc/logger";',
				'import { openDatabase } from "~/app/initializers/database";',
				'import { createUnused } from "@sdxc/unused";',
				"",
				"export const logger = createLogger({ id: createHash('sha1'), db: openDatabase() });",
				"",
			].join("\n"),
		);
		await writeFile(join(root, "app/initializers/logger.test.ts"), "export {};\n");

		let initializers = await listInitializers(root);

		expect(initializers).toEqual([
			{
				file: "app/initializers/logger.ts",
				exports: ["logger"],
				factories: [{ name: "createLogger", from: "@sdxc/logger" }],
			},
		]);
		expect(formatInitializers(initializers)).toContain(
			"app/initializers/logger.ts  logger   createLogger (@sdxc/logger)",
		);
	});
});
