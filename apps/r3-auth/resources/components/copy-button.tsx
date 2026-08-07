/**
 * Client island: copies a value to the clipboard on click and swaps its label to a
 * confirmation for two seconds. The one place this server ships JavaScript, because
 * reading the clipboard API is the only thing on the admin screens the HTML platform
 * cannot express — it exists for the single moment a newly generated client secret is
 * visible and has to be captured before it is gone.
 *
 * The value is rendered into a visually hidden carrier inside the button and
 * `commandfor` points at it, so the copy mixin always has a same-instance target and
 * the secret never has to be readable anywhere else on the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { COPY_COMMAND, copyToClipboard } from "@pkg/r3-ui/mixins";
import { visuallyHidden } from "@pkg/u/a11y";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { cursor } from "@pkg/u/general";
import { inlineFlex, items } from "@pkg/u/layout";
import { p } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import { clientEntry, on } from "remix/ui";

/** How long the confirmation label stays before the button reads as copyable again. */
const CONFIRMATION_MS = 2000;

/**
 * Props must be a `type` rather than an `interface` to satisfy the serializable-props
 * constraint a client entry's props are checked against.
 */
type CopyButtonProps = {
	/** The text put on the clipboard. Never rendered visibly by this component. */
	value: string;
	/** Resting label. */
	label: string;
	/** Label shown for {@link CONFIRMATION_MS} after a successful copy. */
	copiedLabel: string;
};

/** Copies {@link CopyButtonProps.value} to the clipboard, confirming briefly in place. */
export const CopyButton = clientEntry(
	"/resources/components/copy-button.tsx#CopyButton",
	function CopyButton(handle: Handle<CopyButtonProps>) {
		let copied = false;
		let valueId = `${handle.id}-value`;

		return () => (
			<button
				type="button"
				commandfor={valueId}
				command={COPY_COMMAND}
				mix={[
					inlineFlex(),
					items("center"),
					p(1, 2.5),
					rounded("md"),
					border({ color: "neutral", width: 1, style: "solid" }),
					bg("transparent"),
					fg("neutral"),
					fontSize("sm"),
					cursor("pointer"),
					copyToClipboard(),
					on("ui:copy", (event) => {
						if (!event.success) return;
						copied = true;
						handle.update();
						setTimeout(() => {
							copied = false;
							handle.update();
						}, CONFIRMATION_MS);
					}),
				]}
			>
				{copied ? handle.props.copiedLabel : handle.props.label}
				{/* Keeps the value readable to the copy mixin while rendering no pixels. */}
				<span id={valueId} mix={[visuallyHidden()]}>
					{handle.props.value}
				</span>
			</button>
		);
	},
);

export default CopyButton;
