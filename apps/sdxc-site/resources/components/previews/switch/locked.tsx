/**
 * Live example for a `Switch` an app holds on and disabled, the shape a setting takes when
 * someone else manages it. The native `checked` and `disabled` attributes carry the whole
 * state, so the example renders before any script loads and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { Switch, Text } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[hstack({ gap: 3, align: "center" })]}>
	<Switch aria-label="Dark mode" checked disabled />
	<Text>Dark mode is set for everyone in the Acme organization.</Text>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Locked on",
	code: CODE,
	render: () => (
		<div mix={[hstack({ gap: 3, align: "center" })]}>
			<Switch aria-label="Dark mode" checked disabled />
			<Text>Dark mode is set for everyone in the Acme organization.</Text>
		</div>
	),
};
