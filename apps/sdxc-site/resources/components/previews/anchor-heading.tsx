/**
 * Live preview for `AnchorHeading`: two section headings inside docs prose, each showing
 * its `#` link on hover or keyboard focus and flashing when a jump lands on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { AnchorHeading, Typeset } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Typeset preset="docs">
	<AnchorHeading id="install" linkLabel="Link to Install">Install</AnchorHeading>
	<p>Add the package to your Worker.</p>
	<AnchorHeading id="configure" level={3} linkLabel="Link to Configure">Configure</AnchorHeading>
	<p>Set --ui-docs-scroll-margin to your sticky header's height.</p>
</Typeset>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<Typeset preset="docs">
				<AnchorHeading id="preview-install" linkLabel="Link to Install">
					Install
				</AnchorHeading>
				<p>Add the package to your Worker, then import the components a page needs.</p>
				<AnchorHeading id="preview-configure" level={3} linkLabel="Link to Configure">
					Configure
				</AnchorHeading>
				<p>Set the scroll margin to your sticky header's height so a jump clears it.</p>
			</Typeset>
		</div>
	),
};
