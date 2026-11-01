/**
 * Client island: keeps one set of code tabs on the choice every set sharing its sync key
 * makes, and remembers it. It owns no visible markup, so the tabs stay server HTML and
 * switch without script; only this marker hydrates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { clientEntry } from "remix/component";

import type { CodeTabsPersistence } from "./mixins/code-tabs-sync.js";

import { codeTabsSync } from "./mixins/code-tabs-sync.js";

/**
 * Props {@link CodeTabsSync} serializes into the page for hydration, which is why they
 * are a `type`: `SerializableProps` rejects an interface.
 */
export type CodeTabsSyncProps = {
	/** The key the tab sets share, such as `package-manager`. */
	syncKey: string;
	/** Where the choice is remembered between pages. */
	persist: CodeTabsPersistence;
};

/**
 * Renders a hidden marker carrying {@link codeTabsSync}. `CodeTabs` renders it whenever it
 * has a `syncKey`; the island loads from the bare `@sdxc/ui/docs/code-tabs-sync` specifier,
 * which the app's browser entry maps to a dynamic import.
 */
export const CodeTabsSync: EntryComponent<CodeTabsSyncProps> = clientEntry(
	"@sdxc/ui/docs/code-tabs-sync#CodeTabsSync",
	function CodeTabsSync(handle) {
		return () => (
			<span mix={[hidden(), codeTabsSync(handle.props.syncKey, handle.props.persist)]} />
		);
	},
);
