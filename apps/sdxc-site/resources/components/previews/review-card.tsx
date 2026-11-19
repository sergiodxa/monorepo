/**
 * Live preview for `ReviewCard`: two reviews of a print, one verified with what was bought and
 * a helpful vote, one shorter with no title.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { ReviewCard } from "@sdxc/ui";

/** The source the page shows. */
const CODE = `<ReviewCard
	author="Maya R."
	rating={5}
	title="Better in person"
	body={<p>Heavy paper, rich colour, and the oak frame came without a scratch.</p>}
	date="2 weeks ago"
	verified="Verified buyer"
	meta="50×70 · Oak frame"
	helpful={
		<form method="post" action="/reviews/81/helpful">
			<button type="submit">Helpful (12)</button>
		</form>
	}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "34rem" })]}>
			<ReviewCard
				author="Maya R."
				rating={5}
				title="Better in person"
				body={<p>Heavy paper, rich colour, and the oak frame came without a scratch.</p>}
				date="2 weeks ago"
				verified="Verified buyer"
				meta="50×70 · Oak frame"
				helpful={
					<form method="post" action="#helpful">
						<button
							type="submit"
							mix={[
								raw({
									padding: "0.25rem 0.625rem",
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "999px",
									font: "inherit",
									color: "var(--ui-neutral-fg)",
									backgroundColor: "transparent",
									cursor: "pointer",
								}),
							]}
						>
							Helpful (12)
						</button>
					</form>
				}
			/>
			<ReviewCard
				author="Tomás"
				rating={4}
				body="Lovely print. Took a week longer than I hoped to arrive."
				date="1 month ago"
				meta="30×40 · Unframed"
			/>
		</div>
	),
};
