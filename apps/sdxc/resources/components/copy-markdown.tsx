/**
 * Client island: puts the page's markdown source on the clipboard, for a reader about to
 * paste it into a model. The source is not on the page — the page is what it rendered
 * into — so the button fetches the twin and copies that, which is also why the same
 * address is offered as a plain link beside it for anyone without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CheckIcon, CopyIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { Button } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** How long the confirmation stands before the button offers the action again. */
const CONFIRMATION_MS = 2000;

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type CopyMarkdownProps = {
	/** The page's markdown twin, which is what lands on the clipboard. */
	href: string;
};

/** Copies the markdown behind {@link CopyMarkdownProps.href} onto the clipboard. */
export const CopyMarkdown = clientEntry(
	"/resources/components/copy-markdown.tsx#CopyMarkdown",
	function CopyMarkdown(handle: Handle<CopyMarkdownProps>) {
		let outcome: "idle" | "copied" | "failed" = "idle";

		async function copy(): Promise<void> {
			try {
				let response = await fetch(handle.props.href, { headers: { accept: "text/markdown" } });
				if (!response.ok) throw new Error(`Markdown twin answered ${response.status}`);
				await navigator.clipboard.writeText(await response.text());
				outcome = "copied";
			} catch {
				outcome = "failed";
			}

			await handle.update();

			setTimeout(() => {
				outcome = "idle";
				void handle.update();
			}, CONFIRMATION_MS);
		}

		return () => (
			<Button
				type="button"
				color="neutral"
				variant="outline"
				size="sm"
				mix={[
					on<HTMLButtonElement, "click">("click", () => {
						void copy();
					}),
				]}
			>
				{outcome === "copied" ? (
					<CheckIcon size={16} aria-hidden="true" />
				) : (
					<CopyIcon size={16} aria-hidden="true" />
				)}
				Copy Markdown
				{/* Empty until an attempt lands, so the region speaks the outcome alone. */}
				<span role="status" mix={[visuallyHidden()]}>
					{outcome === "copied" ? "Markdown copied" : ""}
					{outcome === "failed" ? "Could not copy the markdown" : ""}
				</span>
			</Button>
		);
	},
);

export default CopyMarkdown;
