/**
 * Live preview for `Callout`: a warning that a guide cannot afford to let a reader skim
 * past, and a titled tip beside it, the two kinds a page most often reaches for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Callout } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Callout kind="warning" label="Warning">
	<p>Rotating the signing key logs every user out. Deploy the new key before you remove the old one.</p>
</Callout>

<Callout kind="tip" label="Tip" title="Faster local runs">
	<p>Pass <code>--watch</code> and only the tests touching a changed file run again.</p>
</Callout>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 4, align: "stretch" })]}>
			<Callout kind="warning" label="Warning">
				<p>
					Rotating the signing key logs every user out. Deploy the new key before you remove the old
					one.
				</p>
			</Callout>
			<Callout kind="tip" label="Tip" title="Faster local runs">
				<p>
					Pass <code>--watch</code> and only the tests touching a changed file run again.
				</p>
			</Callout>
		</div>
	),
};
