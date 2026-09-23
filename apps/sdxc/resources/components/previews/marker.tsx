/**
 * Live preview island for `Marker`. The row calls out what happened between two turns of
 * a conversation, so the preview is that sequence: the day divider a log opens with, a
 * delivery receipt, a bordered warning while the connection drops, a plain membership
 * note, and a generating row whose caption shimmers while a reply is still being written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CheckIcon, TriangleAlertIcon, UserPlusIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Marker, Spinner } from "@sdxc/ui";
import { textShimmer } from "@sdxc/ui/animations";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<div mix={[vstack({ gap: 4, align: "stretch" })]}>
	<Marker variant="separator">
		<Marker.Content>Today</Marker.Content>
	</Marker>

	<Marker color="success">
		<Marker.Icon>
			<CheckIcon />
		</Marker.Icon>
		<Marker.Content>Delivered · 14:02</Marker.Content>
	</Marker>

	<Marker>
		<Marker.Icon>
			<UserPlusIcon />
		</Marker.Icon>
		<Marker.Content>Ana joined the conversation</Marker.Content>
	</Marker>

	<Marker variant="border" color="warning">
		<Marker.Icon>
			<TriangleAlertIcon />
		</Marker.Icon>
		<Marker.Content>Reconnecting — messages will send once you are back online</Marker.Content>
	</Marker>

	<Marker>
		<Marker.Icon aria-hidden={undefined}>
			<Spinner size="sm" aria-label="Generating a reply" />
		</Marker.Icon>
		<Marker.Content mix={[textShimmer()]}>Generating a reply…</Marker.Content>
	</Marker>
</div>`;

/** A run of between-turn callouts, hydrated so the page loads this example's chunk alone. */
export const MarkerPreview = clientEntry(
	"/resources/components/previews/marker.tsx#MarkerPreview",
	function MarkerPreview() {
		return () => (
			<div mix={[vstack({ gap: 4, align: "stretch" }), is("26rem")]}>
				<Marker variant="separator">
					<Marker.Content>Today</Marker.Content>
				</Marker>

				<Marker color="success">
					<Marker.Icon>
						<CheckIcon />
					</Marker.Icon>
					<Marker.Content>Delivered · 14:02</Marker.Content>
				</Marker>

				<Marker>
					<Marker.Icon>
						<UserPlusIcon />
					</Marker.Icon>
					<Marker.Content>Ana joined the conversation</Marker.Content>
				</Marker>

				<Marker variant="border" color="warning">
					<Marker.Icon>
						<TriangleAlertIcon />
					</Marker.Icon>
					<Marker.Content>
						Reconnecting — messages will send once you are back online
					</Marker.Content>
				</Marker>

				<Marker>
					<Marker.Icon aria-hidden={undefined}>
						<Spinner size="sm" aria-label="Generating a reply" />
					</Marker.Icon>
					<Marker.Content mix={[textShimmer()]}>Generating a reply…</Marker.Content>
				</Marker>
			</div>
		);
	},
);

export default { code: CODE, render: () => <MarkerPreview /> };
