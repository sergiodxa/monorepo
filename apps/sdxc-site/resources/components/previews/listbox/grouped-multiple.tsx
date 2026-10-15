/**
 * Live example for a `ListBox` that takes several choices under a section heading.
 * `multiple` renders each option as a native checkbox, so toggling rows and submitting
 * them with a form are the platform's and the example needs no island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { Header, ListBox, Section } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<ListBox aria-label="Notifications" multiple>
	<Section aria-labelledby="channels-heading">
		<Header id="channels-heading">Channels</Header>
		<ListBox.Item value="email" defaultChecked>Email</ListBox.Item>
		<ListBox.Item value="sms">SMS</ListBox.Item>
		<ListBox.Item value="push" defaultChecked>Push notifications</ListBox.Item>
	</Section>
</ListBox>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Several choices, grouped",
	code: CODE,
	render: () => (
		<ListBox aria-label="Notifications" multiple mix={[is("18rem")]}>
			<Section aria-labelledby="example-listbox-grouped-multiple-heading">
				<Header id="example-listbox-grouped-multiple-heading">Channels</Header>
				<ListBox.Item value="email" defaultChecked>
					Email
				</ListBox.Item>
				<ListBox.Item value="sms">SMS</ListBox.Item>
				<ListBox.Item value="push" defaultChecked>
					Push notifications
				</ListBox.Item>
			</Section>
		</ListBox>
	),
};
