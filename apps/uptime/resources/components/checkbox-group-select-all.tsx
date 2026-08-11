/**
 * Client island: a tri-state checkbox that ticks or clears every checkbox inside
 * the group element named by {@link CheckboxGroupSelectAllProps.groupId}, so a long
 * list of options can be taken or dropped in one gesture instead of one row at a
 * time. It owns no form field of its own — it only writes the `checked` property of
 * controls that already exist — so the submitted payload is exactly what it would
 * have been had every box been ticked by hand.
 *
 * It stays hidden until its mixin has run, because the control is meaningless with
 * no script to drive it: a page served without JavaScript shows only the individual
 * checkboxes, all of which keep working on their own.
 *
 * The checked/indeterminate state is written straight onto the live control rather
 * than rendered from props: `indeterminate` has no HTML attribute at all (it is a
 * DOM-only property), and the boxes it summarizes can be toggled individually at
 * any time, so the DOM is the only honest source for what "all selected" currently
 * means.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { intl } from "@pkg/i18n/ui";
import { Checkbox } from "@pkg/ui";
import { clientEntry, on, ref } from "remix/ui";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type CheckboxGroupSelectAllProps = {
	/** `id` of the element whose descendant checkboxes this control drives. */
	groupId: string;
};

/** Ticks or clears every checkbox inside `groupId`, reporting "some selected" as indeterminate. */
export const CheckboxGroupSelectAll = clientEntry(
	"/resources/components/checkbox-group-select-all.tsx#CheckboxGroupSelectAll",
	function CheckboxGroupSelectAll(handle: Handle<CheckboxGroupSelectAllProps>) {
		/*
		 * Server-rendered as `false`, flipped by the mixin below: until a script has
		 * wired the control up, showing it would offer an action that cannot happen.
		 */
		let ready = false;
		/** Whether every driven checkbox is currently ticked, which flips the label to "clear". */
		let allSelected = false;
		/** The control itself, so its DOM-only `indeterminate` property can be written. */
		let control: HTMLInputElement | null = null;

		/** The checkboxes this control drives, or an empty list before the group is in the document. */
		function driven(): HTMLInputElement[] {
			let group = document.getElementById(handle.props.groupId);
			if (!group) return [];
			return [...group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
		}

		/** Re-reads the driven checkboxes and restates this control's own three-way state from them. */
		function sync() {
			let boxes = driven();
			let selected = boxes.filter((box) => box.checked).length;
			let next = boxes.length > 0 && selected === boxes.length;

			if (control) {
				control.checked = next;
				control.indeterminate = selected > 0 && selected < boxes.length;
			}

			if (next === allSelected && ready) return;
			allSelected = next;
			ready = true;
			handle.update();
		}

		return () => (
			// `hidden` rather than an unrendered branch, so the server and the first
			// client render agree on the markup and hydration has something to adopt.
			<div hidden={!ready}>
				<Checkbox
					mix={[
						ref<HTMLInputElement>((node, signal) => {
							control = node;
							// Listening on the group, not each box: the boxes are rendered by the
							// page rather than by this island, and change events bubble.
							document
								.getElementById(handle.props.groupId)
								?.addEventListener("change", sync, { signal });
							sync();
						}),
						on<HTMLInputElement, "change">("change", (event) => {
							let checked = event.currentTarget.checked;
							for (let box of driven()) box.checked = checked;
							sync();
						}),
					]}
				>
					{allSelected
						? intl(handle).t("components.selectAll.clear")
						: intl(handle).t("components.selectAll.select")}
				</Checkbox>
			</div>
		);
	},
);

export default CheckboxGroupSelectAll;
