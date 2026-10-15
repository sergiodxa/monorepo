/**
 * Live example for a success `Alert` announced assertively. `live` sets the host's
 * `aria-live` politeness, so a confirmation that replaces a form is read out at once; the
 * markup is what a server re-render produces after the save.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Alert } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Alert color="success" live="assertive">
	<Alert.Content>
		<Alert.Title>Your profile changes are saved</Alert.Title>
	</Alert.Content>
</Alert>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Saved confirmation",
	code: CODE,
	render: () => (
		<Alert color="success" live="assertive">
			<Alert.Content>
				<Alert.Title>Your profile changes are saved</Alert.Title>
			</Alert.Content>
		</Alert>
	),
};
