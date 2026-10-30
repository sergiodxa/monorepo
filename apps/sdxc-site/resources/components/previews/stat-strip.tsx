/**
 * Live preview for `StatStrip`: four proof figures with ruled seams, then three on the
 * unruled `gap` seam. The strip reads its own width, so it shows two columns in a narrow
 * frame, with an odd last figure spanning both, and one row from the `lg` container.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { StatStrip } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<StatStrip>
	<StatStrip.Item label="Checks run every day">4.2M</StatStrip.Item>
	<StatStrip.Item label="Probe regions">6</StatStrip.Item>
	<StatStrip.Item label="Median alert latency">38s</StatStrip.Item>
	<StatStrip.Item label="Measured uptime">99.99%</StatStrip.Item>
</StatStrip>

<StatStrip variant="gap">
	<StatStrip.Item label="Status pages published">12,400</StatStrip.Item>
	<StatStrip.Item label="Incidents resolved last month">3,180</StatStrip.Item>
	<StatStrip.Item label="Median time to acknowledge">2m 40s</StatStrip.Item>
</StatStrip>`;

/** What the preview registry reads: the source to show, and the strips to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 12, align: "stretch" })]}>
			<StatStrip>
				<StatStrip.Item label="Checks run every day">4.2M</StatStrip.Item>
				<StatStrip.Item label="Probe regions">6</StatStrip.Item>
				<StatStrip.Item label="Median alert latency">38s</StatStrip.Item>
				<StatStrip.Item label="Measured uptime">99.99%</StatStrip.Item>
			</StatStrip>
			<StatStrip variant="gap">
				<StatStrip.Item label="Status pages published">12,400</StatStrip.Item>
				<StatStrip.Item label="Incidents resolved last month">3,180</StatStrip.Item>
				<StatStrip.Item label="Median time to acknowledge">2m 40s</StatStrip.Item>
			</StatStrip>
		</div>
	),
};
