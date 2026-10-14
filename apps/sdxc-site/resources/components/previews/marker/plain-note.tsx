/**
 * Live example for a `Marker` with no icon and no color: the quiet note a conversation
 * log drops in when someone joins. The row is static server markup, so the example needs
 * no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { Marker } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[is("26rem")]}>
	<Marker>
		<Marker.Content>Ana joined the conversation</Marker.Content>
	</Marker>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Plain note",
	code: CODE,
	render: () => (
		<div mix={[is("26rem")]}>
			<Marker>
				<Marker.Content>Ana joined the conversation</Marker.Content>
			</Marker>
		</div>
	),
};
