/**
 * The browser half of the keyboard help sheet: binds the key that opens the sheet, and reads
 * the page's shortcut registry whenever it changes or the sheet opens, so the sheet lists the
 * shortcuts the page has right now.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import type { Shortcuts } from "../behaviors/shortcuts.js";

import { isApplePlatform, shortcutRegistry } from "../behaviors/shortcuts.js";

/**
 * Types for {@link keyboardHelp}.
 */
export namespace KeyboardHelpController {
	/** Options for {@link keyboardHelp}. */
	export interface Options {
		/** The combo that opens the sheet, e.g. `"?"`. */
		shortcut: string;
		/** What that combo lists as in the sheet. */
		label: string;
		/** The group that combo lists under. */
		group?: string;
		/**
		 * Receives the registry's rows and whether the keyboard prints Apple glyphs, once on
		 * mount and again whenever the rows may have changed.
		 */
		onChange(entries: Shortcuts.Entry[], apple: boolean): void;
	}
}

/**
 * Binds the sheet's key on the `<dialog>` it is mixed onto, and reports the registry's rows on
 * mount, on every registry change, and as the dialog opens.
 *
 * @param options The key, its label and group, and where the rows go.
 * @example <Modal id="keys" mix={[keyboardHelp({ shortcut: "?", label: "Show shortcuts", onChange })]}>…</Modal>
 */
export const keyboardHelp: MixinFactory<HTMLElement, [options: KeyboardHelpController.Options]> =
	createMixin<HTMLElement, [options: KeyboardHelpController.Options]>((handle) => {
		let options: KeyboardHelpController.Options | undefined;

		handle.addEventListener("insert", (event) => {
			let dialog = event.node;
			let document = dialog.ownerDocument;
			let registry = shortcutRegistry(document);
			let signal = handle.signal;
			let report = () => options?.onChange(registry.list(document), isApplePlatform());

			if (options !== undefined && dialog instanceof HTMLDialogElement) {
				registry.register({
					keys: options.shortcut,
					label: options.label,
					group: options.group,
					scope: null,
					run: () => {
						if (dialog.open) return false;
						report();
						dialog.showModal();
						return true;
					},
					signal,
				});
			}

			registry.addEventListener("change", report, { signal });
			dialog.addEventListener("command", report, { signal });
			dialog.addEventListener("toggle", report, { signal });
			report();
		});

		return (next) => {
			options = next;
		};
	});
