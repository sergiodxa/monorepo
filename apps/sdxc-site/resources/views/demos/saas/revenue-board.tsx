/**
 * The Keel dashboard the hero stages: a workspace rail, three revenue figures, a year of
 * committed and metered revenue as stacked bars, and the latest invoices. Built from
 * `@sdxc/ui` parts and drawn SVG, it narrows with its frame through its own container.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	ChartColumnIcon,
	CreditCardIcon,
	FileTextIcon,
	LayoutDashboardIcon,
	ReceiptIcon,
	SettingsIcon,
	UsersIcon,
} from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container, hstack, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is, p } from "@sdxc/u/size";
import { font, tabularNums, text, truncate, weight } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";

import { showFrom } from "~/resources/views/demos/saas/visibility";

/** The named container every breakpoint inside the board reads. */
const BOARD = "keel-board";

/** The rail's destinations; the first is the page on screen. */
const RAIL = [
	["Overview", LayoutDashboardIcon],
	["Customers", UsersIcon],
	["Usage", ChartColumnIcon],
	["Invoices", ReceiptIcon],
	["Plans", CreditCardIcon],
	["Reports", FileTextIcon],
] as const;

/** The three headline figures: label, value and the change against last month. */
const FIGURES = [
	["Monthly revenue", "$482,190", "+8.2%"],
	["Metered events", "1.94B", "+12.4%"],
	["Net retention", "128%", "+3 pts"],
] as const;

/** Twelve months of revenue in thousands of dollars: month, committed, metered. */
const MONTHS = [
	["N", 182, 118],
	["D", 186, 126],
	["J", 191, 121],
	["F", 197, 133],
	["M", 204, 141],
	["A", 210, 152],
	["M", 216, 149],
	["J", 224, 166],
	["J", 231, 178],
	["A", 240, 189],
	["S", 248, 197],
	["O", 260, 222],
] as const;

/** The latest invoices: customer, plan, amount and state. */
const INVOICES = [
	["Orbitkit", "Scale · metered", "$18,420.00", "Paid"],
	["Parcelbase", "Growth · annual", "$9,600.00", "Paid"],
	["Sundial Labs", "Scale · metered", "$4,212.36", "Retrying"],
	["Hatchway", "Growth · metered", "$2,948.10", "Open"],
] as const;

/** The badge colour each invoice state draws in. */
const INVOICE_COLOR = {
	Paid: "success",
	Retrying: "warning",
	Open: "neutral",
} as const;

/** The chart's drawing box: width, height and the value its top edge stands for. */
const CHART = { width: 600, height: 180, max: 500 } as const;

/**
 * Renders the dashboard. The rail joins from the `lg` container and the plan column
 * from `md`, so the same board reads at a phone's frame width and at a desktop's.
 *
 * @returns The render function producing the board.
 */
