/**
 * Live example for `OptimisticToggle` with `variant="solid"`: a Follow pill that reads as
 * the row's one action, neutral while off and the brand's once pressed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { OptimisticToggle } from "@sdxc/ui/app/optimistic-toggle";

/** The source the page shows, matching the markup below. */
const CODE = `<OptimisticToggle
	action={\`/people/\${person.handle}/follow\`}
	name="following"
	pressed={person.following}
	variant="solid"
	labels={{ label: \`Follow \${person.name}\`, pressed: \`Unfollow \${person.name}\`, failed: "Failed" }}
	pressedContent="Following"
	unpressedContent="Follow"
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Solid",
	code: CODE,
	render: () => (
		<div mix={[raw({ display: "flex", gap: "0.75rem", alignItems: "center" })]}>
			{[
				{ handle: "hana", name: "Hana Sato", following: false },
				{ handle: "tomas", name: "Tomás Novák", following: true },
			].map((person) => (
				<OptimisticToggle
					action={`/examples/people/${person.handle}/follow`}
					name="following"
					pressed={person.following}
					variant="solid"
					labels={{
						label: `Follow ${person.name}`,
						pressed: `Unfollow ${person.name}`,
						failed: "Failed",
					}}
					pressedContent="Following"
					unpressedContent="Follow"
				/>
			))}
		</div>
	),
};
