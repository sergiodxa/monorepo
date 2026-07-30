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
import { visuallyHidden } from "@pkg/u/a11y";
import { border, bg, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { cursor } from "@pkg/u/general";
import { inlineFlex, items } from "@pkg/u/layout";
import { dark } from "@pkg/u/responsive";
import { p } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import { clientEntry, on } from "remix/ui";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type CopyButtonProps = { value: string; label?: string };

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
					inlineFlex(),
					items("center"),
					p(1, 2.5),
					rounded("md"),
					border({ color: "oklch(0.83 0.011 250)", width: 1, style: "solid" }),
					bg("transparent"),
					fg("inherit"),
					fontSize("0.8125rem"),
					cursor("pointer"),
					dark(border("oklch(0.42 0.012 250)")),
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
				{/* Keeps `value`'s text readable to the clipboard mixin while rendering no visible pixels. */}
				<span id={valueId} mix={[visuallyHidden()]}>
					{handle.props.value}
				</span>
			</button>
		);
	},
);

export default CopyButton;
