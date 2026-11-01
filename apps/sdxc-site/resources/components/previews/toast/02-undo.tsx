/**
 * Live example island for Undo, the standard action after a reversible delete. Removing
 * a monitor happens at once, and the toast holds Undo for `TOAST_UNDO_DURATION` (8s)
 * instead of asking for confirmation first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { hstack, vstack } from "@sdxc/u/layout";
import { Button } from "@sdxc/ui";
import { pageToaster, TOAST_UNDO_DURATION } from "@sdxc/ui/app/toast";
import { Toasts } from "@sdxc/ui/app/toasts";
import { clientEntry, on } from "remix/component";

/** The queue this example draws, kept apart from the other stacks on the page. */
const QUEUE = "toast-undo";

/** The monitors the list starts with. */
const MONITORS = ["Checkout API", "Search", "Webhooks"];

/** The source the page shows, matching the markup below. */
const CODE = `function remove(name: string) {
	let index = monitors.indexOf(name);
	monitors = monitors.filter((monitor) => monitor !== name);
	void handle.update();

	pageToaster().add(
		{
			title: "Monitor deleted",
			description: name,
			action: {
				label: "Undo",
				onAction: () => {
					monitors.splice(index, 0, name);
					void handle.update();
				},
			},
		},
		{ duration: TOAST_UNDO_DURATION },
	);
}`;

/** A list whose Delete buttons act at once and offer Undo in a toast. */
export const UndoToast = clientEntry(import.meta.url, function UndoToast(handle: Handle) {
	let toaster = pageToaster(QUEUE);
	let monitors = [...MONITORS];

	/** Deletes `name` now and offers to put it back where it was. */
	function remove(name: string): void {
		let index = monitors.indexOf(name);
		monitors = monitors.filter((monitor) => monitor !== name);
		void handle.update();

		toaster.add(
			{
				title: "Monitor deleted",
				description: name,
				action: {
					label: "Undo",
					onAction: () => {
						monitors.splice(index, 0, name);
						void handle.update();
					},
				},
			},
			{ duration: TOAST_UNDO_DURATION },
		);
	}

	return () => (
		<>
			<ul mix={[vstack({ gap: 2, align: "stretch" })]}>
				{monitors.map((name) => (
					<li key={name} mix={[hstack({ gap: 3, align: "center", justify: "between" })]}>
						{name}
						<Button
							size="sm"
							variant="outline"
							color="danger"
							mix={[on<HTMLButtonElement, "click">("click", () => remove(name))]}
						>
							Delete
						</Button>
					</li>
				))}
			</ul>
			<Toasts labels={{ region: "Notifications", dismiss: "Dismiss" }} queue={QUEUE} />
		</>
	);
});

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default { title: "Undo after a delete", code: CODE, render: () => <UndoToast /> };
