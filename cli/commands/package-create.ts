/**
 * `package create`: writes the six minimum files for a new `@sdxc/<name>` package, adds the
 * root README table row and the sdxc-site docs group entry, and prints the operator steps that
 * remain (release bootstrap, trusted publisher).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createCommand, exit, success, usage } from "@sdxc/cli";
import { failure, isFailure, success as ok, wrap } from "@sdxc/result";

import { REPO_ROOT } from "../../scripts/release/workspace.js";

import commandset from "./index.js";

/** Kebab-case package directory / `@sdxc/` suffix. */
const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Creates the package skeleton and wires the docs surfaces that enforce it. */
export default createCommand(commandset.package.create, async (ctx) => {
	let name = ctx.arguments.name.trim();
	if (!NAME.test(name)) {
		return usage(`"${name}" is not a kebab-case package name`);
	}
	let description = ctx.flags.description?.trim();
	if (description === undefined || description === "") {
		return usage("Pass --description with the one-line package summary");
	}
	let planned = await planPackage(name, description);
	if (isFailure(planned)) return exit(1, planned.error.message);
	if (ctx.flags.dryRun) {
		for (let file of planned.data.files) {
			ctx.stdout(`would write ${file.path}\n`);
		}
		for (let edit of planned.data.edits) {
			ctx.stdout(`would edit ${edit.path}\n`);
		}
		return success();
	}
	if (planned.data.exists && !ctx.flags.force) {
		return exit(1, `packages/${name} already exists; pass --force to replace it`);
	}
	for (let file of planned.data.files) {
		await mkdir(join(REPO_ROOT, dirnameOf(file.path)), { recursive: true });
		await writeFile(join(REPO_ROOT, file.path), file.content);
		ctx.stdout(`wrote ${file.path}\n`);
	}
	for (let edit of planned.data.edits) {
		await writeFile(join(REPO_ROOT, edit.path), edit.after);
		ctx.stdout(`edited ${edit.path}\n`);
	}
	ctx.stdout(
		[
			"",
			`Docs site: ungrouped packages appear under "Everything else"; move @sdxc/${name}`,
			"into apps/sdxc-site/resources/content/groups.ts when it belongs in a named group.",
			"",
			"Next (operator only):",
			`  bun install`,
			`  bun run release:bootstrap @sdxc/${name}`,
			`  Configure the trusted publisher on npmjs.com for @sdxc/${name}`,
			`  vp test run packages/${name}`,
			`  bun check`,
			"",
		].join("\n"),
	);
	return success();
});

/** One new file relative to the repo root. */
interface PlannedFile {
	path: string;
	content: string;
}

/** One text edit relative to the repo root. */
interface PlannedEdit {
	path: string;
	after: string;
}

/** What `package create` would write. */
interface PackagePlan {
	exists: boolean;
	files: PlannedFile[];
	edits: PlannedEdit[];
}

/** Plans the six package files plus README and groups.ts edits. */
async function planPackage(name: string, description: string) {
	let dir = `packages/${name}`;
	let packageJson = join(REPO_ROOT, dir, "package.json");
	let existing = await wrap(() => readFile(packageJson, "utf8"));
	let exists = !isFailure(existing);
	let license = await wrap(() => readFile(join(REPO_ROOT, "packages/result/LICENSE.md"), "utf8"));
	if (isFailure(license)) return license;
	let files: PlannedFile[] = [
		{
			path: `${dir}/package.json`,
			content: `${JSON.stringify(
				{
					name: `@sdxc/${name}`,
					version: "0.0.1",
					description,
					license: "MIT",
					type: "module",
					exports: { ".": "./src/index.ts" },
					scripts: { typecheck: "tsc --noEmit" },
				},
				null,
				"\t",
			)}\n`,
		},
		{
			path: `${dir}/tsconfig.json`,
			content: `${JSON.stringify(
				{ extends: "../../tsconfig.json", include: ["src/**/*"] },
				null,
				"\t",
			)}\n`,
		},
		{
			path: `${dir}/src/index.ts`,
			content: indexSource(name, description),
		},
		{
			path: `${dir}/src/index.test.ts`,
			content: testSource(name),
		},
		{
			path: `${dir}/README.md`,
			content: readmeSource(name, description),
		},
		{
			path: `${dir}/LICENSE.md`,
			content: license.data,
		},
	];
	let readme = await wrap(() => readFile(join(REPO_ROOT, "README.md"), "utf8"));
	if (isFailure(readme)) return readme;
	let readmeAfter = insertReadmeRow(readme.data, name, description);
	if (isFailure(readmeAfter)) return readmeAfter;
	return ok({
		exists,
		files,
		edits: [{ path: "README.md", after: readmeAfter.data }],
	} satisfies PackagePlan);
}

/** Parent directory of a relative path. */
function dirnameOf(path: string): string {
	let slash = path.lastIndexOf("/");
	return slash === -1 ? "." : path.slice(0, slash);
}

/** The package's `src/index.ts` stub. */
function indexSource(name: string, description: string): string {
	let pascal = name
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
	return `/**
 * ${description}
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Placeholder export so the package resolves; replace it with the public surface.
 */
export function ${camel(name)}(): string {
	return "${pascal}";
}
`;
}

/** The colocated Vitest file. */
function testSource(name: string): string {
	let fn = camel(name);
	return `/**
 * Tests for the package's public surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { ${fn} } from "./index.js";

describe(${fn}, () => {
	test("returns a non-empty string", () => {
		expect(${fn}().length).toBeGreaterThan(0);
	});
});
`;
}

/** A minimal README that matches the package documentation guide's sections. */
function readmeSource(name: string, description: string): string {
	return `# @sdxc/${name}

${description}

## Installation

\`\`\`sh
bun add @sdxc/${name}
\`\`\`

## Usage

\`\`\`ts
import { ${camel(name)} } from "@sdxc/${name}";

${camel(name)}();
\`\`\`

## API

See the JSDoc on each export.

## Versioning

Published with the daily \`@sdxc/*\` release. Pin an exact dated version.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
`;
}

/** Inserts a row into the root README's "Everything else" / result-adjacent table. */
function insertReadmeRow(source: string, name: string, description: string) {
	let marker = "| [@sdxc/result](packages/result)";
	let index = source.indexOf(marker);
	if (index === -1) {
		return failure(new Error("README.md has no @sdxc/result row to place the new package beside"));
	}
	if (source.includes(`[@sdxc/${name}](packages/${name})`)) {
		return ok(source);
	}
	let row = `| [@sdxc/${name}](packages/${name})${" ".repeat(Math.max(1, 43 - name.length - 18))}| ${description}${" ".repeat(Math.max(1, 70 - description.length))} |\n`;
	return ok(source.slice(0, index) + row + source.slice(index));
}

/** `kebab-case` → `camelCase`. */
function camel(name: string): string {
	let [first = "", ...rest] = name.split("-");
	return first + rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}
