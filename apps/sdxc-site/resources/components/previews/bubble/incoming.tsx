/**
 * Live example for an incoming `Bubble`. The muted variant hugging the start edge is how
 * the other side of a conversation reads against the reader's own solid turns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Bubble } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Bubble variant="muted" align="start">
	<Bubble.Content>Hi! Could you resend the invoice for September? I cannot find it.</Bubble.Content>
</Bubble>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Incoming message",
	code: CODE,
	render: () => (
		<Bubble variant="muted" align="start">
			<Bubble.Content>
				Hi! Could you resend the invoice for September? I cannot find it.
			</Bubble.Content>
		</Bubble>
	),
};
