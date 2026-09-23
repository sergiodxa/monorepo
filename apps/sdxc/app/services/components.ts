/**
 * The `@sdxc/ui` catalogue as the site reads it: every component the package
 * publishes, and the reference one page draws. Reading is a lookup — each module's
 * namespace and its compound parts were read once when the document was generated —
 * so a page costs a key rather than a parse. The document loads inside a request,
 * because work in the worker's global scope fails upload validation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const documents = import.meta.glob<ComponentDocument>("../generated/components.json", {
	import: "default",
});

/** One component of the catalogue, which is one page. */
export interface ComponentEntry {
	/** The exported component name, as it is imported and written in JSX. */
	name: string;
	/** The module's file name, which is also the last segment of its URL. */
	slug: string;
}

/** One row of a props table. */
export interface PropRow {
	name: string;
	/** The annotation as written, which is what a caller has to satisfy. */
	type: string;
	description: string;
	optional: boolean;
	/** Members of the union the type resolves to, when it resolves to one. */
	values: string[];
}

/** One prop interface: what it declares of its own, and what it inherits. */
export interface PropsTable {
	rows: PropRow[];
	/** Type text of each `extends` clause entry, which is where the rest comes from. */
	inherits: string[];
}

/** One compound part, as the composition tree draws it. */
export interface ComponentPart {
	/** Written as it is used, e.g. `Badge.Icon`. */
	name: string;
	description: string;
	props: PropsTable;
}

/** A named union the props refer to, listed so a reader sees what may be passed. */
export interface ComponentType {
	name: string;
	description: string;
	values: string[];
}

/** One component's page, everything on it read from the source it documents. */
export interface ComponentReference {
	name: string;
	slug: string;
	/** What the pattern is, which the module's own comment opens with. */
	definition: string;
	/** The first sentence of that definition, which is what a listing shows. */
	summary: string;
	/** How the host renders, which the component's own comment describes. */
	description: string;
	/** Each `@example` on the component, as written. */
	examples: string[];
	props: PropsTable;
	parts: ComponentPart[];
	types: ComponentType[];
	/** Other components the same module publishes, such as a group wrapping the first. */
	related: ComponentEntry[];
}

/** The generated document: the tree's order, and one reference per component. */
export interface ComponentDocument {
	entries: ComponentEntry[];
	references: Record<string, ComponentReference>;
}

/** Every component, alphabetically, which is how the tree and the index list them. */
export async function listComponents(): Promise<ComponentEntry[]> {
	return (await readDocument()).entries;
}

/**
 * One component's reference.
 *
 * @param slug - The module's file name, as the URL carries it.
 * @returns The page's content, or `null` when the catalogue publishes no such slug.
 */
export async function readComponent(slug: string): Promise<ComponentReference | null> {
	return (await readDocument()).references[slug] ?? null;
}

/** The generated document, read on the first call of a request that needs it. */
async function readDocument(): Promise<ComponentDocument> {
	let load = Object.values(documents)[0];
	if (!load) throw new Error("The @sdxc/ui catalogue document is missing from the bundle");
	return await load();
}
