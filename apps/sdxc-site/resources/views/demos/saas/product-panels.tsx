/**
 * The Keel screens the workflow stage switches between: the meters counting usage, the
 * tiered price applied to one customer, the invoice it produces, and the recovery log
 * for a failed charge. Each is a framed window, so the stage shows the product itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, tabularNums, text, truncate, weight } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";
import { ProductFrame } from "@sdxc/ui/patterns";

/** The meters a workspace defines: name, the event it counts, the aggregation and the month's count. */
const METERS = [
	["API requests", "request.completed", "count", "38.2M"],
	["Storage", "bucket.snapshot", "max GB", "4,120"],
	["Compute", "job.finished", "sum seconds", "912k"],
	["Seats", "member.active", "unique", "64"],
] as const;

/** One meter's last fourteen days, as heights out of 24, for the row's sparkline. */
const SPARK = [9, 11, 10, 13, 12, 15, 14, 16, 15, 18, 17, 20, 19, 22] as const;

/** The Scale plan's tiers: range, unit price and what Orbitkit's month draws in each. */
const TIERS = [
	["First 1M", "Included", "$0.00"],
	["1M – 50M", "$0.40 / 1k", "$14,880.00"],
	["Over 50M", "$0.25 / 1k", "$0.00"],
] as const;

/** The October invoice's lines: description, quantity and amount. */
const INVOICE_LINES = [
	["Scale platform fee", "1", "$2,500.00"],
	["API requests, 1M – 50M", "37.2M", "$14,880.00"],
	["Storage over 2 TB", "2,120 GB", "$1,040.00"],
] as const;

/** The recovery attempts on one failed charge: time, what happened, and its outcome. */
const ATTEMPTS = [
	["Oct 1, 09:00", "Card declined: insufficient funds", "Failed"],
	["Oct 3, 09:00", "Retried at the customer's payday", "Failed"],
	["Oct 3, 09:05", "Reminder sent to billing@sundial.dev", "Sent"],
	["Oct 5, 14:12", "Paid with updated card ending 4471", "Paid"],
] as const;

/** The badge colour each recovery outcome draws in. */
const OUTCOME_COLOR = { Failed: "danger", Sent: "neutral", Paid: "success" } as const;

/** A hairline between stacked rows, drawn on every row after the first. */
function rowRule() {
	return when("& + &", raw({ borderBlockStart: "1px solid var(--ui-marketing-hairline)" }));
}

/**
 * The meters screen: each meter's name and event, its aggregation, a fortnight's
 * sparkline and the month's count.
 *
 * @returns The render function producing the framed screen.
 */
export function MetersPanel() {
	return () => (
		<ProductFrame lights title="Meters" url="keel · Acme Cloud">
			<ul mix={[raw({ listStyle: "none" }), m(0), p(0), text("sm")]}>
				{METERS.map(([name, event, aggregation, total]) => (
					<li
						key={name}
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr) 4.5rem auto",
								alignItems: "center",
								gap: "1rem",
							}),
							p(3.5, 5),
							rowRule(),
						]}
					>
						<span mix={[vstack({ gap: 0.5, align: "stretch" }), raw({ minInlineSize: 0 })]}>
							<span mix={[weight("semibold"), fg("neutral.emphasis")]}>{name}</span>
							<span mix={[font("mono"), text("xs"), fg("neutral.muted"), truncate()]}>
								{event} · {aggregation}
							</span>
						</span>
						<svg viewBox="0 0 70 24" aria-hidden="true" mix={[raw({ inlineSize: "4.5rem" })]}>
							<polyline
								points={SPARK.map((value, index) => `${index * 5.3},${24 - value}`).join(" ")}
								fill="none"
								stroke="var(--ui-color-brand-500)"
								stroke-width="1.75"
								stroke-linejoin="round"
								stroke-linecap="round"
							/>
						</svg>
						<span mix={[font("mono"), weight("medium"), fg("neutral.emphasis"), tabularNums()]}>
							{total}
						</span>
					</li>
				))}
			</ul>
		</ProductFrame>
	);
}

/**
 * The price screen: the Scale plan's tiers with what one customer's month draws in
 * each, then the total the invoice will carry.
 *
 * @returns The render function producing the framed screen.
 */
