/**
 * Live example for a disabled, checked `Checkbox`: an opt-in the reader keeps but can no
 * longer change. The native attributes carry the whole state, so the example is plain
 * server markup that needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Checkbox } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Checkbox disabled defaultChecked>Keep the classic Acme dashboard</Checkbox>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Disabled",
	code: CODE,
	render: () => (
		<Checkbox disabled defaultChecked>
			Keep the classic Acme dashboard
		</Checkbox>
	),
};
