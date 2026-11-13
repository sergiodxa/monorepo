/**
 * Client island: a single-line text field with colon-suggest for emoji
 * shortcodes (Cairn issue titles and similar).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { emojis } from "@sdxc/emoji/catalog";
import { emojiInput } from "@sdxc/emoji/ui";
import { vstack } from "@sdxc/u/layout";
import { FieldError, Input, Label } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** Serializable props for {@link EmojiInputField}. */
type EmojiInputFieldProps = {
	id: string;
	name: string;
	label: string;
	defaultValue?: string;
	placeholder?: string;
	maxLength?: number;
	required?: boolean;
	autofocus?: boolean;
	errorMessage?: string;
};

/** A labelled text input that opens emoji suggest after two characters following `:`. */
export const EmojiInputField = clientEntry(
	import.meta.url,
	function EmojiInputField(handle: Handle<EmojiInputFieldProps>) {
		return () => {
			let {
				autofocus,
				defaultValue = "",
				errorMessage,
				id,
				label,
				maxLength,
				name,
				placeholder,
				required,
			} = handle.props;
			let suggestId = `${id}-suggest`;
			let errorId = errorMessage ? `${id}-error` : undefined;

			return (
				<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
					<Label htmlFor={id}>{label}</Label>
					<Input
						id={id}
						name={name}
						defaultValue={defaultValue}
						placeholder={placeholder}
						maxLength={maxLength}
						required={required}
						autofocus={autofocus}
						aria-invalid={errorMessage ? "true" : undefined}
						aria-describedby={errorId}
						mix={[emojiInput({ catalog: emojis, suggest: suggestId })]}
					/>
					<div id={suggestId} hidden popover="manual" />
					{errorMessage ? <FieldError id={errorId}>{errorMessage}</FieldError> : null}
				</div>
			);
		};
	},
);