export function RevenueBoard() {
	return () => (
		<div mix={[container(BOARD), text("sm"), raw({ textAlign: "start" })]}>
			<div
				mix={[
					combine([
						raw({ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }),
						at("lg", BOARD, raw({ gridTemplateColumns: "12.5rem minmax(0, 1fr)" })),
					]),
				]}
			>
				<Rail />
				<div mix={[vstack({ gap: 4, align: "stretch" }), p(4), at("md", BOARD, p(6))]}>
					<div mix={[hstack({ gap: 3, align: "center", justify: "between" })]}>
						<span mix={[vstack({ gap: 0.5, align: "start" })]}>
							<span mix={[text("base"), weight("semibold"), fg("neutral.emphasis")]}>Revenue</span>
							<span mix={[text("xs"), fg("neutral.muted")]}>October 2026 · USD</span>
						</span>
						<span
							mix={[
								showFrom("md", BOARD, "flex"),
								raw({ alignItems: "center", gap: "0.125rem" }),
								p(0.5),
								text("xs"),
								raw({ borderRadius: "0.5rem", boxShadow: "var(--ui-shadow-surface)" }),
							]}
						>
							{["30d", "Quarter", "Year"].map((range) => (
								<span
									key={range}
									mix={[
										p(1, 2.5),
										raw({ borderRadius: "0.375rem" }),
										range === "Year"
											? [bg("neutral.bg-tint-hover"), fg("neutral.emphasis"), weight("medium")]
											: fg("neutral"),
									]}
								>
									{range}
								</span>
							))}
						</span>
					</div>

					<div
						mix={[
							raw({
								display: "grid",
								gap: "0.75rem",
								gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
							}),
							at("md", BOARD, raw({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" })),
						]}
					>
						{FIGURES.map(([label, value, change], index) => (
							<div
								key={label}
								mix={[
									raw({ flexDirection: "column", alignItems: "flex-start", gap: "0.25rem" }),
									p(3, 3.5),
									raw({ borderRadius: "0.5rem", boxShadow: "var(--ui-shadow-surface)" }),
									bg("var(--ui-surface-raised)"),
									index === 2 ? showFrom("md", BOARD, "flex") : raw({ display: "flex" }),
								]}
							>
								<span mix={[text("xs"), fg("neutral.muted"), truncate(), is("100%")]}>{label}</span>
								<span
									mix={[
										text("xl"),
										weight("semibold"),
										fg("neutral.emphasis"),
										tabularNums(),
										raw({ letterSpacing: "-0.02em" }),
									]}
								>
									{value}
								</span>
								<span mix={[text("xs"), weight("medium"), fg("success")]}>{change} vs Sep</span>
							</div>
						))}
					</div>

					<div
						mix={[
							vstack({ gap: 3, align: "stretch" }),
							p(4),
							raw({ borderRadius: "0.5rem", boxShadow: "var(--ui-shadow-surface)" }),
							bg("var(--ui-surface-raised)"),
						]}
					>
						<span
							mix={[
								hstack({ gap: 3, align: "center", justify: "between" }),
								raw({ flexWrap: "wrap", rowGap: "0.5rem" }),
							]}
						>
							<span mix={[weight("medium"), fg("neutral.emphasis")]}>Revenue by month</span>
							<span mix={[hstack({ gap: 3, align: "center" }), text("xs"), fg("neutral")]}>
								<Legend color="var(--ui-color-brand-300)">Committed</Legend>
								<Legend color="var(--ui-color-brand-600)">Metered</Legend>
							</span>
						</span>
						<RevenueChart />
					</div>

					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr) auto auto",
								columnGap: "1rem",
								borderRadius: "0.5rem",
								boxShadow: "var(--ui-shadow-surface)",
								overflow: "hidden",
							}),
							at(
								"md",
								BOARD,
								raw({ gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) auto auto" }),
							),
							bg("var(--ui-surface-raised)"),
						]}
					>
						<span
							mix={[
								hstack({ gap: 3, align: "center", justify: "between" }),
								raw({ gridColumn: "1 / -1" }),
								p(3, 4),
							]}
						>
							<span mix={[weight("medium"), fg("neutral.emphasis")]}>Latest invoices</span>
							<span mix={[text("xs"), fg("brand")]}>View all</span>
						</span>
						{INVOICES.map(([customer, plan, amount, state]) => (
							<span
								key={customer}
								mix={[
									raw({
										display: "grid",
										gridColumn: "1 / -1",
										gridTemplateColumns: "subgrid",
										alignItems: "center",
										borderBlockStart: "1px solid var(--ui-marketing-hairline)",
									}),
									p(2.5, 4),
								]}
							>
								<span mix={[weight("medium"), fg("neutral.emphasis"), truncate()]}>{customer}</span>
								<span mix={[showFrom("md", BOARD, "block"), fg("neutral"), truncate()]}>
									{plan}
								</span>
								<span
									mix={[
										font("mono"),
										text("xs"),
										fg("neutral.emphasis"),
										tabularNums(),
										raw({ justifySelf: "end" }),
									]}
								>
									{amount}
								</span>
								<span mix={[raw({ justifySelf: "start" })]}>
									<Badge color={INVOICE_COLOR[state]} variant="secondary">
										{state}
									</Badge>
								</span>
							</span>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * The workspace rail: the workspace switcher, then each destination with the current
 * one filled. It draws only from the `lg` container, where the frame is wide enough.
 *
 * @returns The render function producing the rail.
 */
function Rail() {
	return () => (
		<div
			mix={[
				showFrom("lg", BOARD, "flex"),
				raw({ flexDirection: "column", gap: "0.25rem" }),
				p(4, 3),
				raw({ borderInlineEnd: "1px solid var(--ui-marketing-hairline)" }),
			]}
		>
			<span
				mix={[hstack({ gap: 2.5, align: "center" }), p(1, 2), raw({ marginBlockEnd: "0.75rem" })]}
			>
				<span
					aria-hidden="true"
					mix={[
						is("1.5rem"),
						bs("1.5rem"),
						raw({
							borderRadius: "0.375rem",
							background:
								"linear-gradient(135deg, var(--ui-color-brand-400), var(--ui-color-brand-700))",
						}),
					]}
				/>
				<span mix={[vstack({ gap: 0, align: "start" })]}>
					<span mix={[weight("semibold"), fg("neutral.emphasis")]}>Acme Cloud</span>
					<span mix={[text("xs"), fg("neutral.muted")]}>Production</span>
				</span>
			</span>
			{RAIL.map(([label, Icon], index) => (
				<span
					key={label}
					mix={[
						hstack({ gap: 2.5, align: "center" }),
						p(1.5, 2),
						raw({ borderRadius: "0.5rem" }),
						index === 0
							? [bg("neutral.bg-tint-hover"), fg("neutral.emphasis"), weight("medium")]
							: fg("neutral"),
					]}
				>
					<Icon aria-hidden="true" mix={[is("1rem"), bs("1rem")]} />
					{label}
				</span>
			))}
			<span
				mix={[
					hstack({ gap: 2.5, align: "center" }),
					p(1.5, 2),
					fg("neutral"),
					raw({ marginBlockStart: "auto" }),
				]}
			>
				<SettingsIcon aria-hidden="true" mix={[is("1rem"), bs("1rem")]} />
				Settings
			</span>
		</div>
	);
}

namespace Legend {
	export interface Props {
		/** The swatch fill, matching the bars it names. */
		color: string;
		/** The series name. */
		children: string;
	}
}

/**
 * One series key: a rounded swatch, then the series name.
 *
 * @param handle Runtime handle carrying the swatch colour and name.
 * @returns The render function producing the key.
 */
function Legend(handle: Handle<Legend.Props>) {
	return () => (
		<span mix={[hstack({ gap: 1.5, align: "center" })]}>
			<span
				aria-hidden="true"
				mix={[
					is("0.625rem"),
					bs("0.625rem"),
					raw({ borderRadius: "0.1875rem", backgroundColor: handle.props.color }),
				]}
			/>
			{handle.props.children}
		</span>
	);
}

/**
 * Twelve stacked bars over three quiet gridlines, committed revenue under metered. The
 * bars scale with the card; the month initials sit in a row of text under them, so they
 * keep the card's 12px size at a phone's width.
 *
 * @returns The render function producing the chart.
 */
function RevenueChart() {
	return () => {
		let slot = CHART.width / MONTHS.length;
		let barWidth = slot * 0.56;
		let scale = (value: number) => (value / CHART.max) * CHART.height;

		return (
			<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
				<svg
					viewBox={`0 0 ${CHART.width} ${CHART.height}`}
					role="img"
					aria-label="Monthly revenue grew from $300k to $482k over the last twelve months"
					mix={[is("100%"), raw({ blockSize: "auto", display: "block" })]}
				>
					{[0.25, 0.5, 0.75].map((line) => (
						<line
							key={line}
							x1="0"
							x2={CHART.width}
							y1={CHART.height * line}
							y2={CHART.height * line}
							stroke="var(--ui-marketing-hairline)"
							stroke-dasharray="3 5"
						/>
					))}
					{MONTHS.map(([, committed, metered], index) => {
						let x = index * slot + (slot - barWidth) / 2;
						let committedHeight = scale(committed);
						let meteredHeight = scale(metered);
						return (
							<g key={index}>
								<rect
									x={x}
									y={CHART.height - committedHeight}
									width={barWidth}
									height={committedHeight}
									rx="3"
									fill="var(--ui-color-brand-300)"
								/>
								<rect
									x={x}
									y={CHART.height - committedHeight - meteredHeight - 2}
									width={barWidth}
									height={meteredHeight}
									rx="3"
									fill="var(--ui-color-brand-600)"
								/>
							</g>
						);
					})}
				</svg>
				<span
					aria-hidden="true"
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: `repeat(${MONTHS.length}, minmax(0, 1fr))`,
							textAlign: "center",
						}),
						text("xs"),
						fg("neutral.muted"),
					]}
				>
					{MONTHS.map(([month], index) => (
						<span key={index}>{month}</span>
					))}
				</span>
			</div>
		);
	};
}
