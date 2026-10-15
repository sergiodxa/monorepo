/**
 * Live example for a `GridList` laid out as tiles. `layout="grid"` wraps the rows into two
 * columns and adds more as the list's own container widens, so the gallery reflows by
 * its width alone and renders as plain server markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ImageIcon } from "@sdxc/icons";
import { is } from "@sdxc/u/size";
import { GridList } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from ids and the preview's sizing. */
const CODE = `<GridList aria-label="Gallery" layout="grid">
	<GridList.Item id="photo-1">
		<ImageIcon />
		Sunset
	</GridList.Item>
	<GridList.Item id="photo-2">
		<ImageIcon />
		Harbor
	</GridList.Item>
	<GridList.Item id="photo-3">
		<ImageIcon />
		Lighthouse
	</GridList.Item>
	<GridList.Item id="photo-4">
		<ImageIcon />
		Old town
	</GridList.Item>
</GridList>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Grid layout",
	code: CODE,
	render: () => (
		<GridList aria-label="Gallery" layout="grid" mix={[is("24rem")]}>
			<GridList.Item id="example-grid-list-grid-layout-photo-1">
				<ImageIcon />
				Sunset
			</GridList.Item>
			<GridList.Item id="example-grid-list-grid-layout-photo-2">
				<ImageIcon />
				Harbor
			</GridList.Item>
			<GridList.Item id="example-grid-list-grid-layout-photo-3">
				<ImageIcon />
				Lighthouse
			</GridList.Item>
			<GridList.Item id="example-grid-list-grid-layout-photo-4">
				<ImageIcon />
				Old town
			</GridList.Item>
		</GridList>
	),
};
