/**
 * Writes the catalogue documents the site reads. It walks the two catalogue packages
 * on disk, extracts every utility and component, and emits one JSON file per
 * catalogue under `app/generated`. Run it before a build, or on its own after
 * changing either package; the output is committed, so a fresh checkout serves the
 * catalogues without running anything first.
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
import type { UtilityDocument, UtilityFamily, UtilityReference } from "~/app/services/utilities";

import {
	collectTheme,
	collectUsage,
	componentName,
	readBarrel,
	readComponent,
	readUtility,
} from "~/scripts/catalogue";

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

	write("utilities.json", utilities);
	write("components.json", components);
	write("theme.json", theme);

	let utilityCount = Object.keys(utilities.references).length;
	let componentCount = Object.keys(components.references).length;
	console.log(`@sdxc/u: ${utilityCount} utilities across ${utilities.families.length} families`);
	console.log(`@sdxc/ui: ${componentCount} components, ${theme.light.length} theme variables`);
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
