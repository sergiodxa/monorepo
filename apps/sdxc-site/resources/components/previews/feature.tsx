/**
 * Live preview for `Feature`: three claim cells in a ruled `Feature.Grid`, each with an icon
 * well, a title and one line of support. The grid draws its hairlines from the gap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellRingIcon, GaugeIcon, GlobeIcon } from "@sdxc/icons";
import { is } from "@sdxc/u/size";
import { Feature, HeadingScope } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Feature.Grid columns={3}>
	<Feature>
		<Feature.Icon>
			<GlobeIcon />
		</Feature.Icon>
		<Feature.Title>Six probe regions</Feature.Title>
		<Feature.Description>Every check runs from three continents at once.</Feature.Description>
	</Feature>
	<Feature>
		<Feature.Icon>
			<BellRingIcon />
		</Feature.Icon>
		<Feature.Title>Alerts that agree</Feature.Title>
		<Feature.Description>A page fires only when two regions see the outage.</Feature.Description>
	</Feature>
	<Feature>
		<Feature.Icon>
			<GaugeIcon />
		</Feature.Icon>
		<Feature.Title>Latency, not just status</Feature.Title>
		<Feature.Description>Track response time per region as well as up or down.</Feature.Description>
	</Feature>
</Feature.Grid>`;

/** What the preview registry reads: the source to show, and the grid to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<HeadingScope>
				<Feature.Grid columns={3}>
					<Feature>
						<Feature.Icon>
							<GlobeIcon />
						</Feature.Icon>
						<Feature.Title>Six probe regions</Feature.Title>
						<Feature.Description>
							Every check runs from three continents at once.
						</Feature.Description>
					</Feature>
					<Feature>
						<Feature.Icon>
							<BellRingIcon />
						</Feature.Icon>
						<Feature.Title>Alerts that agree</Feature.Title>
						<Feature.Description>
							A page fires only when two regions see the outage.
						</Feature.Description>
					</Feature>
					<Feature>
						<Feature.Icon>
							<GaugeIcon />
						</Feature.Icon>
						<Feature.Title>Latency, not just status</Feature.Title>
						<Feature.Description>
							Track response time per region as well as up or down.
						</Feature.Description>
					</Feature>
				</Feature.Grid>
			</HeadingScope>
		</div>
	),
};
