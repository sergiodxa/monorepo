/**
 * Live example for a split `FeatureBand`: checked claims beside a framed product shot,
 * the layout most product landings open with before they alternate sides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";
import { Badge, HeadingScope } from "@sdxc/ui";
import { FeatureBand, ProductFrame } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<FeatureBand
	layout="split"
	eyebrow="Incidents"
	title="Incidents write their own record"
	description="Every state change lands on the timeline as it happens."
	media={<ProductFrame lights title="Incident #482" url="app.beacon.dev">…</ProductFrame>}
>
	<ul>
		<li>Status changes posted as they happen</li>
		<li>Responders and acknowledgements recorded</li>
		<li>One link to share with customers</li>
	</ul>
</FeatureBand>`;

/** Rows the framed incident panel lists. */
const ROWS = [
	{ name: "Detected", detail: "eu-west · us-east", status: "Confirmed", color: "danger" as const },
	{ name: "Ana Ruiz", detail: "Primary · paged 14:02", status: "Acked", color: "success" as const },
	{
		name: "Status page",
		detail: "Posted 14:11",
		status: "Public",
		color: "neutral" as const,
	},
] as const;

/** What the preview registry reads: the title, the source to show, and the band to draw. */
export default {
	title: "Split with media on the end",
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<FeatureBand
				layout="split"
				eyebrow="Incidents"
				title="Incidents write their own record"
				description={
					<>
						Every state change lands on the timeline as it happens, so the{" "}
						<strong>post-mortem is already written</strong> when the page clears.
					</>
				}
				media={
					<ProductFrame lights title="Incident #482" url="app.beacon.dev">
						<ul mix={[raw({ listStyle: "none" }), m(0), p(0)]}>
							{ROWS.map((row) => (
								<li
									key={row.name}
									mix={[
										hstack({ gap: 3, align: "center", justify: "between" }),
										p(3.5, 5),
										when(
											"& + &",
											raw({ borderBlockStart: "1px solid var(--ui-landing-hairline)" }),
										),
									]}
								>
									<span mix={[vstack({ gap: 0.5, align: "start" })]}>
										<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
											{row.name}
										</span>
										<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>{row.detail}</span>
									</span>
									<Badge color={row.color} variant="secondary">
										{row.status}
									</Badge>
								</li>
							))}
						</ul>
					</ProductFrame>
				}
			>
				<ul>
					<li>Status changes posted as they happen</li>
					<li>Responders and acknowledgements recorded</li>
					<li>One link to share with customers</li>
				</ul>
			</FeatureBand>
		</HeadingScope>
	),
};
