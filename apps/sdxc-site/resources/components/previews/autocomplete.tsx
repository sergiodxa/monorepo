/**
 * Live preview for `Autocomplete`: a stays app's "Where to?" field over six destinations, each
 * with an icon and a line on what it is, suggested before typing and filtered as you type.
 * The picked destination's id rides along in a hidden `placeId` field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	BuildingIcon,
	LandmarkIcon,
	MapPinIcon,
	MountainIcon,
	TreePalmIcon,
	TreePineIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Autocomplete } from "@sdxc/ui/autocomplete";

/** The source the page shows, matching the markup below apart from the full option list. */
const CODE = `<form method="get" action="/stays">
	<Autocomplete
		id="where"
		name="where"
		label="Where to?"
		placeholder="Search destinations"
		heading="Suggested destinations"
		valueName="placeId"
		options={[
			{ value: "brl", label: "Brightwater Lake", description: "Lakeside cabins", icon: <TreePineIcon /> },
			{ value: "cap", label: "Calder Peaks", description: "Ski town", icon: <MountainIcon /> },
			// …
		]}
	/>
</form>`;

/** Six invented destinations, each with the glyph its kind of stay reads as. */
const DESTINATIONS: Array<Autocomplete.Option> = [
	{
		value: "brl",
		label: "Brightwater Lake",
		description: "Lakeside cabins, 2 h away",
		icon: <TreePineIcon />,
	},
	{
		value: "cap",
		label: "Calder Peaks",
		description: "Ski town in the north",
		icon: <MountainIcon />,
	},
	{
		value: "sor",
		label: "Sorrel Bay",
		description: "Beach houses and coves",
		icon: <TreePalmIcon />,
	},
	{
		value: "ost",
		label: "Old Stonegate",
		description: "Historic quarter, walkable",
		icon: <LandmarkIcon />,
	},
	{
		value: "har",
		label: "Harbour District",
		description: "City lofts near the water",
		icon: <BuildingIcon />,
	},
	{
		value: "fen",
		label: "Fenwick Hollow",
		description: "Village in the hills",
		icon: <MapPinIcon />,
	},
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<form
			method="get"
			action="#stays"
			mix={[raw({ inlineSize: "100%", maxInlineSize: "24rem", paddingBlock: "1.5rem" })]}
		>
			<Autocomplete
				id="preview-where"
				name="where"
				label="Where to?"
				placeholder="Search destinations"
				heading="Suggested destinations"
				valueName="placeId"
				options={DESTINATIONS}
			/>
		</form>
	),
};
