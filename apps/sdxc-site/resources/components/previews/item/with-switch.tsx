/**
 * Live example for an `Item` whose action is a `Switch`. The switch takes its accessible
 * name and description from the row's title and description by id, so the row's own text
 * labels the control; the native checkbox needs no island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Item, Switch } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Item>
	<Item.Content>
		<Item.Title id="email-title">Email notifications</Item.Title>
		<Item.Description id="email-description">
			Get a message when someone comments on a project you follow.
		</Item.Description>
	</Item.Content>
	<Item.Actions>
		<Switch
			name="emailNotifications"
			aria-labelledby="email-title"
			aria-describedby="email-description"
		/>
	</Item.Actions>
</Item>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "With a switch",
	code: CODE,
	render: () => (
		<Item>
			<Item.Content>
				<Item.Title id="example-item-with-switch-title">Email notifications</Item.Title>
				<Item.Description id="example-item-with-switch-description">
					Get a message when someone comments on a project you follow.
				</Item.Description>
			</Item.Content>
			<Item.Actions>
				<Switch
					name="example-item-with-switch"
					aria-labelledby="example-item-with-switch-title"
					aria-describedby="example-item-with-switch-description"
				/>
			</Item.Actions>
		</Item>
	),
};
