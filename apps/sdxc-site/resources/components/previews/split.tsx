/**
 * Live preview for `Split`: claims with brand checks on the wide track and a framed incident
 * timeline beside them that bleeds past the measure. The columns stack, and the bleed stops,
 * once the split's own width is too narrow for two.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, m, p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { Badge, Split } from "@sdxc/ui";
import { ProductFrame } from "@sdxc/ui/patterns";

/** The incident timeline the framed media lists, oldest first. */
const TIMELINE = [
	{ time: "14:02", event: "Latency above 800 ms p95 from fra and ams" },
	{ time: "14:03", event: "Paged Dana Ruiz (primary on-call)" },
	{ time: "14:05", event: "Acknowledged · status page set to Investigating" },
	{ time: "14:19", event: "Rolled back api@4.18.2 in eu-west" },
] as const;

/** The source the page shows, matching the markup below. */
const CODE = `<Split lean="copy">
	<Split.Copy checks>
		<p>Every incident writes its own timeline, so the postmortem starts half done.</p>
		<ul>
			<li>Status changes posted as they happen</li>
			<li>Responders and acknowledgements recorded</li>
			<li>One link to share with customers</li>
		</ul>
	</Split.Copy>
	<Split.Media bleed="end">
		<ProductFrame lights title="Elevated API latency in eu-west">
			{timeline}
		</ProductFrame>
	</Split.Media>
</Split>`;

/** What the preview registry reads: the source to show, and the split to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), raw({ overflowX: "clip" })]}>
			<Split lean="copy">
				<Split.Copy checks>
					<p mix={[m(0), text("base"), fg("neutral")]}>
						Every incident writes its own timeline, so the postmortem starts half done.
					</p>
					<ul>
						<li>Status changes posted as they happen</li>
						<li>Responders and acknowledgements recorded</li>
						<li>One link to share with customers</li>
					</ul>
				</Split.Copy>
				<Split.Media bleed="end">
					<ProductFrame lights title="Elevated API latency in eu-west">
						<div mix={[vstack({ gap: 3, align: "stretch" }), p(5)]}>
							<span>
								<Badge color="warning" variant="secondary">
									Investigating
								</Badge>
							</span>
							<ol
								mix={[
									vstack({ gap: 2, align: "stretch" }),
									raw({ listStyle: "none", margin: "0", padding: "0" }),
								]}
							>
								{TIMELINE.map((entry) => (
									<li mix={[hstack({ gap: 3, align: "baseline" })]}>
										<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>{entry.time}</span>
										<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>
											{entry.event}
										</span>
									</li>
								))}
							</ol>
						</div>
					</ProductFrame>
				</Split.Media>
			</Split>
		</div>
	),
};
