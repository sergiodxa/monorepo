/**
 * Why JS: a dialog or popover opened by an invoker button cannot read that button's value. No-JS
 * baseline: the button still opens its target, whose fields start at their own defaults.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { asCommandEvent } from "../utils/command-event.js";

/** A form field the mixin can preset: what `HTMLFormElement.elements` returns for a name. */
type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Presets the fields of the dialog or popover around the host from the button that opens it: an
 * invoker carrying `name` and `value` sets the target's field of that name to that value. Once
 * the target closes, each preset field returns to the value it held before, so the next opener
 * starts where the form was.
 *
 * @example <button commandfor="new-issue" command="show-modal" name="status" value="done">+</button>
 * @example <span hidden mix={[invokerFields()]} />
 */
export const invokerFields: MixinFactory<HTMLElement, []> = createMixin<HTMLElement, []>(
	(handle) => {
		let controller: AbortController | undefined;

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			controller = new AbortController();
			let target = event.node.closest<HTMLElement>("dialog, [popover]");
			if (!target) return;
			let preset = new Map<Field, string>();

			/** Sets the field the invoking button names to the button's value. */
			function presetFromInvoker(command: Event): void {
				let source = asCommandEvent(command).source;
				if (!(source instanceof HTMLButtonElement) || !source.name) return;
				for (let field of fieldsNamed(target!, source.name)) {
					if (!preset.has(field)) preset.set(field, field.value);
					field.value = source.value;
				}
			}

			/** Returns each preset field to the value it held before, once the target closes. */
			function restoreDefaults(): void {
				for (let [field, value] of preset) field.value = value;
				preset.clear();
			}

			target.addEventListener("command", presetFromInvoker, { signal: controller.signal });
			target.addEventListener("close", restoreDefaults, { signal: controller.signal });
			target.addEventListener(
				"toggle",
				(toggle) => {
					if ((toggle as ToggleEvent).newState === "closed") restoreDefaults();
				},
				{ signal: controller.signal },
			);
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});
	},
);

/** The fields named `name` in every form inside `target`. */
function fieldsNamed(target: HTMLElement, name: string): Field[] {
	return [...target.querySelectorAll<Field>("input, select, textarea")].filter(
		(field) => field.name === name,
	);
}
