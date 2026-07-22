/**
 * Client island: copies a value to the clipboard on click, with a brief "Copied!"
 * label swap. The only client-side interactivity for one-time secret reveals (API
 * keys) and copyable snippets (cron-job ping URLs), per the approved-islands list.
 *
 * Renders {@link CopyButtonProps.value} into a visually-hidden carrier `<span>`
 * inside its own host and points `commandfor` at it, so `@pkg/r3-ui/mixins`'
 * `copyToClipboard()` — built to copy whatever element its button's `commandfor`
 * targets — always has a same-instance target to read from, regardless of
 * whether `value` also happens to be visible in a sibling element.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { intl } from "@pkg/i18n/ui";
import { COPY_COMMAND, copyToClipboard } from "@pkg/r3-ui/mixins";
import { clientEntry, css, on } from "remix/ui";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type CopyButtonProps = { value: string; label?: string };

const button = css({
	display: "inline-flex",
	alignItems: "center",
	padding: "4px 10px",
	borderRadius: 6,
	border: "1px solid oklch(0.83 0.01 145)",
	background: "transparent",
	color: "inherit",
	fontSize: "0.8125rem",
	cursor: "pointer",
	"@media (prefers-color-scheme: dark)": { borderColor: "oklch(0.42 0.008 145)" },
});

/** Visually hides {@link CopyButtonProps.value}'s carrier `<span>` while keeping its text readable to the clipboard mixin. */
const hiddenValue = css({
	position: "absolute",
	width: 1,
	height: 1,
	padding: 0,
	margin: -1,
	overflow: "hidden",
	clip: "rect(0, 0, 0, 0)",
	whiteSpace: "nowrap",
	border: 0,
});

/** Copies {@link CopyButtonProps.value} to the clipboard on click, swapping its label to "Copied!" for 2 seconds. */
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
					button,
					copyToClipboard(),
					on("ui:copy", (event) => {
						if (!event.success) return;
						copied = true;
						handle.update();
						setTimeout(() => {
							copied = false;
							handle.update();
						}, 2000);
					}),
				]}
			>
				{copied
					? intl(handle).t("components.copyButton.copied")
					: (handle.props.label ?? intl(handle).t("components.copyButton.label"))}
				<span id={valueId} mix={[hiddenValue]}>
					{handle.props.value}
				</span>
			</button>
		);
	},
);

export default CopyButton;
