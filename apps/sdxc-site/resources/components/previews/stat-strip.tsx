/**
 * Live preview for `StatStrip`: four proof figures with ruled seams. The strip reads its
 * own width, so it shows two columns in a narrow frame and five-up tracks in a wide one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { StatStrip } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<StatStrip>
	<StatStrip.Item label="Checks run every day">4.2M</StatStrip.Item>
	<StatStrip.Item label="Probe regions">6</StatStrip.Item>
	<StatStrip.Item label="Median alert latency">38s</StatStrip.Item>
	<StatStrip.Item label="Measured uptime">99.99%</StatStrip.Item>
</StatStrip>`;

/** What the preview registry reads: the source to show, and the strip to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<StatStrip>
				<StatStrip.Item label="Checks run every day">4.2M</StatStrip.Item>
				<StatStrip.Item label="Probe regions">6</StatStrip.Item>
				<StatStrip.Item label="Median alert latency">38s</StatStrip.Item>
				<StatStrip.Item label="Measured uptime">99.99%</StatStrip.Item>
			</StatStrip>
		</div>
	),
};
