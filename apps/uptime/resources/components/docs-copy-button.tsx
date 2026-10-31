/**
 * Client island: the copy button in a documentation code block's header. It copies the
 * text of the element it names and confirms the write with a glyph swap plus a status
 * a screen reader announces, so the code stays readable and selectable without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CheckIcon, CopyIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { inlineFlex, items, justify } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { COPY_COMMAND, copyToClipboard } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type DocsCopyButtonProps = {
	/** The `id` of the element whose text is copied. */
	target: string;
	label: string;
	copiedLabel: string;
};

/** How long the check glyph stays after a successful copy. */
const CONFIRM_MS = 2000;

/** Copies the text of {@link DocsCopyButtonProps.target} onto the clipboard. */
export const DocsCopyButton = clientEntry(
	import.meta.url,
	function DocsCopyButton(handle: Handle<DocsCopyButtonProps>) {
		let copied = false;

		return () => {
			let { target, label, copiedLabel } = handle.props;

			return (
				<button
					type="button"
					aria-label={copied ? copiedLabel : label}
					title={label}
					commandfor={target}
					command={COPY_COMMAND}
					mix={[
						inlineFlex(),
						items("center"),
						justify("center"),
						p(1.5),
						rounded("md"),
						border({ color: "transparent", width: 1, style: "solid" }),
						bg("transparent"),
						fg("neutral"),
						cursor("pointer"),
						transition("color, background-color, border-color"),
						hover([fg("neutral.emphasis"), bg("neutral.bg-tint-hover")]),
						when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
						copyToClipboard(),
						on("ui:copy", (event) => {
							if (!event.success) return;
							copied = true;
							void handle.update();
							setTimeout(() => {
								copied = false;
								void handle.update();
							}, CONFIRM_MS);
						}),
					]}
				>
					{copied ? (
						<CheckIcon size={16} aria-hidden="true" />
					) : (
						<CopyIcon size={16} aria-hidden="true" />
					)}

					<span role="status" mix={[visuallyHidden()]}>
						{copied ? copiedLabel : ""}
					</span>
				</button>
			);
		};
	},
);

export default DocsCopyButton;
