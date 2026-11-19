/**
 * Live preview island for `ReactionBar`. Reactions are a row of chips under a message, one
 * pressed because the reader is among its reactors; each is a submit button in its own form,
 * and `reactionSync()` makes a press flip the chip at once while the form posts behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { reactionSync } from "@sdxc/ui/chat";
import { ReactionBar } from "@sdxc/ui/chat/reaction-bar";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the form's address. */
const CODE = `<span hidden mix={[reactionSync()]} />

<ReactionBar aria-label="Reactions">
	<form method="post" action="/messages/42/reactions">
		<input type="hidden" name="emoji" value="🎉" />
		<ReactionBar.Reaction emoji="🎉" label="Party popper" count={4} pressed title="You, Mira, Theo and Kenji" />
	</form>
	<form method="post" action="/messages/42/reactions">
		<input type="hidden" name="emoji" value="👀" />
		<ReactionBar.Reaction emoji="👀" label="Eyes" count={1} title="Theo" />
	</form>
	<form method="post" action="/messages/42/reactions">
		<input type="hidden" name="emoji" value="🚀" />
		<ReactionBar.Reaction emoji="🚀" label="Rocket" count={2} title="Mira and Priya" />
	</form>
</ReactionBar>`;

/** Where the preview's chips post: the team chat demo's own reactions, which answer with a redirect. */
const ACTION = "/demo/apps/parley/c/general";

/** One chip and the form it posts. */
function Chip(
	handle: Handle<{ emoji: string; label: string; count: number; pressed?: boolean; title: string }>,
) {
	return () => {
		let { emoji, label, count, pressed, title } = handle.props;
		return (
			<form method="post" action={ACTION}>
				<input type="hidden" name="intent" value="react" />
				<input type="hidden" name="id" value="g5" />
				<input type="hidden" name="emoji" value={emoji} />
				<ReactionBar.Reaction
					emoji={emoji}
					label={label}
					count={count}
					pressed={pressed}
					title={title}
				/>
			</form>
		);
	};
}

/** A message's reactions, hydrated so a press flips in place. */
export const ReactionBarPreview = clientEntry(import.meta.url, function ReactionBarPreview() {
	return () => (
		<>
			<span hidden mix={[reactionSync()]} />
			<ReactionBar aria-label="Reactions">
				<Chip emoji="🎉" label="Party popper" count={4} pressed title="You, Mira, Theo and Kenji" />
				<Chip emoji="👀" label="Eyes" count={1} title="Theo" />
				<Chip emoji="🚀" label="Rocket" count={2} title="Mira and Priya" />
			</ReactionBar>
		</>
	);
});

export default { code: CODE, render: () => <ReactionBarPreview /> };
