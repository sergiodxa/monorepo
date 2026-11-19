/**
 * Live preview island for `MentionMenu`. The menu lives inside a composer and opens on an
 * `@` that starts a word, so the preview is a team composer: type `@` to see the list, the
 * arrow keys to move, and Enter or Tab to write the handle without sending.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MentionPerson } from "@sdxc/ui/chat/mention-menu";

import { is } from "@sdxc/u/size";
import { Keyboard } from "@sdxc/ui";
import { Composer, ComposerSubmit } from "@sdxc/ui/chat";
import { MentionMenu } from "@sdxc/ui/chat/mention-menu";
import { clientEntry } from "remix/component";

/** The team the preview's composer can mention. */
const PEOPLE: MentionPerson[] = [
	{ id: "1", handle: "ana", name: "Ana Lima", detail: "Design", initials: "AL", color: "#7c3aed" },
	{
		id: "2",
		handle: "marco",
		name: "Marco Díaz",
		detail: "Backend",
		initials: "MD",
		color: "#0891b2",
	},
	{
		id: "3",
		handle: "mei",
		name: "Mei Tanaka",
		detail: "On call",
		initials: "MT",
		color: "#db2777",
	},
	{
		id: "4",
		handle: "sam",
		name: "Sam Okafor",
		detail: "Support",
		initials: "SO",
		color: "#ea580c",
	},
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<Composer method="post" action="/channels/general/messages">
	<Composer.Input name="body" aria-label="Message #general" placeholder="Message #general" />
	<MentionMenu
		people={[
			{ id: "1", handle: "ana", name: "Ana Lima", detail: "Design", initials: "AL", color: "#7c3aed" },
			{ id: "2", handle: "marco", name: "Marco Díaz", detail: "Backend", initials: "MD", color: "#0891b2" },
		]}
		labels={{ list: "People", empty: "Nobody matches" }}
	/>
	<Composer.Toolbar>
		<Composer.Hint>
			<Keyboard>@</Keyboard> to mention
		</Composer.Hint>
		<ComposerSubmit labels={{ send: "Send message", stop: "Stop" }} />
	</Composer.Toolbar>
</Composer>`;

/** A team composer with the mention menu, hydrated so the page loads this example's chunk alone. */
export const MentionMenuPreview = clientEntry(import.meta.url, function MentionMenuPreview() {
	return () => (
		<Composer method="post" action="/examples/mention-menu" mix={[is("26rem")]}>
			<Composer.Input name="body" aria-label="Message #general" placeholder="Message #general" />
			<MentionMenu people={PEOPLE} labels={{ list: "People", empty: "Nobody matches" }} />
			<Composer.Toolbar>
				<Composer.Hint>
					<Keyboard>@</Keyboard> to mention
				</Composer.Hint>
				<ComposerSubmit labels={{ send: "Send message", stop: "Stop" }} />
			</Composer.Toolbar>
		</Composer>
	);
});

export default { code: CODE, render: () => <MentionMenuPreview /> };
