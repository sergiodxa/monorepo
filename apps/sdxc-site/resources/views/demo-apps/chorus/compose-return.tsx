/**
 * Client island: the compose dialog's `return` field. The dialog lives in the shell, which a
 * screen swap leaves alone, so on submit it writes the page the visitor is on now (without its
 * toast or anchor) and closes the dialog, and the post lands back on that page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { clientEntry, ref } from "remix/component";

/** Props the island serializes; a `type`, since serialized props reject an interface. */
export type ComposeReturnProps = {
	/** The page the server drew the shell for, which a post without script returns to. */
	page: string;
	/** The app's root address, which the field's page path is relative to. */
	root: string;
};

/** The query parameters that belong to one visit of a page, never to the page itself. */
const ONE_TIME_PARAMS = ["toast", "at"];

/**
 * The page path under `root` the browser shows now, with its query minus one-time parameters.
 *
 * @param root The app's root address.
 */
function currentPage(root: string): string {
	let path = location.pathname === root ? "" : location.pathname.slice(root.length + 1);
	let query = new URLSearchParams(location.search);
	for (let name of ONE_TIME_PARAMS) query.delete(name);
	let search = query.toString();
	return search === "" ? path : `${path}?${search}`;
}

/** Renders the hidden field; on its form's submit, points it at the current page. */
export const ComposeReturn: EntryComponent<ComposeReturnProps> = clientEntry(
	import.meta.url,
	function ComposeReturn(handle) {
		return () => (
			<input
				type="hidden"
				name="return"
				value={handle.props.page}
				mix={[
					ref((field: HTMLInputElement, signal) => {
						field.form?.addEventListener(
							"submit",
							() => {
								field.value = currentPage(handle.props.root);
								field.form?.closest("dialog")?.close();
							},
							{ signal },
						);
					}),
				]}
			/>
		);
	},
);
