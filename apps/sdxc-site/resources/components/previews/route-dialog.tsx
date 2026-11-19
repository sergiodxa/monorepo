/**
 * Live preview for `RouteDialog`: a page whose address opens an edit form. The preview keeps its
 * open state in the island instead of the address, so opening and closing it stay on this page;
 * the dialog itself is the same modal a reload, a link or a refused post would show.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { Button, Dialog, TextField } from "@sdxc/ui";
import { RouteDialog } from "@sdxc/ui/app/route-dialog";
import { clientEntry, on } from "remix/component";

/** The source the page shows: what a page whose address carries `?edit=42` renders. */
const CODE = `{url.searchParams.has("edit") ? (
	<RouteDialog id="edit-event" closeHref="/week" closeLabel="Close" aria-labelledby="edit-title">
		<form method="post" action="/events/42">
			<Dialog.Header>
				<Dialog.Title id="edit-title">Edit event</Dialog.Title>
			</Dialog.Header>
			<TextField label="Title" name="title" defaultValue="Design review" />
			<Dialog.Footer>
				<a href="/week">Cancel</a>
				<Button type="submit">Save</Button>
			</Dialog.Footer>
		</form>
	</RouteDialog>
) : null}`;

/** A link that opens the dialog, and the dialog while it is open. */
export const RouteDialogPreview = clientEntry(
	import.meta.url,
	function RouteDialogPreview(handle: Handle) {
		let open = false;

		/** Opens or closes the dialog, standing in for the address changing. */
		function toggle(event: Event) {
			event.preventDefault();
			open = !open;
			void handle.update();
		}

		return () => (
			<div mix={[raw({ display: "grid", justifyItems: "center", gap: "0.75rem" })]}>
				<a
					href="#edit"
					mix={[
						raw({ fontWeight: "600", color: "var(--ui-brand-fg)" }),
						on<HTMLAnchorElement, "click">("click", toggle),
					]}
				>
					Edit “Design review”
				</a>
				{open ? (
					<div
						mix={[
							on<HTMLDivElement, "click">("click", (event) => {
								if ((event.target as Element).closest("[data-route-dialog-close], [data-cancel]"))
									toggle(event);
							}),
						]}
					>
						<RouteDialog
							id="preview-route-dialog"
							closeHref="#"
							closeLabel="Close"
							aria-labelledby="preview-route-dialog-title"
						>
							<form method="dialog" mix={[raw({ display: "grid", gap: "1rem" })]}>
								<Dialog.Header>
									<Dialog.Title id="preview-route-dialog-title">Edit event</Dialog.Title>
									<Dialog.Description>
										Reload or share the address and it opens the same way.
									</Dialog.Description>
								</Dialog.Header>
								<TextField label="Title" name="title" defaultValue="Design review" />
								<Dialog.Footer>
									<a href="#edit" data-cancel="">
										Cancel
									</a>
									<Button type="button" data-cancel="">
										Save
									</Button>
								</Dialog.Footer>
							</form>
						</RouteDialog>
					</div>
				) : null}
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <RouteDialogPreview /> };
