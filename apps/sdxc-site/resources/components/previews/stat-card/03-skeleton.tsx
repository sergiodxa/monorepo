/**
 * Live example for `StatCard.Skeleton`: placeholders standing in for stats that are still
 * loading, each exactly as tall as the card it replaces, so nothing below shifts when the
 * numbers arrive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { StatCard } from "@sdxc/ui/app/stat-card";

/** The source the page shows, matching the markup below. */
const CODE = `<StatCard.Group aria-label="Loading stats" aria-busy="true">
	<StatCard.Skeleton />
	<StatCard.Skeleton chart />
	<StatCard.Skeleton />
	<StatCard.Skeleton />
</StatCard.Group>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Loading",
	code: CODE,
	render: () => (
		<StatCard.Group aria-label="Loading stats" aria-busy="true">
			<StatCard.Skeleton />
			<StatCard.Skeleton chart />
			<StatCard.Skeleton />
			<StatCard.Skeleton />
		</StatCard.Group>
	),
};
