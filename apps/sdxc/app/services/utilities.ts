/**
 * The `@sdxc/u` catalogue as the site reads it: every utility the package publishes,
 * and the reference one page draws. Reading is a lookup — the source was parsed once
 * when the document was generated, so a page costs a key rather than a parse, and the
 * parser stays out of the bundle entirely. The document loads inside a request,
 * because work in the worker's global scope fails upload validation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const documents = import.meta.glob<UtilityDocument>("../generated/utilities.json", {
	import: "default",
});

/** One value export of a family barrel, which is one utility and one page. */
export interface UtilityEntry {
	/** The exported function name, which is also the last segment of its URL. */
	name: string;
	/** The subpath it is imported from, e.g. `size` for `@sdxc/u/size`. */
	family: string;
	/** File the family barrel forwards it from, without its extension. */
	module: string;
}

/** A family of utilities, alphabetically, which is how a reader scans one. */
export interface UtilityFamily {
	name: string;
	utilities: UtilityEntry[];
}

/**
 * One row of the quick-reference table: the call a reader writes, and the CSS it
 * emits. A composition utility takes other mixins rather than emitting declarations
 * of its own, so it arrives with no output half and renders as a plain snippet.
 */
export interface UtilityExample {
	call: string;
	output: string | null;
}

/** A documentation link the source carries, so the page links what MDN calls it. */
export interface UtilityLink {
	label: string;
	href: string;
}

/** One utility's page, everything on it read from the source it documents. */
export interface UtilityReference {
	name: string;
	family: string;
	/** What the page is titled: the CSS property it sets, or its own name. */
	property: string;
	/** The whole JSDoc summary, as written. */
	description: string;
	/** The first sentence of the summary, which is what a listing shows. */
	summary: string;
	/** How the function is called, with the parameters it declares. */
	signature: string;
	examples: UtilityExample[];
	see: UtilityLink[];
	/** The `--ui-*` custom properties the implementation reads. */
	tokens: string[];
}

/** The generated document: the tree's order, and one reference per utility. */
export interface UtilityDocument {
	families: UtilityFamily[];
	references: Record<string, UtilityReference>;
}

/** Every family, each holding the utilities its barrel publishes. */
export async function listUtilityFamilies(): Promise<UtilityFamily[]> {
	return (await readDocument()).families;
}

/** The catalogue entry a URL segment names, or `null` when no family publishes it. */
export async function findUtility(name: string): Promise<UtilityEntry | null> {
	for (let family of await listUtilityFamilies()) {
		let entry = family.utilities.find((utility) => utility.name === name);
		if (entry) return entry;
	}

	return null;
}

/**
 * One utility's reference.
 *
 * @param name - The utility's exported name, as the URL carries it.
 * @returns The page's content, or `null` when the catalogue publishes no such name.
 */
export async function readUtility(name: string): Promise<UtilityReference | null> {
	return (await readDocument()).references[name] ?? null;
}

/** The generated document, read on the first call of a request that needs it. */
async function readDocument(): Promise<UtilityDocument> {
	let load = Object.values(documents)[0];
	if (!load) throw new Error("The @sdxc/u catalogue document is missing from the bundle");
	return await load();
}
