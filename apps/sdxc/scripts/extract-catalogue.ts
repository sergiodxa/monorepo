/**
 * Writes the catalogue documents the site reads. It walks the two catalogue packages
 * on disk, extracts every utility and component, and emits one JSON file per
 * catalogue under `app/generated`, plus the totals the landing copy quotes. `dev`, `build` and the test run each start by
 * running it, so the site and its tests always read the packages as they are now.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
	ComponentDocument,
	ComponentEntry,
	ComponentReference,
} from "~/app/services/components";
import type { ThemeReference } from "~/app/services/theming";
import type { UiExportDocument, UiExportReference } from "~/app/services/ui-exports";
import type { UtilityDocument, UtilityFamily, UtilityReference } from "~/app/services/utilities";

import { UI_SUBPATHS } from "~/app/services/ui-subpaths";
import {
	collectTheme,
	collectUsage,
	componentName,
	readBarrel,
	readComponent,
	readUtility,
} from "~/scripts/catalogue";
import { readUiModule } from "~/scripts/ui-exports";

/** The app's own root, which every path below is resolved against. */
const APP = dirname(dirname(fileURLToPath(import.meta.url)));

/** Where the two catalogue packages live relative to the app. */
const PACKAGES = join(APP, "..", "..", "packages");

/** Where the documents are written, and where the services read them from. */
const OUTPUT = join(APP, "app", "generated");

/**
 * The modules declaring types several components share. They are listed rather than
 * globbed because each one only earns its place by letting a props table print a
 * union's members instead of its name.
 */
const SHARED_TYPE_MODULES = ["semantic-color.ts", "placement.ts"];

/** A directory under `packages/u/src` that holds no family of its own. */
const NOT_A_FAMILY = new Set(["internal"]);

main();

/** Reads both catalogues and writes their documents. */
function main(): void {
	mkdirSync(OUTPUT, { recursive: true });

	let utilities = buildUtilities();
	let components = buildComponents();
	let theme = buildTheme();
	let exports = buildUiExports();

	let utilityCount = Object.keys(utilities.references).length;
	let componentCount = Object.keys(components.references).length;

	write("utilities.json", utilities);
	write("components.json", components);
	write("theme.json", theme);
	write("ui-exports.json", exports);
	write("counts.json", {
		utilities: utilityCount,
		components: componentCount,
		rfcs: countPublishedRfcs(),
	});

	console.log(`@sdxc/u: ${utilityCount} utilities across ${utilities.families.length} families`);
	console.log(`@sdxc/ui: ${componentCount} components, ${theme.light.length} theme variables`);
	console.log(
		`@sdxc/ui: ${UI_SUBPATHS.map((subpath) => `${exports.entries[subpath].length} ${subpath}`).join(", ")}`,
	);
}

/** Every utility, under the family whose barrel publishes it. */
function buildUtilities(): UtilityDocument {
	let root = join(PACKAGES, "u", "src");
	let families: UtilityFamily[] = [];
	let references: Record<string, UtilityReference> = {};

	for (let family of directories(root).filter((name) => !NOT_A_FAMILY.has(name))) {
		let barrel = read(join(root, family, "index.ts"));
		if (barrel === null) continue;

		let utilities = readBarrel(barrel, family).sort((a, b) => a.name.localeCompare(b.name));
		if (utilities.length === 0) continue;

		for (let entry of utilities) {
			let source = read(join(root, family, `${entry.module}.ts`));
			let reference = source === null ? null : readUtility(source, entry);
			if (reference === null) throw new Error(`@sdxc/u: could not read ${family}/${entry.name}`);
			references[entry.name] = reference;
		}

		families.push({ name: family, utilities });
	}

	return { families: families.sort((a, b) => a.name.localeCompare(b.name)), references };
}

