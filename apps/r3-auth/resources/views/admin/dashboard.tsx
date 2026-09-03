/**
 * The admin dashboard: three counts — registered clients, registered subjects, and
 * sessions that have not expired — as the landing view of the admin area, so the size
 * and liveness of the server is the first thing an administrator sees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { gap, grid, gridTemplate } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { Card, Text } from "@sdxc/ui";

import type { AdminView } from "~/app/http/view-models/admin";

import AdminLayout from "~/resources/layouts/admin";

namespace DashboardView {
	/** One count with its caption and the sentence explaining what it counts. */
	export interface Stat {
		label: string;
		value: number;
		description: string;
	}

	export interface Props {
		chrome: AdminView.Chrome;
		/** The three counts, named rather than listed, so each card is rendered once. */
		stats: { clients: Stat; subjects: Stat; sessions: Stat };
	}
}

/**
 * One count as a card: caption, the number, then the explanation. The caption
 * renders as `Text` and the count as `Card.Title`, keeping each at its
 * component's default type scale since `mix` overrides depend on stylesheet order.
 */
function StatCard(handle: Handle<DashboardView.Stat>) {
	return () => {
		let { label, value, description } = handle.props;

		return (
			<Card>
				<Card.Header>
					<Text>{label}</Text>
					<Card.Title>{String(value)}</Card.Title>
				</Card.Header>
				<Card.Content>
					<Card.Description mix={[m(0)]}>{description}</Card.Description>
				</Card.Content>
			</Card>
		);
	};
}

/** Renders the dashboard's counts, one card per statistic. */
export default function DashboardView(handle: Handle<DashboardView.Props>) {
	return () => (
		<AdminLayout chrome={handle.props.chrome}>
			<div
				mix={[
					grid(),
					gap(4),
					at("sm", gridTemplate({ columns: "repeat(2, minmax(0, 1fr))" })),
					at("lg", gridTemplate({ columns: "repeat(3, minmax(0, 1fr))" })),
				]}
			>
				<StatCard {...handle.props.stats.clients} />
				<StatCard {...handle.props.stats.subjects} />
				<StatCard {...handle.props.stats.sessions} />
			</div>
		</AdminLayout>
	);
}
