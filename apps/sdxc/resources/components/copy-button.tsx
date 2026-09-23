/**
 * Client island: copies the text of the element it points at onto the clipboard, and
 * confirms the write with a glyph swap plus a live region a screen reader announces.
 * Only script can reach the clipboard, so the value stays readable on the page too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { CheckIcon, CopyIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { inlineFlex, items, justify } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { COPY_COMMAND, copyToClipboard } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/ui";

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type CopyButtonProps = {
	/** The `id` of the element whose text is copied. */
	target: string;
	label?: string;
	copiedLabel?: string;
	/** Draws the button as a bare square glyph, for a toolbar that already reads as one. */
	bare?: boolean;
};

/** Copies the text of {@link CopyButtonProps.target} onto the clipboard. */
export const CopyButton = clientEntry(
	"/resources/components/copy-button.tsx#CopyButton",
	function CopyButton(handle: Handle<CopyButtonProps>) {
		let copied = false;

		return () => {
			let { bare, copiedLabel = "Copied", label = "Copy to clipboard", target } = handle.props;

			return (
				<button
					type="button"
					aria-label={copied ? copiedLabel : label}
					commandfor={target}
					command={COPY_COMMAND}
					mix={[
						inlineFlex(),
						items("center"),
						justify("center"),
						bare ? p(1.5) : p(1.5, 2.5),
						rounded("md"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						bg("neutral.bg-tint"),
						fg("neutral"),
						cursor("pointer"),
						transition("color, background-color, border-color"),
						hover(fg("neutral.emphasis")),
						when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
						copyToClipboard(),
						on("ui:copy", (event) => {
							if (!event.success) return;
							copied = true;
							void handle.update();
							setTimeout(() => {
								copied = false;
								void handle.update();
							}, 2000);
						}),
					]}
				>
					{copied ? (
						<CheckIcon size={16} aria-hidden="true" />
					) : (
						<CopyIcon size={16} aria-hidden="true" />
					)}
					{/* Empty until the write lands, so the region speaks the confirmation alone. */}
					<span role="status" mix={[visuallyHidden()]}>
						{copied ? copiedLabel : ""}
					</span>
				</button>
			);
		};
	},
);

export default CopyButton;
