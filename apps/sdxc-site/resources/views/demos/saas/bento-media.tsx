/**
 * The small product scenes the Keel bento leads each cell with: the customer portal,
 * tax rates, one price in four currencies, webhook deliveries, and recognized against
 * deferred revenue. Each fills the cell's media slot, which fades it into the copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { bs, is, p } from "@sdxc/u/size";
import { font, tabularNums, text, weight } from "@sdxc/u/typography";
import { Badge, Button } from "@sdxc/ui";
import { marketingSurface } from "@sdxc/ui/styles";

/** Tax rates the tax scene lists: jurisdiction and rate. Eight fill two rows of four. */
const TAX_RATES = [
	["DE", "19%"],
	["FR", "20%"],
	["GB", "20%"],
	["NL", "21%"],
	["AU", "10%"],
	["JP", "10%"],
	["CA-ON", "13%"],
	["SG", "9%"],
] as const;

/** One monthly price as each currency's customers see it. */
const CURRENCIES = [
	["USD", "$1,240.00"],
	["EUR", "€1,148.00"],
	["GBP", "£982.00"],
	["JPY", "¥186,000"],
] as const;

/** Webhook deliveries, newest first: event, status and latency. */
const DELIVERIES = [
	["invoice.finalized", "200", "84 ms"],
	["usage.threshold", "200", "61 ms"],
	["payment.recovered", "200", "92 ms"],
	["customer.updated", "200", "57 ms"],
] as const;

/** Twelve months of revenue, recognized and still deferred, in thousands. */
const RECOGNITION = [
	[40, 120],
	[78, 104],
	[112, 96],
	[150, 90],
	[184, 88],
	[220, 80],
	[252, 78],
	[290, 70],
	[322, 66],
	[356, 60],
	[388, 56],
	[420, 52],
] as const;

/**
 * The customer portal a Keel customer's own users see: their plan, how much of the
 * month's commitment they have used, and the two actions they take most.
 *
 * @returns The render function producing the scene.
 */
export function PortalScene() {
	return () => (
		<div mix={[p(6, 6, 0, 6), raw({ display: "grid", placeItems: "end center" })]}>
			<div
				mix={[
					marketingSurface(),
					vstack({ gap: 3, align: "stretch" }),
					p(4),
					is("min(100%, 20rem)"),
					text("sm"),
				]}
			>
				<span mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
					<span mix={[weight("semibold"), fg("neutral.emphasis")]}>Growth plan</span>
					<Badge color="brand" variant="secondary">
						Renews Nov 1
					</Badge>
				</span>
				<span mix={[vstack({ gap: 1.5, align: "stretch" })]}>
					<span mix={[hstack({ gap: 2, justify: "between" }), text("xs"), fg("neutral")]}>
						<span>API requests</span>
						<span mix={[tabularNums()]}>7.6M of 10M</span>
					</span>
					<span
						mix={[
							bs("0.5rem"),
							bg("neutral.bg-tint-hover"),
							raw({ borderRadius: "9999px", overflow: "hidden" }),
						]}
					>
						<span
							mix={[
								raw({
									display: "block",
									blockSize: "100%",
									inlineSize: "76%",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-color-brand-500)",
								}),
							]}
						/>
					</span>
				</span>
				<span inert mix={[hstack({ gap: 2, align: "center" })]}>
					<Button size="sm" color="brand">
						Change plan
					</Button>
					<Button size="sm" variant="surface">
						Invoices
					</Button>
				</span>
			</div>
		</div>
	);
}

/**
 * Tax rates as chips, one per jurisdiction, the way an invoice picks them by the
 * customer's address. A fixed grid of four columns keeps both rows full at every width.
 *
 * @returns The render function producing the scene.
 */
export function TaxScene() {
	return () => (
		<div
			mix={[
				p(6),
				raw({
					display: "grid",
					gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
					gap: "0.5rem",
					alignContent: "end",
				}),
			]}
		>
			{TAX_RATES.map(([region, rate]) => (
				<span
					key={region}
					mix={[
						vstack({ gap: 0.5, align: "start" }),
						p(1.5, 2),
						raw({
							minInlineSize: 0,
							borderRadius: "0.375rem",
							backgroundColor: "var(--ui-surface-raised)",
							boxShadow: "var(--ui-shadow-surface)",
						}),
						text("xs"),
					]}
				>
					<span mix={[font("mono"), weight("semibold"), fg("neutral.emphasis")]}>{region}</span>
					<span mix={[fg("neutral"), tabularNums()]}>{rate}</span>
				</span>
			))}
		</div>
	);
}

