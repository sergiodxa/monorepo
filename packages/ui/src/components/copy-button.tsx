/**
 * Client island: the copy button a code block carries. It copies the text of the element
 * it names, swaps its glyph for a check and announces the copy, so the block it sits in
 * stays server HTML and only this button hydrates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { CheckIcon, CopyIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { inlineFlex, items, justify, shrink } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { clientEntry } from "remix/component";

import { copyFeedback } from "../mixins/copy-feedback.js";
import { COPY_COMMAND, copyToClipboard } from "../mixins/copy-to-clipboard.js";

/**
 * Props {@link CopyButton} serializes into the page for hydration, which is why they are
 * a `type`: `SerializableProps` rejects an interface.
 */
export type CopyButtonProps = {
	/** The `id` of the element whose text is copied. */
	target: string;
	/** The button's accessible name and tooltip, such as "Copy code". */
	label: string;
	/** What a screen reader announces once the text is on the clipboard, such as "Copied". */
	copiedLabel: string;
};

/**
 * Renders the button. The island loads from the bare `@sdxc/ui/copy-button` specifier,
 * which the app's browser entry maps to a dynamic import; until then the button is inert
 * and the code beside it stays selectable.
 *
 * @example
 * <pre><code id="install">npm add @sdxc/ui</code></pre>
 * <CopyButton target="install" label={t("code.copy")} copiedLabel={t("code.copied")} />
 */
export const CopyButton: EntryComponent<CopyButtonProps> = clientEntry(
	"@sdxc/ui/copy-button#CopyButton",
	function CopyButton(handle) {
		return () => {
			let { copiedLabel, label, target } = handle.props;

			return (
				<button
					type="button"
					data-slot="copy-button"
					aria-label={label}
					title={label}
					commandfor={target}
					command={COPY_COMMAND}
					mix={[
						inlineFlex(),
						items("center"),
						justify("center"),
						shrink(0),
						p(1.5),
						rounded("md"),
						bg("transparent"),
						fg("neutral"),
						cursor("pointer"),
						transition("color, background-color"),
						hover([fg("neutral.emphasis"), bg("neutral.bg-tint-hover")]),
						when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
						raw({
							border: 0,
							"& > [data-icon]": { display: "inline-flex" },
							'& > [data-icon="check"]': { display: "none" },
							'&[data-copied] > [data-icon="copy"]': { display: "none" },
							'&[data-copied] > [data-icon="check"]': { display: "inline-flex" },
						}),
						copyToClipboard(),
						copyFeedback(copiedLabel),
					]}
				>
					<span data-icon="copy">
						<CopyIcon size={16} aria-hidden="true" />
					</span>
					<span data-icon="check" mix={[fg("success")]}>
						<CheckIcon size={16} aria-hidden="true" />
					</span>
					<span role="status" mix={[visuallyHidden()]} />
				</button>
			);
		};
	},
);
