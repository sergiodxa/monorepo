/**
 * Live example for a `Highlight` inside a search result's `Link`. The marks tint the
 * matched words in the warning color while keeping the link's own color and underline,
 * so the result still reads as one link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Highlight, Link } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Link href="/guides/routing">
	<Highlight
		segments={[
			{ text: "Nested ", match: false },
			{ text: "layouts", match: true },
			{ text: " with shared ", match: false },
			{ text: "layout", match: true },
			{ text: " data", match: false },
		]}
		color="warning"
	/>
</Link>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "In a search result link",
	code: CODE,
	render: () => (
		<Link href="/guides/routing">
			<Highlight
				segments={[
					{ text: "Nested ", match: false },
					{ text: "layouts", match: true },
					{ text: " with shared ", match: false },
					{ text: "layout", match: true },
					{ text: " data", match: false },
				]}
				color="warning"
			/>
		</Link>
	),
};
