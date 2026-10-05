/**
 * The `@sdxc/ui` subpaths beside its components as the site reads them: every mixin,
 * behavior class, animation and style recipe, one page each, with the events, constants
 * and types its module publishes for it. Reading is a lookup into a document generated
 * at build time, loaded inside a request because global-scope work fails upload.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PropRow } from "~/app/services/components";
import type { UiSubpath } from "~/app/services/ui-subpaths";

const documents = import.meta.glob<UiExportDocument>("../generated/ui-exports.json", {
	import: "default",
});

/** One page of a subpath, named after the export it documents. */
export interface UiExportEntry {
	name: string;
	subpath: UiSubpath;
	/** The name in kebab case, which is the last segment of its URL. */
	slug: string;
}

/** A method of a behavior class, as one row of its methods table. */
export interface UiMethod {
	name: string;
	/** The call as written, parameters and return type included. */
	signature: string;
	description: string;
}

/**
 * One exported symbol. Which fields carry anything follows from its kind: a class has
 * members and methods, an interface members alone, a type alias its union's values.
 */
export interface UiSymbol {
	name: string;
	kind: "mixin" | "function" | "class" | "event" | "constant" | "interface" | "type";
	description: string;
	/** How it is called, constructed or declared; `null` for an interface. */
	signature: string | null;
	parameters: PropRow[];
	/** What the `@returns` tag says the result is for. */
	returns: string;
	examples: string[];
	/** Properties of a class or an event, or the members of an interface. */
	members: PropRow[];
	methods: UiMethod[];
	/** The string members of a type alias that is a union of them. */
	values: string[];
}

/** One page: the export it is named after, then what its module publishes with it. */
export interface UiExportReference {
	name: string;
	subpath: UiSubpath;
	slug: string;
	/**
	 * What the export is, in one sentence: its module's opening when the module publishes
	 * it alone, which states the pattern, or the export's own description otherwise.
	 */
	summary: string;
	symbol: UiSymbol;
	/** The events, constants, helpers and types the export is used together with. */
	companions: UiSymbol[];
}

/** The generated document: each subpath's entries, and one reference per page. */
export interface UiExportDocument {
	entries: Record<UiSubpath, UiExportEntry[]>;
	/** Keyed by `<subpath>/<slug>`. */
	references: Record<string, UiExportReference>;
}

/** Every page of one subpath, alphabetically, which is how the sidebar lists them. */
export async function listUiExports(subpath: UiSubpath): Promise<UiExportEntry[]> {
	return (await readDocument()).entries[subpath];
}

/**
 * One page's reference.
 *
 * @param subpath - The subpath the URL names.
 * @param slug - The export's name in kebab case, as the URL carries it.
 * @returns The page's content, or `null` when the subpath publishes no such export.
 */
export async function readUiExport(
	subpath: UiSubpath,
	slug: string,
): Promise<UiExportReference | null> {
	return (await readDocument()).references[`${subpath}/${slug}`] ?? null;
}

/** The generated document, read on the first call of a request that needs it. */
async function readDocument(): Promise<UiExportDocument> {
	let load = Object.values(documents)[0];
	if (!load) throw new Error("The @sdxc/ui exports document is missing from the bundle");
	return await load();
}
