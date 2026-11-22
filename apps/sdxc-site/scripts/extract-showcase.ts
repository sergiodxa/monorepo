/**
 * Writes `resources/generated/showcase-usage.json`: for every showcase item, the `@sdxc/*`
 * packages and `@sdxc/ui` catalogue entries its own source imports. Run after the catalogue
 * extractor, whose documents name every page an import can resolve to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CatalogueEntry, ShowcaseUsage } from "~/scripts/showcase-usage";

import { APPLICATIONS } from "~/resources/content/apps";
import { collectUsage, readImports } from "~/scripts/showcase-usage";

/** The app's own root, which every path below is resolved against. */
const APP = dirname(dirname(fileURLToPath(import.meta.url)));

/** Where the document is written, and where the site reads it from. */
const OUTPUT = join(APP, "resources", "generated", "showcase-usage.json");

/**
 * The folders holding each kind of demo, one subfolder per demo named by its slug, with the
 * shared files that draw every demo of that kind around its own: a docs site's shell, pages
 * and feedback, and an app's document.
 */
const DEMO_ROOTS: Array<{ folder: string; shared: string[] }> = [
	{ folder: "demos", shared: [] },
	{ folder: "demo-docs", shared: ["shell.tsx", "pages.tsx", "feedback.tsx"] },
	{ folder: "demo-apps", shared: ["document.tsx"] },
].map(({ folder, shared }) => {
	let root = join(APP, "resources", "views", folder);
	return { folder: root, shared: shared.map((file) => join(root, file)) };
});

/** The folders of an application that hold the code it ships. */
const APPLICATION_FOLDERS = ["app", "bootstrap", "config", "database", "resources", "routes"];

/**
 * The site's own folders a demo's imports are followed into: the shared shells and parts a
 * demo is drawn with. Services and routes are the site's plumbing, so they are left out.
 */
const FOLLOWED = ["resources/views", "resources/components"].map((path) => join(APP, path));

main();

/** Reads the catalogue, walks every item's source and writes the document. */
function main(): void {
	let catalogue = readCatalogue();
	let usage: Record<string, ShowcaseUsage> = {};

	for (let application of APPLICATIONS) {
		let root = join(APP, "..", application.directory);
		let files = APPLICATION_FOLDERS.flatMap((folder) => listSources(join(root, folder)));
		usage[application.directory] = collectUsage(files.map(read), catalogue);
	}

	for (let root of DEMO_ROOTS) {
		for (let slug of readdirSync(root.folder)) {
			let folder = join(root.folder, slug);
			if (!statSync(folder).isDirectory() || !existsSync(join(folder, "index.tsx"))) continue;
			let files = followImports([...listSources(folder), ...root.shared]);
			usage[slug] = collectUsage([...files].map(read), catalogue);
		}
	}

	mkdirSync(dirname(OUTPUT), { recursive: true });
	writeFileSync(OUTPUT, `${JSON.stringify({ usage }, null, "\t")}\n`);
}

/** Every page under `/api/ui`, from the documents the catalogue extractor wrote. */
function readCatalogue(): CatalogueEntry[] {
	let generated = join(APP, "resources", "generated");
	let components = JSON.parse(read(join(generated, "components.json"))) as {
		entries: Array<{ name: string; slug: string; module: string }>;
	};
	let exports = JSON.parse(read(join(generated, "ui-exports.json"))) as {
		entries: Record<
			string,
			Array<{ name: string; subpath: string; slug: string; namespace?: string }>
		>;
	};
	return [
		...components.entries.map((entry) => ({
			name: entry.name,
			path: entry.slug,
			module: entry.module,
		})),
		...Object.values(exports.entries)
			.flat()
			.map((entry) => ({
				name: entry.name,
				path: `${entry.subpath}/${entry.slug}`,
				module: entry.namespace ?? "components",
			})),
	];
}

/** Every TypeScript module under a folder, tests left out, since they ship nothing. */
function listSources(folder: string): string[] {
	if (!existsSync(folder)) return [];
	return readdirSync(folder, { recursive: true, encoding: "utf8" })
		.filter(
			(path) =>
				/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.includes("node_modules"),
		)
		.map((path) => join(folder, path));
}

/**
 * The files a demo is drawn from: its own folder, plus every shared shell or part those files
 * import from the site, followed until nothing new turns up.
 */
function followImports(start: string[]): Set<string> {
	let seen = new Set(start);
	let queue = [...start];
	while (queue.length > 0) {
		let file = queue.pop();
		if (file === undefined) break;
		for (let record of readImports(read(file))) {
			let target = resolveImport(file, record.specifier);
			if (target === null || seen.has(target)) continue;
			seen.add(target);
			queue.push(target);
		}
	}
	return seen;
}

/** The site file an import names, when it is one a demo is drawn with. */
function resolveImport(from: string, specifier: string): string | null {
	let base: string | null = null;
	if (specifier.startsWith("~/")) base = join(APP, specifier.slice(2));
	else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
	if (base === null || !FOLLOWED.some((folder) => base.startsWith(folder))) return null;
	for (let candidate of [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		join(base, "index.ts"),
		join(base, "index.tsx"),
	]) {
		if (/\.tsx?$/.test(candidate) && existsSync(candidate) && statSync(candidate).isFile()) {
			return candidate;
		}
	}
	return null;
}

/** A file's text. */
function read(path: string): string {
	return readFileSync(path, "utf8");
}
