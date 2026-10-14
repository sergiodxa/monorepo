/**
 * Live example for an unframed `Bubble` holding a formatted reply. The ghost variant drops
 * the frame so `Typeset`'s chat rhythm sets the paragraphs and list the way an assistant's
 * rendered Markdown reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Bubble, Typeset } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Bubble variant="ghost" align="start">
	<Bubble.Content>
		<Typeset preset="chat">
			<p>To invite a teammate to Acme:</p>
			<ol>
				<li>Open <strong>Settings → Members</strong>.</li>
				<li>Choose <strong>Invite</strong> and enter their email.</li>
				<li>Pick a role, then send the invitation.</li>
			</ol>
			<p>The link stays valid for <code>7</code> days.</p>
		</Typeset>
	</Bubble.Content>
</Bubble>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Formatted reply",
	code: CODE,
	render: () => (
		<Bubble variant="ghost" align="start">
			<Bubble.Content>
				<Typeset preset="chat">
					<p>To invite a teammate to Acme:</p>
					<ol>
						<li>
							Open <strong>Settings → Members</strong>.
						</li>
						<li>
							Choose <strong>Invite</strong> and enter their email.
						</li>
						<li>Pick a role, then send the invitation.</li>
					</ol>
					<p>
						The link stays valid for <code>7</code> days.
					</p>
				</Typeset>
			</Bubble.Content>
		</Bubble>
	),
};
