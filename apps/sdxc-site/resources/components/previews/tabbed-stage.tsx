/**
 * Live preview for `TabbedStage`: pill tabs over a full-width stage, then a vertical rail
 * of steps beside a sticky stage. Both switch with CSS alone, so they work before any
 * script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ActivityIcon, BellRingIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";
import { CodeStage, ProductFrame, TabbedStage } from "@sdxc/ui/patterns";

/** Monitors the dashboard panel lists, with the state their probes report. */
const MONITORS = [
	{ host: "api.beacon.dev", detail: "6 regions · 142 ms p95", status: "Operational" },
	{ host: "checkout.beacon.dev", detail: "eu-west · 1.8 s p95", status: "Degraded" },
	{ host: "status.beacon.dev", detail: "6 regions · 88 ms p95", status: "Operational" },
] as const;

/** The source the page shows, matching the markup below. */
const CODE = `<TabbedStage name="preview-stage" aria-label="Product views">
	<TabbedStage.Item value="monitors" label="Monitors" icon={<ActivityIcon />} defaultChecked>
		<MonitorList />
	</TabbedStage.Item>
	<TabbedStage.Item value="alerts" label="Alerts" icon={<BellRingIcon />}>
		<CodeStage variant="terminal" title="alerts.log">
			14:02 UTC eu-west checkout.beacon.dev 503, paged on-call
		</CodeStage>
	</TabbedStage.Item>
</TabbedStage>

<TabbedStage name="preview-rail" orientation="vertical" aria-label="From probe to page">
	<TabbedStage.Item
		value="watch"
		label="Watch every endpoint"
		description="Probes in six regions check each URL every thirty seconds."
		defaultChecked
	>
		<MonitorList />
	</TabbedStage.Item>
	<TabbedStage.Item
		value="confirm"
		label="Confirm before paging"
		description="A failure pages someone only when <strong>two regions agree</strong>."
	>
		<CodeStage variant="terminal" title="probes.log">…</CodeStage>
	</TabbedStage.Item>
	<TabbedStage.Item
		value="page"
		label="Page the right person"
		description="Alerts follow the rotation, and escalate after five quiet minutes."
	>
		<CodeStage variant="terminal" title="alerts.log">…</CodeStage>
	</TabbedStage.Item>
</TabbedStage>`;

/**
 * Dashboard panel the stages reveal: each monitor with its probe summary and status badge.
 *
 * @returns The render function producing the framed monitor list.
 */
function MonitorList() {
	return () => (
		<ProductFrame lights title="Monitors" url="app.beacon.dev">
			<ul mix={[raw({ listStyle: "none" }), m(0), p(0)]}>
				{MONITORS.map((monitor) => (
					<li
						key={monitor.host}
						mix={[
							hstack({ gap: 3, align: "center", justify: "between" }),
							p(3.5, 5),
							when("& + &", raw({ borderBlockStart: "1px solid var(--ui-marketing-hairline)" })),
						]}
					>
						<span mix={[vstack({ gap: 0.5, align: "start" })]}>
							<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
								{monitor.host}
							</span>
							<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>{monitor.detail}</span>
						</span>
						<Badge
							color={monitor.status === "Operational" ? "success" : "warning"}
							variant="secondary"
						>
							{monitor.status}
						</Badge>
					</li>
				))}
			</ul>
		</ProductFrame>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 16, align: "stretch" })]}>
			<TabbedStage name="preview-stage" aria-label="Product views">
				<TabbedStage.Item value="monitors" label="Monitors" icon={<ActivityIcon />} defaultChecked>
					<MonitorList />
				</TabbedStage.Item>
				<TabbedStage.Item value="alerts" label="Alerts" icon={<BellRingIcon />}>
					<CodeStage variant="terminal" title="alerts.log">
						14:02 UTC eu-west checkout.beacon.dev 503, paged on-call
					</CodeStage>
				</TabbedStage.Item>
			</TabbedStage>

			<TabbedStage name="preview-rail" orientation="vertical" aria-label="From probe to page">
				<TabbedStage.Item
					value="watch"
					label="Watch every endpoint"
					description="Probes in six regions check each URL every thirty seconds."
					defaultChecked
				>
					<MonitorList />
				</TabbedStage.Item>
				<TabbedStage.Item
					value="confirm"
					label="Confirm before paging"
					description={
						<>
							A failure pages someone only when <strong>two regions agree</strong>.
						</>
					}
				>
					<CodeStage variant="terminal" title="probes.log">
						{`14:02:11 eu-west   checkout.beacon.dev  503  1.8 s
14:02:14 us-east   checkout.beacon.dev  503  2.1 s
14:02:14 confirmed by 2 of 6 regions`}
					</CodeStage>
				</TabbedStage.Item>
				<TabbedStage.Item
					value="page"
					label="Page the right person"
					description="Alerts follow the rotation, and escalate after five quiet minutes."
				>
					<CodeStage variant="terminal" title="alerts.log">
						{`14:02:15 paged Ana Ruiz (primary, payments)
14:04:40 acknowledged by Ana Ruiz
14:07:02 escalation cancelled`}
					</CodeStage>
				</TabbedStage.Item>
			</TabbedStage>
		</div>
	),
};
