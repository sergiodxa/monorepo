/**
 * The app-wide import rewrite over fixture sources: replacing `@sdxc/ui/<name>`, splitting the
 * `@sdxc/ui` barrel by the names a copy exports, reporting what cannot be split, and pointing
 * imports back at the package with the names folded into an existing `@sdxc/ui` import.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import type { CopyLayout } from "./layout.js";

import { pointAtCopies, pointBack, projectSources } from "./imports.js";

const ALIASED: CopyLayout = {
	directory: "resources/components/ui",
	alias: "~/components/ui",
	extension: "",
};

const RELATIVE: CopyLayout = {
	directory: "resources/components/ui",
	alias: null,
	extension: ".js",
};

const BUTTON = { name: "button", exports: ["Button"] };

const DIALOG = { name: "dialog", exports: ["Dialog"] };

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("pointAtCopies", () => {
	test("replaces a component subpath and splits the barrel by the names the copy exports", () => {
		let source = [
			'import { Button, type Button as B, Tabs } from "@sdxc/ui";',
			'import { Dialog } from "@sdxc/ui/dialog";',
			'export { Button as Action } from "@sdxc/ui";',
			"",
		].join("\n");

		let rewritten = unwrap(pointAtCopies("app/page.tsx", source, [BUTTON, DIALOG], ALIASED));

		expect(rewritten).toEqual({
			source: [
				'import { Tabs } from "@sdxc/ui";',
				'import { Button, type Button as B } from "~/components/ui/button";',
				'import { Dialog } from "~/components/ui/dialog";',
				'export { Button as Action } from "~/components/ui/button";',
				"",
			].join("\n"),
			unhandled: [],
		});
	});

	test("imports relatively, with the configured extension, inside and outside the folder", () => {
		let source = 'import { Button } from "@sdxc/ui/button";\n';

		let sibling = unwrap(
			pointAtCopies("resources/components/ui/dialog.tsx", source, [BUTTON], RELATIVE),
		);
		let page = unwrap(pointAtCopies("app/routes/home.tsx", source, [BUTTON], RELATIVE));

		expect(sibling.source).toBe('import { Button } from "./button.js";\n');
		expect(page.source).toBe('import { Button } from "../../resources/components/ui/button.js";\n');
	});

	test("reports a namespace import of the barrel with its line and leaves it as it is", () => {
		let source = ["// page", 'import * as UI from "@sdxc/ui";', "UI.Button;", ""].join("\n");

		let rewritten = unwrap(pointAtCopies("app/page.tsx", source, [BUTTON], ALIASED));

		expect(rewritten).toEqual({ source, unhandled: ["app/page.tsx:2"] });
	});
});

describe("pointBack", () => {
	test("folds a copy's names into the file's @sdxc/ui import", () => {
		let source = [
			'import { Tabs } from "@sdxc/ui";',
			'import { Button } from "~/components/ui/button";',
			"",
		].join("\n");

		let rewritten = unwrap(pointBack("app/page.tsx", source, [BUTTON], ALIASED));

		expect(rewritten).toBe('import { Tabs, Button } from "@sdxc/ui";\n');
	});

	test("points the import at @sdxc/ui/<name> when the file has no @sdxc/ui import", () => {
		let source = [
			'import { Button } from "./button.js";',
			'let lazy = import("./button");',
			"",
		].join("\n");

		let rewritten = unwrap(
			pointBack("resources/components/ui/dialog.tsx", source, [BUTTON], RELATIVE),
		);

		expect(rewritten).toBe(
			[
				'import { Button } from "@sdxc/ui/button";',
				'let lazy = import("@sdxc/ui/button");',
				"",
			].join("\n"),
		);
	});
});

describe("projectSources", () => {
	test("lists source files outside installed packages and build output", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-ui-imports-"));
		PROJECTS.push(root);
		let files = [
			"app/page.tsx",
			"app/data.json",
			"bootstrap/worker.ts",
			"node_modules/@sdxc/ui/index.js",
			"dist/worker.js",
			"vite.config.mjs",
		];
		for (let file of files) {
			await mkdir(join(root, file, ".."), { recursive: true });
			await writeFile(join(root, file), "");
		}

		expect(unwrap(await projectSources(root))).toEqual([
			"app/page.tsx",
			"bootstrap/worker.ts",
			"vite.config.mjs",
		]);
	});
});
