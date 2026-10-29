/**
 * The `stats` and `stat` tags: a strip of numbers across the frame, each in its own
 * ruled cell. A value is written as a `{% $name %}` hole wherever the collection can
 * count it, so the strip cannot drift from what it describes. Built on {@link StatStrip}
 * inside a flush Band.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { StatStrip } from "@sdxc/ui";

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
			<StatStrip>{handle.props.children}</StatStrip>
		</Band>
	);
}

/** Renders one cell: the number, and what it counts. */
export function Stat(handle: Handle<Stats.StatProps>) {
	return () => <StatStrip.Item label={handle.props.label}>{handle.props.children}</StatStrip.Item>;
}
