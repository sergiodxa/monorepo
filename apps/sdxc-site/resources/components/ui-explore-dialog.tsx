/**
 * The focused component explorer opened from the `@sdxc/ui` landing: a wide native dialog
 * holding the same tile grid the page draws under Components, so a reader can browse without
 * leaving the overview.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { overflowY } from "@sdxc/u/overflow";
import { maxBs, maxIs, minBs, p } from "@sdxc/u/size";
import { Dialog } from "@sdxc/ui";

import type { NavEntry } from "~/app/services/navigation-tree";

import UiComponentGrid from "~/resources/components/ui-component-grid";

/** Shared by the trigger button and the panel it opens. */
export const UI_EXPLORE_DIALOG_ID = "ui-explore-components";

namespace UiExploreDialog {
	export interface Props {
		entries: NavEntry[];
	}
}

/** Renders the explorer dialog; open it with `commandfor` / `command="show-modal"`. */
export default function UiExploreDialog(handle: Handle<UiExploreDialog.Props>) {
	return () => {
		let count = handle.props.entries.length;

		return (
			<Dialog
				id={UI_EXPLORE_DIALOG_ID}
				aria-labelledby="ui-explore-title"
				mix={[maxIs("72rem"), maxBs("90vh"), p(0), raw({ inlineSize: "min(100% - 2rem, 72rem)" })]}
			>
				<Dialog.Header mix={[p(6, 6, 4, 6)]}>
					<Dialog.Title id="ui-explore-title">Components</Dialog.Title>
					<Dialog.Description>
						{count} patterns in `@sdxc/ui` — open one for its reference and live preview.
					</Dialog.Description>
				</Dialog.Header>

				<div mix={[p(0, 6, 6, 6), overflowY("auto"), minBs(0)]}>
					<UiComponentGrid entries={handle.props.entries} />
				</div>

				<Dialog.Close commandfor={UI_EXPLORE_DIALOG_ID} aria-label="Close components explorer" />
			</Dialog>
		);
	};
}
