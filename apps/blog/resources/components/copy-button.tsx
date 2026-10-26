/**
 * The icon button beside each press kit bio that copies the bio's text, then shows a check
 * for two seconds. The bio is plain selectable text on the server-rendered page, so the kit works
 * before this island loads; the button only saves the selecting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CopyCheckIcon, CopyIcon } from "@sdxc/icons";
import { Button } from "@sdxc/ui";
import { COPY_COMMAND, copyToClipboard } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** How long the button reads as copied before it offers to copy again. */
const COPIED_MS = 2000;

/** Props of {@link CopyButton}, serialized into the page for hydration. */
export type CopyButtonProps = {
	/** The `id` of the element whose text is copied. */
	target: string;
	label: string;
	copiedLabel: string;
};

/**
 * Copies the text of the element `target` names, through the platform's command invokers.
 * A failed write leaves the label unchanged, since the text is still there to select.
 */
export const CopyButton = clientEntry(
	import.meta.url,
	function CopyButton(handle: Handle<CopyButtonProps>) {
		let copied = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		handle.signal.addEventListener("abort", () => clearTimeout(timer));

		return () => (
			<Button
				type="button"
				size="sm"
				variant="ghost"
				aria-label={copied ? handle.props.copiedLabel : handle.props.label}
				title={handle.props.label}
				commandfor={handle.props.target}
				command={COPY_COMMAND}
				aria-live="polite"
				mix={[
					copyToClipboard(),
					on("ui:copy", (event) => {
						if (!event.success) return;
						copied = true;
						void handle.update();
						clearTimeout(timer);
						timer = setTimeout(() => {
							copied = false;
							void handle.update();
						}, COPIED_MS);
					}),
				]}
			>
				{copied ? <CopyCheckIcon size="1em" /> : <CopyIcon size="1em" />}
			</Button>
		);
	},
);
