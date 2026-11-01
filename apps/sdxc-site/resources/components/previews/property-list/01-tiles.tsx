/**
 * Live example for `PropertyList` as tiles: a customer's headline figures two to a row,
 * each in its own bordered tile, falling back to one column in a narrow pane.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PropertyList } from "@sdxc/ui/property-list";

/** The source the page shows, matching the markup below. */
const CODE = `<PropertyList variant="tiles">
	<PropertyList.Item label="Plan">Team, yearly</PropertyList.Item>
	<PropertyList.Item label="Monthly revenue">$1,240</PropertyList.Item>
	<PropertyList.Item label="Seats">18 of 25</PropertyList.Item>
	<PropertyList.Item label="Open tickets" empty="None" />
</PropertyList>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Tiles",
	code: CODE,
	render: () => (
		<PropertyList variant="tiles">
			<PropertyList.Item label="Plan">Team, yearly</PropertyList.Item>
			<PropertyList.Item label="Monthly revenue">$1,240</PropertyList.Item>
			<PropertyList.Item label="Seats">18 of 25</PropertyList.Item>
			<PropertyList.Item label="Open tickets" empty="None" />
		</PropertyList>
	),
};
