/**
 * Live preview island for `Button`. A `<button>` already presses, so the component's job
 * is the tone, weight and size vocabulary, plus the pending state that swaps the label for
 * a spinner while holding the footprint. What a button does needs wiring, so the last row
 * carries the `copyToClipboard()` pairing a reader would write: a `--copy` command aimed at
 * the element holding the text, and a `ui:copy` listener that reports how the write
 * settled, since the clipboard can refuse a page it does not trust.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CheckIcon, CopyIcon, PlusIcon, Trash2Icon } from "@sdxc/icons";
import { bg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";
import { Button } from "@sdxc/ui";
import { COPY_COMMAND, copyToClipboard } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** What the copy button reads as, before a press and after each of the two outcomes. */
const COPY_LABELS = {
	idle: "Copy key",
	copied: "Copied",
	refused: "Clipboard refused",
};

/** The source the page shows, matching the markup below. */
const CODE = `const COPY_LABELS = {
	idle: "Copy key",
	copied: "Copied",
	refused: "Clipboard refused",
};

let copyState: keyof typeof COPY_LABELS = "idle";

<div mix={[vstack({ gap: 5, align: "start" })]}>
	<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
		<Button type="submit">Save changes</Button>
		<Button type="button" variant="outline" color="neutral">
			Discard
		</Button>
		<Button type="button" variant="ghost" color="danger">
			<Trash2Icon size={16} aria-hidden="true" />
			Delete project
		</Button>
		<Button type="button" isPending>
			Publishing
		</Button>
		<Button type="button" disabled>
			Merge blocked
		</Button>
	</div>

	<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
		<Button type="button" size="lg">
			Start free trial
		</Button>
		<Button type="button" size="md" variant="outline">
			Book a demo
		</Button>
		<Button type="button" size="sm" variant="ghost" color="neutral">
			Learn more
		</Button>
		<Button type="button" size="sm" aria-label="Invite a teammate">
			<PlusIcon size={16} />
		</Button>
	</div>

	<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
		<code
			id="preview-button-token"
			mix={[font("mono"), text("sm"), p(2, 3), rounded("md"), bg("neutral.tint")]}
		>
			sk_live_7Qm2X9cVb0
		</code>
		<Button
			type="button"
			variant="outline"
			color="neutral"
			size="sm"
			commandfor="preview-button-token"
			command={COPY_COMMAND}
			mix={[
				copyToClipboard(),
				on<HTMLButtonElement, "ui:copy">("ui:copy", (event) => {
					copyState = event.success ? "copied" : "refused";
					void handle.update();
				}),
			]}
		>
			{copyState === "copied" ? (
				<CheckIcon size={16} aria-hidden="true" />
			) : (
				<CopyIcon size={16} aria-hidden="true" />
			)}
			{COPY_LABELS[copyState]}
		</Button>
	</div>
</div>`;

/** The tone, size and pending vocabulary, plus a copy button that reaches the clipboard. */
export const ButtonPreview = clientEntry(import.meta.url, function ButtonPreview(handle: Handle) {
	let copyState: keyof typeof COPY_LABELS = "idle";

	return () => (
		<div mix={[vstack({ gap: 5, align: "start" })]}>
			<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
				<Button type="submit">Save changes</Button>
				<Button type="button" variant="outline" color="neutral">
					Discard
				</Button>
				<Button type="button" variant="ghost" color="danger">
					<Trash2Icon size={16} aria-hidden="true" />
					Delete project
				</Button>
				<Button type="button" isPending>
					Publishing
				</Button>
				<Button type="button" disabled>
					Merge blocked
				</Button>
			</div>

			<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
				<Button type="button" size="lg">
					Start free trial
				</Button>
				<Button type="button" size="md" variant="outline">
					Book a demo
				</Button>
				<Button type="button" size="sm" variant="ghost" color="neutral">
					Learn more
				</Button>
				<Button type="button" size="sm" aria-label="Invite a teammate">
					<PlusIcon size={16} />
				</Button>
			</div>

			<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
				<code
					id="preview-button-token"
					mix={[font("mono"), text("sm"), p(2, 3), rounded("md"), bg("neutral.tint")]}
				>
					sk_live_7Qm2X9cVb0
				</code>
				<Button
					type="button"
					variant="outline"
					color="neutral"
					size="sm"
					commandfor="preview-button-token"
					command={COPY_COMMAND}
					mix={[
						copyToClipboard(),
						on<HTMLButtonElement, "ui:copy">("ui:copy", (event) => {
							copyState = event.success ? "copied" : "refused";
							void handle.update();
						}),
					]}
				>
					{copyState === "copied" ? (
						<CheckIcon size={16} aria-hidden="true" />
					) : (
						<CopyIcon size={16} aria-hidden="true" />
					)}
					{COPY_LABELS[copyState]}
				</Button>
			</div>
		</div>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ButtonPreview /> };
