/**
 * Client island: copies a value to the clipboard on click, with a brief "Copied!"
 * label swap. The only client-side interactivity for one-time secret reveals (API
 * keys) and copyable snippets (cron-job ping URLs), per the approved-islands list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

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

export const CopyButton = clientEntry(
	"/resources/components/copy-button.tsx#CopyButton",
	function CopyButton(handle: Handle<CopyButtonProps>) {
		let copied = false;

		return () => (
			<button
				type="button"
				mix={[
					button,
					on("click", async () => {
						await navigator.clipboard.writeText(handle.props.value);
						copied = true;
						handle.update();
						setTimeout(() => {
							copied = false;
							handle.update();
						}, 2000);
					}),
				]}
			>
				{copied ? "Copied!" : (handle.props.label ?? "Copy")}
			</button>
		);
	},
);

export default CopyButton;
