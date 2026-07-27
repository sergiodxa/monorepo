/**
 * A single labeled figure inside a dashboard/detail-page stat row. `value` accepts
 * any node (not just text) since some stat cards render badges instead of a plain
 * number, e.g. the dashboard's SSL certificate counts.
 *
 * Composed from `@pkg/r3-ui`'s `Card` (the bordered, shadowed panel and its
 * `Card.Header` slot, which already stacks children in a column with a small gap —
 * exactly the "muted label, then big value" layout this card needs) plus `Text` for
 * both lines, muted-copy defaults for the label and an overridden size/weight/color
 * for the value. `@pkg/r3-ui` has no dedicated stat-card component, so this is a
 * composition rather than a single import.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Card, Text } from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";
import { basis, grow, shrink } from "@pkg/u/layout";
import { text, weight } from "@pkg/u/typography";

namespace StatCard {
	export interface Props {
		/**
		 * Usually plain text, but accepts any node so a card can italicize part of its
		 * label (e.g. the dashboard's "Slowest Endpoint" card naming the monitor).
		 */
		label: RemixNode;
		value: RemixNode;
	}
}

/** Renders a dashboard stat card with a muted label and a large value. */
export default function StatCard(handle: Handle<StatCard.Props>) {
	return () => (
		<Card mix={[grow(1), shrink(1), basis("160px")]}>
			<Card.Header>
				<Text>{handle.props.label}</Text>
				<Text mix={[text("2xl"), weight(700), fg("neutral.emphasis")]}>{handle.props.value}</Text>
			</Card.Header>
		</Card>
	);
}
