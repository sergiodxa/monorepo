/**
 * Live preview island for `ReactionBar`. Reactions are a row of chips under a message, one
 * pressed because the reader is among its reactors; each is a submit button, so the row is a
 * plain form that posts the toggle before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ReactionBar } from "@sdxc/ui/chat/reaction-bar";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `<form method="post" action="/messages/42/reactions">
	<input type="hidden" name="intent" value="react" />
	<ReactionBar aria-label="Reactions">
		<ReactionBar.Reaction
			name="emoji"
			value="🎉"
			emoji="🎉"
			count={4}
			pressed
			aria-label="Party popper, you and 3 more"
			title="You, Mira, Theo and Kenji reacted with 🎉"
		/>
		<ReactionBar.Reaction name="emoji" value="👀" emoji="👀" count={1} aria-label="Eyes, 1 reaction" />
		<ReactionBar.Reaction name="emoji" value="🚀" emoji="🚀" count={2} aria-label="Rocket, 2 reactions" />
	</ReactionBar>
</form>`;

/** A message's reactions, hydrated so the page loads this example's chunk alone. */
export const ReactionBarPreview = clientEntry(import.meta.url, function ReactionBarPreview() {
	return () => (
		<form method="dialog">
			<input type="hidden" name="intent" value="react" />
			<ReactionBar aria-label="Reactions">
				<ReactionBar.Reaction
					name="emoji"
					value="🎉"
					emoji="🎉"
					count={4}
					pressed
					aria-label="Party popper, you and 3 more"
					title="You, Mira, Theo and Kenji reacted with 🎉"
				/>
				<ReactionBar.Reaction
					name="emoji"
					value="👀"
					emoji="👀"
					count={1}
					aria-label="Eyes, 1 reaction"
				/>
				<ReactionBar.Reaction
					name="emoji"
					value="🚀"
					emoji="🚀"
					count={2}
					aria-label="Rocket, 2 reactions"
				/>
			</ReactionBar>
		</form>
	);
});

export default { code: CODE, render: () => <ReactionBarPreview /> };
