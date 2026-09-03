/**
 * Client island: copies a value to the clipboard on click, with a brief "Copied!"
 * label swap. The only client-side interactivity for one-time secret reveals (API
 * keys) and copyable snippets (cron-job ping URLs), per the approved-islands list.
 *
 * Renders {@link CopyButtonProps.value} into a visually-hidden carrier `<span>`
 * inside its own host and points `commandfor` at it, so `@sdxc/ui/mixins`'
 * `copyToClipboard()` — built to copy whatever element its button's `commandfor`
 * targets — always has a same-instance target to read from, regardless of
 * whether `value` also happens to be visible in a sibling element.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { intl } from "@sdxc/i18n/ui";
import { visuallyHidden } from "@sdxc/u/a11y";
import { border, bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { inlineFlex, items } from "@sdxc/u/layout";
import { dark } from "@sdxc/u/responsive";
import { p } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { COPY_COMMAND, copyToClipboard } from "@sdxc/ui/mixins";
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
						void handle.update();
						setTimeout(() => {
							copied = false;
							void handle.update();
						}, 2000);
					}),
				]}
			>
				{copied
					? intl(handle).t("components.copyButton.copied")
					: (handle.props.label ?? intl(handle).t("components.copyButton.label"))}
				<span id={valueId} mix={[visuallyHidden()]}>
					{handle.props.value}
				</span>
			</button>
		);
	},
);

export default CopyButton;
