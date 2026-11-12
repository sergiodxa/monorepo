/**
 * Live example for `Skeleton.Text`: a profile row's placeholder made from the row itself,
 * its name and bio laid out unseen under a bar per line, so the placeholder wraps where the
 * text will and the row lands at exactly its height.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Button } from "@sdxc/ui";
import { Skeleton } from "@sdxc/ui/app/skeleton";

/** The source the page shows, matching the markup below apart from the preview's sizing. */
const CODE = `<div aria-busy="true">
	<strong><Skeleton.Text>{person.name}</Skeleton.Text></strong>
	<p><Skeleton.Text>{person.bio}</Skeleton.Text></p>
	<Skeleton.Text block><Button size="sm">Follow</Button></Skeleton.Text>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Text",
	code: CODE,
	render: () => (
		<div
			aria-busy="true"
			aria-label="Loading profile"
			mix={[
				raw({
					display: "grid",
					gap: "0.5rem",
					justifyItems: "start",
					inlineSize: "min(100%, 22rem)",
				}),
			]}
		>
			<strong>
				<Skeleton.Text>Priya Raman</Skeleton.Text>
			</strong>
			<p mix={[raw({ margin: "0", lineHeight: "1.45" })]}>
				<Skeleton.Text>
					Browser engineer. Layout, text and the CSS you didn't know shipped. Threads about the
					platform.
				</Skeleton.Text>
			</p>
			<Skeleton.Text block>
				<Button size="sm" tabIndex={-1}>
					Follow
				</Button>
			</Skeleton.Text>
		</div>
	),
};
