/**
 * A single labeled figure inside a dashboard/detail-page stat row. `value`
 * accepts any node — plain text, a badge, or another status element — for
 * cards such as the dashboard's SSL certificate counts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { PlusIcon } from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { basis, flex, gap, grow, inlineFlex, items, justify, shrink } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Card, Text } from "@sdxc/ui";

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
 * Renders a dashboard stat card with a muted label and a large value. A
 * {@link StatCard.Props.create} link shares the label's line, the one line
 * with room to spare, keeping the icon clear of a value that runs the card's full width.
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
