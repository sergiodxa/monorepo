/**
 * Client island: a textarea with colon-suggest for emoji shortcodes. Without
 * script the field still accepts typed `:name:` that display paths expand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { emojis } from "@sdxc/emoji/catalog";
import { emojiInput } from "@sdxc/emoji/ui";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { is, p, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

/** Look for the demo surface that owns this field's chrome. */
export type EmojiTextareaVariant = "plain" | "chorus" | "chorus-dm" | "cairn";

/** Serializable props for {@link EmojiTextarea}. */
type EmojiTextareaProps = {
	id: string;
	name: string;
	variant?: EmojiTextareaVariant;
	/** Accessible name when no visible label is tied to the field. */
	"aria-label"?: string;
	placeholder?: string;
	rows?: number;
	required?: boolean;
	defaultValue?: string;
	autofocus?: boolean;
	maxLength?: number;
	"aria-invalid"?: "true" | "false";
	"aria-describedby"?: string;
	/** Composer input slot so Tern's send-on-Enter control still finds the field. */
	"data-slot"?: string;
	/** Extra data attributes the page already keys shortcuts on. */
	"data-shortcut"?: string;
	"data-shortcut-label"?: string;
	/** Taller minimum for the Chorus compose page. */
	tall?: boolean;
};

/** Visual mix for each demo surface that previously styled its own textarea. */
function variantMix(variant: EmojiTextareaVariant, tall: boolean) {
	if (variant === "chorus") {
		return [
			raw({
				fieldSizing: "content",
				minBlockSize: tall ? "7.5rem" : "3.25rem",
				maxBlockSize: "24rem",
				inlineSize: "100%",
				boxSizing: "border-box",
				paddingBlock: "0.5rem",
				paddingInline: "0",
				border: "0",
				resize: "none",
				background: "transparent",
				color: "inherit",
				font: "inherit",
				fontSize: "1.1875rem",
				lineHeight: "1.4",
				outline: "none",
			}),
			when("&::placeholder", raw({ color: "var(--ui-neutral-fg-muted)" })),
		];
	}
	if (variant === "chorus-dm") {
		return [
			raw({
				flex: "1 1 auto",
				fieldSizing: "content",
				minBlockSize: "2.5rem",
				maxBlockSize: "10rem",
				boxSizing: "border-box",
				padding: "0.5rem 1rem",
				borderRadius: "1.25rem",
				border: "1px solid transparent",
				backgroundColor: "var(--ui-neutral-bg-tint-hover)",
				color: "inherit",
				font: "inherit",
				fontSize: "1rem",
				resize: "none",
				outline: "none",
			}),
			when("&:focus", raw({ borderColor: "var(--ui-brand-border-strong)" })),
		];
	}
	if (variant === "cairn") {
		return [
			is("full"),
			rounded("md"),
			border({ color: "neutral", width: 1 }),
			bg("neutral.tint"),
			fg("neutral.emphasis"),
			pi(3),
			p(2),
			text("sm"),
			raw({ resize: "vertical", font: "inherit" }),
		];
	}
	return [
		raw({
			display: "block",
			inlineSize: "100%",
			boxSizing: "border-box",
			paddingInline: "0.5rem",
			paddingBlock: "0.5rem",
			border: "none",
			background: "transparent",
			color: "inherit",
			font: "inherit",
			fontSize: "1rem",
			lineHeight: "1.5",
			resize: "none",
			fieldSizing: "content",
			minBlockSize: "calc(1lh + 1rem)",
			maxBlockSize: "var(--ui-composer-max-block-size, calc(12lh + 1rem))",
			overflowY: "auto",
			outline: "none",
		}),
		when("&::placeholder", fg("neutral.fg-muted")),
	];
}

/** A textarea that opens emoji suggest after two characters following `:`. */
export const EmojiTextarea = clientEntry(
	import.meta.url,
	function EmojiTextarea(handle: Handle<EmojiTextareaProps>) {
		return () => {
			let {
				"aria-describedby": describedBy,
				"aria-invalid": invalid,
				"aria-label": ariaLabel,
				"data-shortcut": shortcut,
				"data-shortcut-label": shortcutLabel,
				"data-slot": dataSlot,
				autofocus,
				defaultValue = "",
				id,
				maxLength,
				name,
				placeholder,
				required,
				rows = 2,
				tall = false,
				variant = "plain",
			} = handle.props;
			let suggestId = `${id}-suggest`;

			return (
				<>
					<textarea
						id={id}
						name={name}
						aria-label={ariaLabel}
						placeholder={placeholder}
						rows={rows}
						required={required}
						defaultValue={defaultValue}
						autofocus={autofocus}
						maxLength={maxLength}
						aria-invalid={invalid}
						aria-describedby={describedBy}
						data-slot={dataSlot}
						data-shortcut={shortcut}
						data-shortcut-label={shortcutLabel}
						mix={[
							emojiInput({ catalog: emojis, suggest: suggestId }),
							...variantMix(variant, tall),
						]}
					/>
					<div id={suggestId} hidden popover="manual" mix={[raw({ zIndex: "40" })]} />
				</>
			);
		};
	},
);
