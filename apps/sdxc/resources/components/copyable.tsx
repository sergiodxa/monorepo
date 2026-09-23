/**
 * The `copyable` tag: one line of code with a button that puts it on the clipboard.
 * The line carries an id of its own and the button points at it, so the text copied is
 * exactly the text drawn, and the line still reads and selects when script never runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { hstack, items } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { CopyButton } from "~/resources/components/copy-button";

namespace Copyable {
	export interface Props extends MarkdownProps {}
}

/** Renders one copyable command line. */
export default function Copyable(handle: Handle<Copyable.Props>) {
	return () => {
		let valueId = `${handle.id}-value`;

		return (
			<div
				mix={[
					hstack({ gap: 3, justify: "between" }),
					items("center"),
					p(2, 2, 2, 4),
					rounded("lg"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
					bg("neutral.bg"),
				]}
			>
				<code id={valueId} mix={[font("mono"), text("sm"), fg("neutral.emphasis")]}>
					{handle.props.children}
				</code>
				<CopyButton target={valueId} />
			</div>
		);
	};
}
