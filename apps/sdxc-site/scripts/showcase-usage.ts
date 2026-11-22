/**
 * Reads what each showcase item is built from out of its own source: every `@sdxc/*` package
 * it imports, and every `@sdxc/ui` component, mixin or behavior it names, resolved to its
 * catalogue page. Plain functions over source text, so the extractor and its tests share them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One import statement's module and the names it brings in, aliases resolved to the export. */
export interface ImportRecord {
	specifier: string;
	names: string[];
}

/** A catalogue entry an imported name can resolve to. */
export interface CatalogueEntry {
	name: string;
	/** The page's path under `/api/ui`, such as `app-shell` or `mixins/carousel-controls`. */
	path: string;
	/** The namespace it is published under: `components` for the root, else `landing`, `app`… */
	module: string;
}

/** One `@sdxc/ui` export an item uses, with its catalogue page. */
export interface UsedComponent {
	name: string;
	path: string;
}

/** What one showcase item is built from. */
export interface ShowcaseUsage {
	/** Package names, such as `@sdxc/dates`, sorted. */
	packages: string[];
	/** Catalogue entries, sorted by name. */
	components: UsedComponent[];
}

/** Every `import … from`, `export … from`, side-effect import and dynamic import of a module. */
const STATIC_IMPORT = /^\s*(?:import|export)\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/gm;

/** A bare `import "…"`, which brings a stylesheet or a side effect and no names. */
const SIDE_EFFECT_IMPORT = /^\s*import\s+["']([^"']+)["']/gm;

/** An `import("…")` call, which loads a module on demand. */
const DYNAMIC_IMPORT = /import\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Lists a source file's imports. A type-only import brings nothing that runs, so it is left
 * out, and so is a `type` specifier inside a value import.
 *
 * @param source A TypeScript or TSX module's text.
 * @returns One record per import, in source order.
 */
export function readImports(source: string): ImportRecord[] {
	let records: ImportRecord[] = [];
	for (let match of source.matchAll(STATIC_IMPORT)) {
		let [, typeOnly, clause = "", specifier = ""] = match;
		if (typeOnly !== undefined) continue;
		let braces = clause.match(/\{([\s\S]*)\}/);
		let names =
			braces?.[1]
				?.split(",")
				.map((part) => part.trim())
				.filter((part) => part !== "" && !part.startsWith("type "))
				.map((part) => part.split(/\s+as\s+/)[0]?.trim() ?? "")
				.filter((name) => name !== "") ?? [];
		records.push({ specifier, names });
	}
	for (let match of source.matchAll(SIDE_EFFECT_IMPORT)) {
		records.push({ specifier: match[1] ?? "", names: [] });
	}
	for (let match of source.matchAll(DYNAMIC_IMPORT)) {
		records.push({ specifier: match[1] ?? "", names: [] });
	}
	return records;
}

/**
 * The package a specifier belongs to: `@sdxc/ui/landing` and `@sdxc/ui/theme.css` both name
 * `@sdxc/ui`.
 *
 * @returns The package name, or `null` for a module outside the `@sdxc` scope.
 */
export function packageOf(specifier: string): string | null {
	let match = specifier.match(/^@sdxc\/([^/]+)/);
	return match === null ? null : `@sdxc/${match[1]}`;
}

/**
 * The catalogue namespace an `@sdxc/ui` specifier imports from: `components` for the root and
 * for a root component's own entry (`@sdxc/ui/section-bar`), the namespace otherwise.
 */
function namespaceOf(specifier: string, namespaces: ReadonlySet<string>): string {
	let segment = specifier.split("/")[2];
	return segment !== undefined && namespaces.has(segment) ? segment : "components";
}

/**
 * Totals what a set of source files imports into one usage record. A name resolves to the
 * catalogue entry in the namespace it was imported from, and to the only entry of that name
 * when the namespace has none, so a type or helper the catalogue lacks drops out.
 *
 * @param sources Every source file the item is built from.
 * @param catalogue Every page under `/api/ui`.
 */
export function collectUsage(sources: string[], catalogue: CatalogueEntry[]): ShowcaseUsage {
	let namespaces = new Set(catalogue.map((entry) => entry.module));
	let packages = new Set<string>();
	let components = new Map<string, UsedComponent>();

	for (let source of sources) {
		for (let record of readImports(source)) {
			let name = packageOf(record.specifier);
			if (name === null) continue;
			packages.add(name);
			if (name !== "@sdxc/ui") continue;

			let namespace = namespaceOf(record.specifier, namespaces);
			for (let imported of record.names) {
				let matches = catalogue.filter((entry) => entry.name === imported);
				let entry = matches.find((match) => match.module === namespace) ?? matches[0];
				if (entry !== undefined && matches.length > 0) {
					components.set(entry.path, { name: entry.name, path: entry.path });
				}
			}
		}
	}

	return {
		packages: [...packages].sort(),
		components: [...components.values()].sort(
			(a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path),
		),
	};
}
