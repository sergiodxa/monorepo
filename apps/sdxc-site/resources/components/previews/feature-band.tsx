/**
 * Live preview for `FeatureBand`: a stage band that walks a rail of steps beside rendered
 * product UI, then a timeline band that tells one incident from the first failed probe to
 * the all-clear. A band is a page-width surface, so each meets the preview's edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";
import { Badge, HeadingScope } from "@sdxc/ui";
import { FeatureBand, ProductFrame, StepList, TabbedStage } from "@sdxc/ui/patterns";

/** One row a framed panel lists: a name, a mono detail line and a status badge. */
interface Row {
	name: string;
	detail: string;
	status: string;
	color: Badge.Color;
}

/** Monitors the first stage panel lists. */
const MONITORS: Row[] = [
	{
		name: "api.beacon.dev",
		detail: "6 regions · 142 ms p95",
		status: "Operational",
		color: "success",
	},
	{
		name: "checkout.beacon.dev",
		detail: "eu-west · 1.8 s p95",
		status: "Degraded",
		color: "warning",
	},
	{
		name: "status.beacon.dev",
		detail: "6 regions · 88 ms p95",
		status: "Operational",
		color: "success",
	},
];

/** Regions the second stage panel lists while a failure is being confirmed. */
const PROBES: Row[] = [
	{ name: "eu-west", detail: "503 · 1.8 s · 14:02:11", status: "Failing", color: "danger" },
	{ name: "us-east", detail: "503 · 2.1 s · 14:02:14", status: "Failing", color: "danger" },
	{ name: "ap-south", detail: "200 · 212 ms · 14:02:13", status: "Passing", color: "success" },
];

/** On-call steps the third stage panel lists for the page that went out. */
const ESCALATION: Row[] = [
	{ name: "Ana Ruiz", detail: "Primary · paged 14:02", status: "Acknowledged", color: "success" },
	{
		name: "Kenji Mori",
		detail: "Secondary · after 5 min",
		status: "Standing by",
		color: "neutral",
	},
	{
		name: "#payments-oncall",
		detail: "Slack · posted 14:02",
		status: "Notified",
		color: "neutral",
	},
];

/** The source the page shows, matching the markup below. */
const CODE = `<FeatureBand
	layout="stage"
	id="how-it-works"
	eyebrow="How it works"
	title="From a failed probe to the right phone"
	description="Every alert is <strong>confirmed from two regions</strong> before it pages anyone."
>
	<TabbedStage.Item
		value="watch"
		label="Watch every endpoint"
		description="Probes in six regions check each URL every thirty seconds."
		defaultChecked
	>
		<Panel title="Monitors" rows={MONITORS} />
	</TabbedStage.Item>
	<TabbedStage.Item value="confirm" label="Confirm before paging" description="…">
		<Panel title="checkout.beacon.dev" rows={PROBES} />
	</TabbedStage.Item>
	<TabbedStage.Item value="page" label="Page the right person" description="…">
		<Panel title="Incident #2114" rows={ESCALATION} />
	</TabbedStage.Item>
</FeatureBand>

<FeatureBand
	layout="timeline"
	tone="tinted"
	eyebrow="Incident timeline"
	title="One incident, start to finish"
	description="Seventeen minutes from the first 503 to the all-clear on the status page."
>
	<StepList.Item meta="14:02 UTC" title="Checkout starts failing">…</StepList.Item>
	<StepList.Item meta="14:04 UTC" title="Ana acknowledges">…</StepList.Item>
	<StepList.Item meta="14:11 UTC" title="Status page updated">…</StepList.Item>
	<StepList.Item meta="14:19 UTC" title="Back to green">…</StepList.Item>
</FeatureBand>`;

/**
 * Props accepted by {@link Panel}.
 */
interface PanelProps {
	/** Window title in the frame's chrome bar. */
	title: string;
	/** Rows listed inside the frame. */
	rows: Row[];
}

/**
 * Framed product panel the stage reveals: a list of rows, each with a status badge.
 *
 * @param handle Runtime handle carrying the panel's title and rows.
 * @returns The render function producing the framed list.
 */
function Panel(handle: Handle<PanelProps>) {
	return () => (
		<ProductFrame lights title={handle.props.title} url="app.beacon.dev">
			<ul mix={[raw({ listStyle: "none" }), m(0), p(0)]}>
				{handle.props.rows.map((row) => (
					<li
						key={row.name}
						mix={[
							hstack({ gap: 3, align: "center", justify: "between" }),
							p(3.5, 5),
							when("& + &", raw({ borderBlockStart: "1px solid var(--ui-marketing-hairline)" })),
						]}
					>
						<span mix={[vstack({ gap: 0.5, align: "start" })]}>
							<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>{row.name}</span>
							<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>{row.detail}</span>
						</span>
						<Badge color={row.color} variant="secondary">
							{row.status}
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
	viewports: true,
	render: () => (
		<HeadingScope>
			<FeatureBand
				layout="stage"
				id="how-it-works"
				eyebrow="How it works"
				title="From a failed probe to the right phone"
				description={
					<>
						Every alert is <strong>confirmed from two regions</strong> before it pages anyone.
					</>
				}
			>
				<TabbedStage.Item
					value="watch"
					label="Watch every endpoint"
					description="Probes in six regions check each URL every thirty seconds."
					defaultChecked
				>
					<Panel title="Monitors" rows={MONITORS} />
				</TabbedStage.Item>
				<TabbedStage.Item
					value="confirm"
					label="Confirm before paging"
					description={
						<>
							A failure pages someone only when <strong>two regions agree</strong>, so one flaky
							network stays quiet.
						</>
					}
				>
					<Panel title="checkout.beacon.dev" rows={PROBES} />
				</TabbedStage.Item>
				<TabbedStage.Item
					value="page"
					label="Page the right person"
					description="Alerts follow the on-call rotation and escalate after five quiet minutes."
				>
					<Panel title="Incident #2114" rows={ESCALATION} />
				</TabbedStage.Item>
			</FeatureBand>

			<FeatureBand
				layout="timeline"
				tone="tinted"
				eyebrow="Incident timeline"
				title="One incident, start to finish"
				description="Seventeen minutes from the first 503 to the all-clear on the status page."
			>
				<StepList.Item
					meta="14:02 UTC"
					title="Checkout starts failing"
					media={<Panel title="checkout.beacon.dev" rows={PROBES} />}
				>
					Probes in eu-west and us-east both see <strong>503s from checkout</strong>, so the failure
					is confirmed three seconds after the first one.
				</StepList.Item>
				<StepList.Item
					meta="14:04 UTC"
					title="Ana acknowledges"
					media={<Panel title="Incident #2114" rows={ESCALATION} />}
				>
					The page carries the failing regions, the response body and the deploy that went out at
					13:58, so Ana starts with <strong>the likely cause</strong>.
				</StepList.Item>
				<StepList.Item meta="14:11 UTC" title="Status page updated">
					Customers on the status page see “Checkout is failing for some card payments” and can
					subscribe to updates.
				</StepList.Item>
				<StepList.Item meta="14:19 UTC" title="Back to green">
					The rollback lands, all six regions pass, and subscribers get the all-clear with the
					incident’s duration.
				</StepList.Item>
			</FeatureBand>
		</HeadingScope>
	),
};
