/**
 * Client island: says "Saving…" the moment an issue's property form submits and closes the
 * menu the pick came from, so the save status beside the title answers at once and the
 * server's "Saved" follows once the patched page carries a new edit time.
 * Without script the page reloads with "Saved" already drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { setSaveStatus } from "@sdxc/ui/app";
import { clientEntry, createMixin } from "remix/component";

/** Props the island serializes; a `type`, since serialized props reject an interface. */
export type SavingSignalProps = {
	/** The id of the form whose submit starts a save. */
	form: string;
	/** The id of the save status to set. */
	status: string;
	/** When the visitor last edited the issue, as an ISO string; a new value reads "Saved". */
	editedAt?: string;
};

/** Listens for the form's submit and sets the status to saving, until the host goes. */
const savingSignal = createMixin<
	HTMLElement,
	[form: string, status: string, editedAt: string | undefined]
>((handle) => {
	let controller: AbortController | undefined;
	let ids = { form: "", status: "" };
	let seen: string | undefined | null = null;

	handle.addEventListener("insert", () => {
		controller?.abort();
		controller = new AbortController();
		document.addEventListener(
			"submit",
			(event) => {
				let target = event.target;
				if (!(target instanceof HTMLFormElement) || target.id !== ids.form) return;
				setSaveStatus(ids.status, "saving");
				for (let menu of document.querySelectorAll<HTMLElement>('[role="menu"]:popover-open')) {
					menu.hidePopover();
				}
			},
			{ signal: controller.signal },
		);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});

	return (form, status, editedAt) => {
		ids = { form, status };
		let first = seen === null;
		let changed = editedAt !== undefined && editedAt !== seen;
		seen = editedAt;
		if (first || !changed || typeof window === "undefined") return;
		setTimeout(announce, 0);

		/** Says "Saved" once the page that carries the new edit time is in place. */
		function announce(): void {
			setSaveStatus(status, "saved", new Date(editedAt!));
		}
	};
});

/** Renders a hidden marker carrying the listener. */
export const SavingSignal: EntryComponent<SavingSignalProps> = clientEntry(
	import.meta.url,
	function SavingSignal(handle) {
		return () => (
			<span
				hidden
				mix={[savingSignal(handle.props.form, handle.props.status, handle.props.editedAt)]}
			/>
		);
	},
);
