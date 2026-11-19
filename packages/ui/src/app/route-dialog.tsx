/**
 * A dialog whose open state is the page's address: the server renders it open when the address
 * names it (`?edit=42`), so it can be linked to, reloaded and opened without script. Closing it
 * follows a link to the address without it; once hydrated, it is a true modal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { clientEntry } from "remix/component";

import { Dialog } from "../components/dialog.js";

import { routeDialog } from "./mixins/route-dialog.js";

/** Prop types for {@link RouteDialog}. */
export namespace RouteDialog {
	/** Props accepted by {@link RouteDialog}: every `Dialog` prop, plus where closing leads. */
	export interface Props extends Dialog.Props {
		id: string;
		/** The page's address without the dialog, which closing it navigates to. */
		closeHref: string;
		/** The close link's name, such as "Close". */
		closeLabel: string;
	}
}

/**
 * Client island: lifts the server-opened dialog into the top layer as a modal, and follows the
 * close link once it closes by Escape or a `command="close"` button. Loads from
 * `@sdxc/ui/app/route-dialog#RouteDialogModal`.
 */
export const RouteDialogModal: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/app/route-dialog#RouteDialogModal",
	function RouteDialogModal() {
		return () => <span hidden data-slot="route-dialog-modal" mix={[routeDialog()]} />;
	},
);

/**
 * Renders the dialog open, over a full-screen link back to the page without it. Without script
 * the dialog sits fixed in the middle of the screen and the backdrop link closes it; with
 * script it becomes modal, traps focus and closes on Escape.
 *
 * @example
 * <RouteDialog id="edit-event" closeHref="/week" closeLabel="Close" aria-labelledby="edit-title">
 * 	<form method="post" action="/events/42">…</form>
 * </RouteDialog>
 */
export function RouteDialog(handle: Handle<RouteDialog.Props>) {
	return () => {
		let { id, closeHref, closeLabel, children, mix, ...rest } = handle.props;
		return (
			<>
				<a
					href={closeHref}
					data-slot="route-dialog-backdrop"
					data-route-dialog-close={id}
					tabIndex={-1}
					mix={[
						raw({
							position: "fixed",
							inset: "0",
							zIndex: "60",
							backgroundColor:
								"color-mix(in oklch, var(--ui-color-neutral-950, black) 40%, transparent)",
						}),
					]}
				>
					<span mix={[visuallyHidden()]}>{closeLabel}</span>
				</a>
				<Dialog
					{...rest}
					id={id}
					open
					data-route-dialog=""
					mix={mergeMix(
						[
							raw({
								"&[open]:not(:modal)": {
									position: "fixed",
									inset: "0",
									zIndex: "61",
									margin: "auto",
									blockSize: "fit-content",
									maxBlockSize: "calc(100dvh - 2rem)",
									overflowY: "auto",
								},
							}),
						],
						mix,
					)}
				>
					{children}
					<RouteDialogModal />
				</Dialog>
			</>
		);
	};
}
