/**
 * A single labeled figure inside a dashboard/detail-page stat row. `value` accepts
 * any node (not just text) since some stat cards render badges instead of a plain
 * number, e.g. the dashboard's SSL certificate counts.
 *
 * Composed from `@pkg/ui`'s `Card` (the bordered, shadowed panel and its
 * `Card.Header` slot, which already stacks children in a column with a small gap —
 * exactly the "muted label, then big value" layout this card needs) plus `Text` for
 * both lines, muted-copy defaults for the label and an overridden size/weight/color
 * for the value. `@pkg/ui` has no dedicated stat-card component, so this is a
 * composition rather than a single import.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { PlusIcon } from "@pkg/lucide-remix";
import { bg, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { basis, flex, gap, grow, inlineFlex, items, justify, shrink } from "@pkg/u/layout";
import { bs, is } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { text, weight } from "@pkg/u/typography";
import { Card, Text } from "@pkg/ui";

namespace StatCard {
	export interface Props {
		/**
		 * Usually plain text, but accepts any node so a card can italicize part of its
		 * label (e.g. the dashboard's "Slowest Endpoint" card naming the monitor).
		 */
		label: RemixNode;
		value: RemixNode;
		/**
		 * Where this card's own "add one of these" link goes, for a card counting things a
		 * visitor can create. Omit on a card counting something there is no form for.
		 */
		create?: { href: string; label: string };
	}
}

/**
 * Renders a dashboard stat card with a muted label and a large value.
 *
 * A card with a {@link StatCard.Props.create} link shares its label's line with it,
 * rather than having it laid over the corner: the label is the one line short enough to
 * give up the room, and a figure or a status breakdown running under an absolutely
 * positioned icon is exactly the collision this avoids having to tune per card.
 */
export default function StatCard(handle: Handle<StatCard.Props>) {
	return () => {
		let { label, value, create } = handle.props;

		return (
			<Card mix={[grow(1), shrink(1), basis("160px")]}>
				<Card.Header>
					{create ? (
						<div mix={[flex(), items("start"), justify("between"), gap("8px")]}>
							<Text>{label}</Text>
							<a
								href={create.href}
								aria-label={create.label}
								title={create.label}
								mix={[
									inlineFlex(),
									items("center"),
									justify("center"),
									is("28px"),
									bs("28px"),
									shrink(),
									rounded(),
									fg("neutral.muted"),
									hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
								]}
							>
								<PlusIcon size={16} strokeWidth={1.5} />
							</a>
						</div>
					) : (
						<Text>{label}</Text>
					)}
					<Text mix={[text("2xl"), weight(700), fg("neutral.emphasis")]}>{value}</Text>
				</Card.Header>
			</Card>
		);
	};
}
