/**
 * The keyboard layer every signed-in list shares: j/k and the arrows walk its rows, Enter opens
 * one, x selects it and / focuses the list's search. Placed inside the list's `Table.Container`,
 * with every key labelled in the reader's language for the keyboard help sheet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { Table } from "@sdxc/ui/app";

namespace ListKeys {
	export interface Props {
		t: Translate;
		/** The list's `FilterBar` id, whose search input `/` focuses; omitted, `/` stays unbound. */
		filterBar?: string;
	}
}

/** Renders the list's `Table.Keys` with the shared labels. */
export default function ListKeys(handle: Handle<ListKeys.Props>) {
	return () => {
		let { t, filterBar } = handle.props;
		return (
			<Table.Keys
				search={filterBar ? `${filterBar}-search` : undefined}
				labels={{
					group: t("app.layout.keys.group"),
					next: t("app.layout.keys.next"),
					previous: t("app.layout.keys.previous"),
					open: t("app.layout.keys.open"),
					toggle: t("app.layout.keys.toggle"),
					search: t("app.layout.keys.search"),
					selected: t("app.layout.keys.selected"),
					deselected: t("app.layout.keys.deselected"),
				}}
			/>
		);
	};
}
