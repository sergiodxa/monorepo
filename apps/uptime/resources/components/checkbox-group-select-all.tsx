/**
 * Client island: a tri-state checkbox that ticks or clears every checkbox inside
 * the group element named by {@link CheckboxGroupSelectAllProps.groupId}, writing
 * the `checked` property directly onto each existing control so the submitted
 * payload comes out exactly as if every box had been ticked by hand.
 *
 * Present in the markup but `hidden` until its mixin has wired it up, so
 * hydration always finds a matching element to adopt; each checkbox already
 * handles its own toggling, keeping the page usable immediately on load.
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

/**
 * Ticks or clears every checkbox inside `groupId`, reporting "some selected" as
 * indeterminate. Listens for `change` on the group element itself, since
 * checkboxes are rendered by the page and their change events bubble up to it.
 */
export const CheckboxGroupSelectAll = clientEntry(
	"/resources/components/checkbox-group-select-all.tsx#CheckboxGroupSelectAll",
	function CheckboxGroupSelectAll(handle: Handle<CheckboxGroupSelectAllProps>) {
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
			void handle.update();
		}

		return () => (
			<div hidden={!ready}>
				<Checkbox
					mix={[
						ref<HTMLInputElement>((node, signal) => {
							control = node;
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
