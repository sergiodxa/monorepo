/**
 * Live example for the `separator` variant of `Marker`, the divider that opens each day
 * of a conversation log. The rules on either side stretch with the row, so the example
 * gives it a log's width; the markup is static and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { Marker } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[is("26rem")]}>
	<Marker variant="separator">
		<Marker.Content>Today</Marker.Content>
	</Marker>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Day separator",
	code: CODE,
	render: () => (
		<div mix={[is("26rem")]}>
			<Marker variant="separator">
				<Marker.Content>Today</Marker.Content>
			</Marker>
		</div>
	),
};
