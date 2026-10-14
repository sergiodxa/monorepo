/**
 * The `stats` and `stat` tags: a strip of numbers across the frame, each in its own
 * ruled cell. A value is written as a `{% $name %}` hole wherever the collection can
 * count it, so the strip cannot drift from what it describes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { borderEdge, fg } from "@sdxc/u/color";
import { gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { balance, leading, text, tracking, weight } from "@sdxc/u/typography";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import Band from "~/resources/components/band";

namespace Stats {
	export interface Props extends MarkdownProps {}

	export interface StatProps extends MarkdownProps {
		/** What the number counts. */
		label: string;
	}
}

/** Renders the strip. */
export default function Stats(handle: Handle<Stats.Props>) {
	return () => (
		<Band spacing="none">
			<div
				mix={[
					grid(),
					gap(0),
					gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
					media("(min-width: 64rem)", gridTemplate({ columns: repeat(5, "minmax(0, 1fr)") })),
					when("& > *", [p(6, 5), media("(min-width: 48rem)", p(8, 8))]),
					when(
						"& > * + *",
						media(
							"(min-width: 64rem)",
							borderEdge("inline-start", { color: "neutral.border", width: 1, style: "solid" }),
						),
					),
				]}
			>
				{handle.props.children}
			</div>
		</Band>
	);
}

/** Renders one cell: the number, and what it counts. */
export function Stat(handle: Handle<Stats.StatProps>) {
	return () => (
		<div mix={[vstack({ gap: 1, align: "start" })]}>
			<span
				mix={[
					text("3xl"),
					weight("medium"),
					tracking("tight"),
					leading("none"),
					fg("neutral.emphasis"),
				]}
			>
				{handle.props.children}
			</span>
			<span mix={[text("sm"), leading("snug"), balance(), fg("neutral")]}>
				{handle.props.label}
			</span>
		</div>
	);
}
