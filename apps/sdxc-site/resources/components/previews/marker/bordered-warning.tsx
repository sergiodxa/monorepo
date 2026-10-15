/**
 * Live example for a bordered `Marker` in the warning color, the row a chat shows while
 * its connection drops. The border sets it apart from the routine notes around it, and
 * the markup is static, so the example needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TriangleAlertIcon } from "@sdxc/icons";
import { is } from "@sdxc/u/size";
import { Marker } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[is("26rem")]}>
	<Marker variant="border" color="warning">
		<Marker.Icon>
			<TriangleAlertIcon />
		</Marker.Icon>
		<Marker.Content>Reconnecting — messages will send once you are back online</Marker.Content>
	</Marker>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Bordered warning",
	code: CODE,
	render: () => (
		<div mix={[is("26rem")]}>
			<Marker variant="border" color="warning">
				<Marker.Icon>
					<TriangleAlertIcon />
				</Marker.Icon>
				<Marker.Content>Reconnecting — messages will send once you are back online</Marker.Content>
			</Marker>
		</div>
	),
};