/**
 * One price in four currencies, each a row with its code, set in tabular figures.
 *
 * @returns The render function producing the scene.
 */
export function CurrencyScene() {
	return () => (
		<div mix={[p(6, 6, 0, 6), raw({ display: "grid", alignContent: "end" })]}>
			<div mix={[marketingSurface(), vstack({ gap: 0, align: "stretch" }), text("sm")]}>
				{CURRENCIES.map(([code, amount], index) => (
					<span
						key={code}
						mix={[
							hstack({ gap: 3, align: "center", justify: "between" }),
							p(2.5, 4),
							raw({
								borderBlockStart: index === 0 ? "none" : "1px solid var(--ui-marketing-hairline)",
							}),
						]}
					>
						<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>{code}</span>
						<span mix={[weight("medium"), fg("neutral.emphasis"), tabularNums()]}>{amount}</span>
					</span>
				))}
			</div>
		</div>
	);
}

/**
 * Webhook deliveries as a log: event name, response status and latency. The rows share
 * one subgrid, so the event column is as wide as the longest name and the figures align.
 *
 * @returns The render function producing the scene.
 */
export function WebhookScene() {
	return () => (
		<div mix={[p(6, 6, 0, 6), raw({ display: "grid", alignContent: "end" })]}>
			<div
				mix={[
					marketingSurface(),
					raw({ display: "grid", gridTemplateColumns: "minmax(max-content, 1fr) auto auto" }),
					font("mono"),
					text("xs"),
				]}
			>
				{DELIVERIES.map(([event, status, latency], index) => (
					<span
						key={event}
						mix={[
							raw({
								display: "grid",
								gridColumn: "1 / -1",
								gridTemplateColumns: "subgrid",
								columnGap: "0.75rem",
								alignItems: "center",
								borderBlockStart: index === 0 ? "none" : "1px solid var(--ui-marketing-hairline)",
							}),
							p(2.5, 4),
						]}
					>
						<span mix={[fg("neutral.emphasis")]}>{event}</span>
						<span mix={[fg("success"), raw({ justifySelf: "end" })]}>{status}</span>
						<span mix={[fg("neutral.muted"), raw({ justifySelf: "end" })]}>{latency}</span>
					</span>
				))}
			</div>
		</div>
	);
}

/**
 * Recognized revenue climbing as deferred revenue drains, as two areas over twelve
 * months, the schedule the ledger keeps for an annual contract.
 *
 * @returns The render function producing the scene.
 */
export function RecognitionScene() {
	return () => {
		let width = 640;
		let height = 180;
		let step = width / (RECOGNITION.length - 1);
		let y = (value: number) => height - (value / 460) * height;
		let line = (pick: 0 | 1) =>
			RECOGNITION.map((point, index) => `${index * step},${y(point[pick])}`).join(" L");

		return (
			<div mix={[p(6, 0, 0, 0)]}>
				<svg
					viewBox={`0 0 ${width} ${height}`}
					preserveAspectRatio="none"
					role="img"
					aria-label="Recognized revenue rises each month while deferred revenue falls"
					mix={[is("100%"), bs("11rem"), raw({ display: "block" })]}
				>
					<path
						d={`M0,${height} L${line(0)} L${width},${height} Z`}
						fill="var(--ui-color-brand-500)"
						opacity="0.18"
					/>
					<path
						d={`M${line(0)}`}
						fill="none"
						stroke="var(--ui-color-brand-600)"
						stroke-width="2.5"
						vector-effect="non-scaling-stroke"
					/>
					<path
						d={`M${line(1)}`}
						fill="none"
						stroke="var(--ui-neutral-fg-muted)"
						stroke-width="2"
						stroke-dasharray="5 5"
						vector-effect="non-scaling-stroke"
					/>
				</svg>
			</div>
		);
	};
}
