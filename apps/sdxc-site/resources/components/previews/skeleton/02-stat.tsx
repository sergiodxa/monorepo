/**
 * Live example for `Skeleton.Stat`: placeholder cards drawn in the real stat card frame,
 * with the delta and chart bands the real cards have.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { Skeleton } from "@sdxc/ui/app/skeleton";

/** The source the page shows, matching the markup below. */
const CODE = `<div role="status" aria-busy="true" aria-label="Loading stats" mix={[hstack({ gap: 3, align: "start" })]}>
	<Skeleton.Stat delta />
	<Skeleton.Stat delta chart />
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Stat cards",
	code: CODE,
	render: () => (
		<div
			role="status"
			aria-busy="true"
			aria-label="Loading stats"
			mix={[hstack({ gap: 3, align: "start" })]}
		>
			<Skeleton.Stat delta />
			<Skeleton.Stat delta chart />
		</div>
	),
};
