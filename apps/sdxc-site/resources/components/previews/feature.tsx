/**
 * Live preview for `Feature`: three uptime claims as separate cards in a `Feature.Grid`,
 * each led by a quiet icon tile, with the phrase that carries the claim in the heading ink.
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
		<Feature.Description>
			<p>Every check runs from <strong>three continents at once</strong>, so a regional blip never pages you.</p>
		</Feature.Description>
	</Feature>
	<Feature>
		<Feature.Icon>
			<BellRingIcon />
		</Feature.Icon>
		<Feature.Title>Alerts that agree</Feature.Title>
		<Feature.Description>
			<p>An incident opens only when <strong>two regions see the outage</strong>, then routes to whoever is on call.</p>
		</Feature.Description>
	</Feature>
	<Feature>
		<Feature.Icon>
			<GaugeIcon />
		</Feature.Icon>
		<Feature.Title>Latency, not just status</Feature.Title>
		<Feature.Description>
			<p>Track <strong>response time per region</strong> and publish it on your status page.</p>
		</Feature.Description>
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
							<p>
								Every check runs from <strong>three continents at once</strong>, so a regional blip
								never pages you.
							</p>
						</Feature.Description>
					</Feature>
					<Feature>
						<Feature.Icon>
							<BellRingIcon />
						</Feature.Icon>
						<Feature.Title>Alerts that agree</Feature.Title>
						<Feature.Description>
							<p>
								An incident opens only when <strong>two regions see the outage</strong>, then routes
								to whoever is on call.
							</p>
						</Feature.Description>
					</Feature>
					<Feature>
						<Feature.Icon>
							<GaugeIcon />
						</Feature.Icon>
						<Feature.Title>Latency, not just status</Feature.Title>
						<Feature.Description>
							<p>
								Track <strong>response time per region</strong> and publish it on your status page.
							</p>
						</Feature.Description>
					</Feature>
				</Feature.Grid>
			</HeadingScope>
		</div>
	),
};
