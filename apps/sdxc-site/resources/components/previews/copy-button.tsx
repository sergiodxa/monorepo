/**
 * Live preview for `CopyButton`: an API key field with the button beside it. Pressing it
 * copies the key, swaps the glyph for a check and announces "Copied".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { CopyButton, Input } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Input id="api-key" readOnly value="up_test_4f9c2a7e1b" aria-label="API key" />
<CopyButton target="api-key" label="Copy API key" copiedLabel="Copied" />`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[hstack({ gap: 2, align: "center" })]}>
			<Input id="api-key" readOnly value="up_test_4f9c2a7e1b" aria-label="API key" />
			<CopyButton target="api-key" label="Copy API key" copiedLabel="Copied" />
		</div>
	),
};
