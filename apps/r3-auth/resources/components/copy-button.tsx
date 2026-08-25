/**
 * Client island: copies a value to the clipboard, confirming briefly in place —
 * the one page shipping JavaScript, since only script can read the clipboard API
 * to capture a newly generated client secret before it disappears. The value
 * lives in a visually hidden carrier that `commandfor` targets, keeping the
 * secret confined to this one spot on the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { visuallyHidden } from "@pkg/u/a11y";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { cursor } from "@pkg/u/general";
import { inlineFlex, items } from "@pkg/u/layout";
import { p } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import { COPY_COMMAND, copyToClipboard } from "@pkg/ui/mixins";
import { clientEntry, on } from "remix/ui";

/** How long the confirmation label stays before the button reads as copyable again. */
const CONFIRMATION_MS = 2000;

/**
 * Declared as a `type` to satisfy the serializable-props constraint a client
 * entry's props are checked against.
 */
type CopyButtonProps = {
	/** The text put on the clipboard, held only within the hidden carrier span. */
	value: string;
	/** Resting label. */
	label: string;
	/** Label shown for {@link CONFIRMATION_MS} after a successful copy. */
	copiedLabel: string;
};

/**
 * Copies {@link CopyButtonProps.value} to the clipboard, confirming briefly in
 * place. The click handler and confirmation timeout each trigger a render via
 * `handle.update()` and are then finished.
 */
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
						void handle.update();
						setTimeout(() => {
							copied = false;
							void handle.update();
						}, CONFIRMATION_MS);
					}),
				]}
			>
				{copied ? handle.props.copiedLabel : handle.props.label}
				<span id={valueId} mix={[visuallyHidden()]}>
					{handle.props.value}
				</span>
			</button>
		);
	},
);

export default CopyButton;
