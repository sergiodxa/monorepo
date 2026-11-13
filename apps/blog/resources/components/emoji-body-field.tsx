/**
 * Client island: the CMS Markdown body with colon-suggest for emoji shortcodes.
 * Without script the textarea still accepts typed `:name:` text that the page
 * walk expands on publish.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { emojis } from "@sdxc/emoji/catalog";
import { emojiInput } from "@sdxc/emoji/ui";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

/** Serializable props for {@link EmojiBodyField}. */
type EmojiBodyFieldProps = {
	name: string;
	label: string;
	placeholder: string;
	value: string;
};

/** The writing-column body textarea with emoji suggest after two characters. */
export const EmojiBodyField = clientEntry(
	import.meta.url,
	function EmojiBodyField(handle: Handle<EmojiBodyFieldProps>) {
		return () => {
			let { label, name, placeholder, value } = handle.props;
			let suggestId = "cms-emoji-suggest";
			return (
				<>
					<textarea
						name={name}
						aria-label={label}
						placeholder={placeholder}
						rows={16}
						required
						defaultValue={value}
						mix={[
							emojiInput({ catalog: emojis, suggest: suggestId }),
							font("mono"),
							fg("neutral.emphasis"),
							raw({
								border: "none",
								background: "transparent",
								padding: "0",
								outline: "none",
								inlineSize: "100%",
								fontSize: "0.9375rem",
								lineHeight: "1.7",
								resize: "none",
								fieldSizing: "content",
								minBlockSize: "20rem",
							}),
						]}
					/>
					<div
						id={suggestId}
						hidden
						popover="manual"
						mix={[
							raw({
								position: "fixed",
								insetBlockStart: "auto",
								zIndex: "40",
							}),
						]}
					/>
				</>
			);
		};
	},
);
