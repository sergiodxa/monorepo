/**
 * The `@sdxc/ui` theme contract as the site reads it: every `--ui-*` custom property
 * the stylesheets declare, what each one controls, and which components read it. All
 * three columns were resolved when the document was generated, so the page is a read
 * rather than a scan. The document loads inside a request, because work in the
 * worker's global scope fails upload validation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const documents = import.meta.glob<ThemeReference>("../generated/theme.json", {
	import: "default",
});

/** One token, as the contract table lists it. */
export interface ThemeToken {
	/** The custom property, written as it is declared and overridden. */
	name: string;
	controls: string;
	/** Components whose source reaches this token, alphabetically. */
	components: string[];
}

/** A titled run of tokens, which is one band of the contract table. */
export interface ThemeGroup {
	title: string;
	description: string;
	tokens: ThemeToken[];
}

/** One declaration as a scheme block states it. */
export interface ThemeDeclaration {
	name: string;
	value: string;
}

/** The whole page: the contract, then the two schemes over the same names. */
export interface ThemeReference {
	groups: ThemeGroup[];
	light: ThemeDeclaration[];
	dark: ThemeDeclaration[];
}

/** The contract and both schemes. */
export async function readTheme(): Promise<ThemeReference> {
	let load = Object.values(documents)[0];
	if (!load) throw new Error("The @sdxc/ui theme document is missing from the bundle");
	return await load();
}