/** Every component, alphabetically, which is the order the tree lists them in. */
function buildComponents(): ComponentDocument {
	let root = join(PACKAGES, "ui", "src", "components");
	let shared = SHARED_TYPE_MODULES.flatMap((name) => {
		let source = read(join(PACKAGES, "ui", "src", "utils", name));
		return source === null ? [] : [source];
	});

	let entries: ComponentEntry[] = [];
	let references: Record<string, ComponentReference> = {};

	for (let file of componentFiles(root)) {
		let slug = file.replace(/\.tsx$/, "");
		let source = read(join(root, file));
		let reference = source === null ? null : readComponent(source, slug, shared);
		if (reference === null) throw new Error(`@sdxc/ui: could not read ${file}`);

		entries.push({ name: reference.name, slug });
		references[slug] = reference;
	}

	return { entries: entries.sort((a, b) => a.name.localeCompare(b.name)), references };
}

/**
 * Every page of the subpaths beside the components, each read from the modules its
 * barrel forwards. Two exports of one subpath that would share a URL fail the run,
 * since one of them would otherwise never be reachable.
 */
function buildUiExports(): UiExportDocument {
	let shared = SHARED_TYPE_MODULES.flatMap((name) => {
		let source = read(join(PACKAGES, "ui", "src", "utils", name));
		return source === null ? [] : [source];
	});

	let document: UiExportDocument = {
		entries: { mixins: [], behaviors: [], animations: [], styles: [] },
		references: {},
	};

	for (let subpath of UI_SUBPATHS) {
		let root = join(PACKAGES, "ui", "src", subpath);
		let barrel = read(join(root, "index.ts")) ?? "";
		let pages: UiExportReference[] = [];

		for (let match of barrel.matchAll(/^export \* from "\.\/([^"]+)\.js";$/gm)) {
			let file = `${match[1]}.ts`;
			let source = read(join(root, file));
			let modulePages =
				source === null ? null : readUiModule(source, subpath, match[1] as string, shared);
			if (modulePages === null) throw new Error(`@sdxc/ui: could not read ${subpath}/${file}`);
			pages.push(...modulePages);
		}

		for (let page of pages.sort((a, b) => a.name.localeCompare(b.name))) {
			let key = `${subpath}/${page.slug}`;
			if (document.references[key]) throw new Error(`@sdxc/ui: two exports answer ${key}`);
			document.references[key] = page;
			document.entries[subpath].push({ name: page.name, subpath, slug: page.slug });
		}
	}

	return document;
}

/** The theme contract, and which components read each of its variables. */
function buildTheme(): ThemeReference {
	let root = join(PACKAGES, "ui", "src", "components");
	let stylesheets = [
		join(PACKAGES, "u", "src", "theme.css"),
		join(PACKAGES, "ui", "src", "theme.css"),
	]
		.map((path) => read(path))
		.filter((source): source is string => source !== null);

	let sources = componentFiles(root).flatMap((file) => {
		let source = read(join(root, file));
		return source === null || componentName(source) === null ? [] : [source];
	});

	return collectTheme(stylesheets, collectUsage(sources));
}

/** Every component module in the catalogue, tests left out. */
function componentFiles(root: string): string[] {
	return readdirSync(root)
		.filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
		.sort();
}

/**
 * How many distinct RFCs the published packages' READMEs name, which is the count of
 * standards the collection implements or follows. A private package is left out, since
 * the copy quoting the number is about what a reader can install.
 */
function countPublishedRfcs(): number {
	let rfcs = new Set<string>();

	for (let name of directories(PACKAGES)) {
		let manifest = read(join(PACKAGES, name, "package.json"));
		if (manifest === null || (JSON.parse(manifest) as { private?: boolean }).private) continue;

		let readme = read(join(PACKAGES, name, "README.md")) ?? "";
		for (let match of readme.matchAll(/RFC ?(\d{3,5})/g)) rfcs.add(match[1] ?? "");
	}

	return rfcs.size;
}

/** The directories directly under one path. */
function directories(root: string): string[] {
	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

/** One file's text, or `null` when nothing is there to read. */
function read(path: string): string | null {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return null;
	}
}

/** One document, written with a trailing newline so the file reads like the rest. */
function write(name: string, document: unknown): void {
	writeFileSync(join(OUTPUT, name), `${JSON.stringify(document)}\n`);
}
