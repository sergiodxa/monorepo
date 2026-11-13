/**
 * Client island: opens the compose dialog from any control marked `data-compose`, after
 * loading the dialog's frame from that control's compose address (a new post, a reply or a
 * quote). Without script, New post opens the dialog natively and Reply and Quote stay links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { clientEntry } from "remix/component";

/** Props the island serializes; a `type`, since serialized props reject an interface. */
export type ComposeOpenerProps = {
	/** The dialog's id. */
	dialog: string;
	/** The name of the frame inside the dialog that holds the composer. */
	frame: string;
};

/**
 * A compose address without its `return` parameter, so the dialog keeps its draft when it is
 * opened again for the same post, whichever page it was first loaded for.
 *
 * @param address A compose address.
 */
function composeKey(address: string): string {
	let url = new URL(address, location.href);
	url.searchParams.delete("return");
	return `${url.pathname}${url.search}`;
}

/**
 * Takes over clicks on `[data-compose]`: loads the dialog's frame when it holds another
 * compose screen, then opens the dialog, whose field takes focus as it opens.
 */
export const ComposeOpener: EntryComponent<ComposeOpenerProps> = clientEntry(
	import.meta.url,
	function ComposeOpener(handle) {
		handle.queueTask(() => {
			document.addEventListener(
				"click",
				async (event) => {
					let source = event.target instanceof Element ? event.target : null;
					let control = source?.closest<HTMLElement>("[data-compose]");
					let dialog = document.getElementById(handle.props.dialog);
					let frame = handle.frames.get(handle.props.frame);
					if (!control || !(dialog instanceof HTMLDialogElement) || frame === undefined) return;
					if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
					event.preventDefault();
					control.closest<HTMLElement>("[popover]")?.hidePopover();
					let address = control.dataset.compose || control.getAttribute("href") || "";
					if (composeKey(address) !== composeKey(frame.src)) await frame.reload({ src: address });
					dialog.showModal();
				},
				{ signal: handle.signal },
			);
		});
		return () => null;
	},
);
