/**
 * Client island: the composer's message field with `:name:` suggestions over Parley's whole
 * catalog, Fernhill's custom emoji included. Without script it is the same field, and a typed
 * shortcode still expands when the message renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { emojiInput } from "@sdxc/emoji/ui";
import { raw } from "@sdxc/u/general";
import { Composer } from "@sdxc/ui/chat/composer";
import { clientEntry } from "remix/component";

import { INDEX } from "~/resources/views/demo-apps/parley/emoji";

/**
 * Props {@link ComposerField} serializes into the page, which is why they are a `type`:
 * `SerializableProps` rejects an interface.
 */
export type ComposerFieldProps = {
	id: string;
	name: string;
	label: string;
	placeholder: string;
	maxLength: number;
	/** Text a refused send typed, put back in the field. */
	defaultValue?: string;
	/** The key that focuses the field, for the composer under the conversation. */
	shortcut?: string;
	shortcutLabel?: string;
};

/** Renders the field and the host its suggestions open in, above the composer. */
export const ComposerField: EntryComponent<ComposerFieldProps> = clientEntry(
	import.meta.url,
	function ComposerField(handle) {
		return () => {
			let { id, name, label, placeholder, maxLength, defaultValue, shortcut, shortcutLabel } =
				handle.props;
			let suggest = `${id}-emoji-suggest`;
			return (
				<>
					<Composer.Input
						id={id}
						name={name}
						aria-label={label}
						placeholder={placeholder}
						required
						maxLength={maxLength}
						defaultValue={defaultValue}
						data-shortcut={shortcut}
						data-shortcut-label={shortcutLabel}
						mix={[emojiInput({ catalog: INDEX, suggest })]}
					/>
					<div id={suggest} hidden popover="manual" mix={[raw({ zIndex: "40" })]} />
				</>
			);
		};
	},
);