export function PricePanel() {
	return () => (
		<ProductFrame lights title="Scale plan" url="keel · Plans">
			<div mix={[vstack({ gap: 0, align: "stretch" }), text("sm")]}>
				<span
					mix={[
						hstack({ gap: 3, align: "center", justify: "between" }),
						p(3.5, 5),
						raw({ borderBlockEnd: "1px solid var(--ui-marketing-hairline)" }),
					]}
				>
					<span mix={[fg("neutral")]}>
						Previewing <strong mix={[fg("neutral.emphasis")]}>Orbitkit</strong>, 38.2M requests
					</span>
					<Badge color="brand" variant="secondary">
						Graduated
					</Badge>
				</span>
				{TIERS.map(([range, unit, amount]) => (
					<span
						key={range}
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
								alignItems: "center",
								gap: "1rem",
							}),
							p(3, 5),
							rowRule(),
						]}
					>
						<span mix={[weight("medium"), fg("neutral.emphasis")]}>{range}</span>
						<span mix={[fg("neutral")]}>{unit}</span>
						<span mix={[font("mono"), fg("neutral.emphasis"), tabularNums()]}>{amount}</span>
					</span>
				))}
				<span
					mix={[
						hstack({ gap: 3, align: "center", justify: "between" }),
						p(3.5, 5),
						bg("brand.tint"),
						raw({ borderBlockStart: "1px solid var(--ui-marketing-hairline)" }),
					]}
				>
					<span mix={[weight("medium"), fg("brand.emphasis")]}>Usage this month</span>
					<span mix={[font("mono"), weight("semibold"), fg("brand.emphasis"), tabularNums()]}>
						$14,880.00
					</span>
				</span>
			</div>
		</ProductFrame>
	);
}

/**
 * The invoice screen: the customer, each line with its quantity, and the total due,
 * as the customer receives it on the first of the month.
 *
 * @returns The render function producing the framed screen.
 */
export function InvoicePanel() {
	return () => (
		<ProductFrame lights title="INV-2026-1047" url="keel · Invoices">
			<div mix={[vstack({ gap: 5, align: "stretch" }), p(5), text("sm")]}>
				<span mix={[hstack({ gap: 3, align: "start", justify: "between" })]}>
					<span mix={[vstack({ gap: 0.5, align: "start" })]}>
						<span mix={[text("base"), weight("semibold"), fg("neutral.emphasis")]}>
							Orbitkit Inc.
						</span>
						<span mix={[text("xs"), fg("neutral.muted")]}>Billed Nov 1, 2026 · Net 15</span>
					</span>
					<Badge color="success" variant="secondary">
						Paid
					</Badge>
				</span>
				<ul mix={[raw({ listStyle: "none" }), m(0), p(0)]}>
					{INVOICE_LINES.map(([line, quantity, amount]) => (
						<li
							key={line}
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "minmax(0, 1fr) auto auto",
									gap: "1rem",
									alignItems: "baseline",
								}),
								p(2.5, 0),
								rowRule(),
							]}
						>
							<span mix={[fg("neutral.emphasis"), truncate()]}>{line}</span>
							<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>{quantity}</span>
							<span mix={[font("mono"), fg("neutral.emphasis"), tabularNums()]}>{amount}</span>
						</li>
					))}
				</ul>
				<span
					mix={[
						hstack({ gap: 3, align: "baseline", justify: "between" }),
						raw({
							paddingBlockStart: "0.75rem",
							borderBlockStart: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<span mix={[weight("medium"), fg("neutral.emphasis")]}>Total due</span>
					<span mix={[text("xl"), weight("semibold"), fg("neutral.emphasis"), tabularNums()]}>
						$18,420.00
					</span>
				</span>
			</div>
		</ProductFrame>
	);
}

/**
 * The recovery screen: every attempt on one failed charge, from the decline to the
 * payment, with the outcome of each.
 *
 * @returns The render function producing the framed screen.
 */
export function RecoveryPanel() {
	return () => (
		<ProductFrame lights title="Recovery · Sundial Labs" url="keel · Payments">
			<ol mix={[raw({ listStyle: "none" }), m(0), p(0), text("sm")]}>
				{ATTEMPTS.map(([time, event, outcome]) => (
					<li
						key={time}
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "6.5rem minmax(0, 1fr) auto",
								alignItems: "center",
								gap: "1rem",
							}),
							p(3.5, 5),
							rowRule(),
						]}
					>
						<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>{time}</span>
						<span mix={[fg("neutral.emphasis")]}>{event}</span>
						<Badge color={OUTCOME_COLOR[outcome]} variant="secondary">
							{outcome}
						</Badge>
					</li>
				))}
			</ol>
		</ProductFrame>
	);
}
