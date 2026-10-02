/**
 * Live preview island for `Meter`. A meter reports a level that is already what it is,
 * so the preview is the plan-usage panel an app puts them in: three gauges reading the
 * same account, each in the colour its level earns, and one carrying `low`/`high`/
 * `optimum` so the browser's own bands decide how it reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Header, Meter } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<div mix={[vstack({ gap: 5, align: "stretch" })]}>
	<Header mix={[m(0)]}>Usage this month</Header>

	<Meter>
		<div mix={[hstack({ gap: 2, justify: "between" })]}>
			<span mix={[text("sm"), weight("medium")]}>Storage</span>
			<Meter.ValueLabel>4.5 GB of 10 GB</Meter.ValueLabel>
		</div>
		<Meter.Indicator value={45} max={100} aria-label="Storage used" />
	</Meter>

	<Meter>
		<div mix={[hstack({ gap: 2, justify: "between" })]}>
			<span mix={[text("sm"), weight("medium")]}>Bandwidth</span>
			<Meter.ValueLabel>920 GB of 1 TB</Meter.ValueLabel>
		</div>
		<Meter.Indicator color="danger" value={92} aria-label="Bandwidth used" />
	</Meter>

	<Meter>
		<div mix={[hstack({ gap: 2, justify: "between" })]}>
			<span mix={[text("sm"), weight("medium")]}>Seats</span>
			<Meter.ValueLabel>8 of 10 in use</Meter.ValueLabel>
		</div>
		<Meter.Indicator
			color="success"
			value={8}
			low={3}
			high={9}
			optimum={10}
			max={10}
			aria-label="Seats in use"
		/>
	</Meter>
</div>`;

/** A plan-usage panel, hydrated so the page loads this example's chunk alone. */
export const MeterPreview = clientEntry(
	"/resources/components/previews/meter.tsx#MeterPreview",
	function MeterPreview() {
		return () => (
			<div mix={[vstack({ gap: 5, align: "stretch" }), is("22rem")]}>
				<Header mix={[m(0)]}>Usage this month</Header>

				<Meter>
					<div mix={[hstack({ gap: 2, justify: "between" })]}>
						<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>Storage</span>
						<Meter.ValueLabel>4.5 GB of 10 GB</Meter.ValueLabel>
					</div>
					<Meter.Indicator value={45} max={100} aria-label="Storage used" />
				</Meter>

				<Meter>
					<div mix={[hstack({ gap: 2, justify: "between" })]}>
						<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>Bandwidth</span>
						<Meter.ValueLabel>920 GB of 1 TB</Meter.ValueLabel>
					</div>
					<Meter.Indicator color="danger" value={92} aria-label="Bandwidth used" />
				</Meter>

				<Meter>
					<div mix={[hstack({ gap: 2, justify: "between" })]}>
						<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>Seats</span>
						<Meter.ValueLabel>8 of 10 in use</Meter.ValueLabel>
					</div>
					<Meter.Indicator
						color="success"
						value={8}
						low={3}
						high={9}
						optimum={10}
						max={10}
						aria-label="Seats in use"
					/>
				</Meter>
			</div>
		);
	},
);

export default { code: CODE, render: () => <MeterPreview /> };
