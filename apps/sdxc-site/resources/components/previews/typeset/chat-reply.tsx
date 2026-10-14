/**
 * Live example for `Typeset` under the `chat` preset, which tightens size, leading and
 * flow for a reply in a message thread. The layer is all CSS over the markup it wraps,
 * so the example is static server markup and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { Typeset } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Typeset preset="chat" mix={[is("100%"), maxIs("28rem")]}>
	<p>
		Your status page went down at 14:02 because the <code>api.acme.dev</code> check timed out
		three times in a row. Two things will stop it from paging you again:
	</p>
	<ul>
		<li>Raise the timeout to 10 seconds.</li>
		<li>Require two failed regions before an incident opens.</li>
	</ul>
	<p>Want me to apply both?</p>
</Typeset>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Chat reply",
	code: CODE,
	render: () => (
		<Typeset preset="chat" mix={[is("100%"), maxIs("28rem")]}>
			<p>
				Your status page went down at 14:02 because the <code>api.acme.dev</code> check timed out
				three times in a row. Two things will stop it from paging you again:
			</p>
			<ul>
				<li>Raise the timeout to 10 seconds.</li>
				<li>Require two failed regions before an incident opens.</li>
			</ul>
			<p>Want me to apply both?</p>
		</Typeset>
	),
};
