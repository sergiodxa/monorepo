/**
 * Product screens the landing demos stage: a status board with 45-day uptime bars and an
 * incident banner, an incident timeline card, and generic wordmarks for logo clouds. Built
 * from `@sdxc/ui` parts so a demo shows what a real product shot looks like in each band.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { font, text, truncate, weight } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";

/** How many days of history each uptime bar row draws. */
const DAYS = 45;

/** The monitors the board lists: name, uptime and the days that were not clean. */
const MONITORS = [
	{ name: "api.example.com", uptime: "99.98%", degraded: [12, 31], down: [] },
	{ name: "app.example.com", uptime: "100%", degraded: [], down: [] },
	{ name: "Webhooks", uptime: "99.71%", degraded: [40], down: [44] },
	{ name: "Billing", uptime: "99.99%", degraded: [7], down: [] },
] as const;

/** The tabs the board's header shows, the first one current. */
const TABS = ["Monitors", "Incidents", "Maintenance"] as const;

/** The incident timeline's entries, newest first. */
const TIMELINE = [
	["14:31", "Resolved", "Latency back under 200ms in every region."],
	["14:12", "Monitoring", "Fix deployed to the eu-west pool."],
	["14:02", "Investigating", "p95 latency above 1.2s from eu-west."],
] as const;

/**
 * The fill one day of an uptime bar takes: the danger solid on a down day, the warning
 * solid on a degraded one, the success solid otherwise.
 */
function dayColor(day: number, monitor: (typeof MONITORS)[number]): string {
	if ((monitor.down as readonly number[]).includes(day)) return "var(--ui-danger-bg-solid)";
	if ((monitor.degraded as readonly number[]).includes(day)) return "var(--ui-warning-bg-solid)";
	return "var(--ui-success-bg-solid)";
}

/**
 * A status page as a customer sees it: an incident banner, tabs, and one row per monitor
 * with its uptime and a bar per day. Sized by its parent, so it fills a hero frame.
 *
 * @returns The render function producing the board.
 */
export function StatusBoard() {
	return () => (
		<div mix={[vstack({ gap: 0, align: "stretch" }), text("sm")]}>
			<div
				mix={[
					hstack({ gap: 3, align: "center" }),
					p(3, 5),
					bg("warning.tint"),
					fg("warning.emphasis"),
					raw({ borderBlockEnd: "1px solid var(--ui-marketing-hairline)" }),
				]}
			>
				<Badge color="warning">Monitoring</Badge>
				<span mix={[truncate()]}>Elevated latency in eu-west · fix deployed 14:12 UTC</span>
			</div>
			<div
				mix={[
					hstack({ gap: 5, align: "center" }),
					p(0, 5),
					raw({ borderBlockEnd: "1px solid var(--ui-marketing-hairline)" }),
				]}
			>
				{TABS.map((tab, index) => (
					<span
						key={tab}
						mix={[
							p(3, 0),
							weight("medium"),
							index === 0 ? fg("neutral.emphasis") : fg("neutral"),
							raw({
								boxShadow: index === 0 ? "inset 0 -2px 0 var(--ui-neutral-fg-emphasis)" : "none",
							}),
						]}
					>
						{tab}
					</span>
				))}
			</div>
			{MONITORS.map((monitor) => (
				<div
					key={monitor.name}
					mix={[
						vstack({ gap: 2, align: "stretch" }),
						p(4, 5),
						raw({ borderBlockEnd: "1px solid var(--ui-marketing-hairline)" }),
					]}
				>
					<span mix={[hstack({ gap: 3, align: "center", justify: "between" })]}>
						<span mix={[weight("medium"), fg("neutral.emphasis"), truncate()]}>{monitor.name}</span>
						<span mix={[font("mono"), text("xs"), fg("neutral")]}>{monitor.uptime}</span>
					</span>
					<span
						aria-label={`${monitor.uptime} uptime over ${DAYS} days`}
						role="img"
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))`,
								gap: "2px",
								blockSize: "1.75rem",
							}),
						]}
					>
						{Array.from({ length: DAYS }, (_, day) => (
							<span
								key={day}
								mix={[raw({ borderRadius: "2px", backgroundColor: dayColor(day, monitor) })]}
							/>
						))}
					</span>
				</div>
			))}
			<span mix={[p(3, 5), text("xs"), fg("neutral.muted")]}>
				Checked from 6 regions every 30 seconds
			</span>
		</div>
	);
}

/**
 * One incident told as a timeline: its title and state, then each update with its time,
 * newest first, so a feature band shows the record the product writes.
 *
 * @returns The render function producing the card.
 */
export function IncidentCard() {
	return () => (
		<div mix={[vstack({ gap: 4, align: "stretch" }), p(6), text("sm")]}>
			<span mix={[hstack({ gap: 3, align: "center", justify: "between" })]}>
				<span mix={[text("base"), weight("semibold"), fg("neutral.emphasis")]}>
					Elevated API latency in eu-west
				</span>
				<Badge color="success" variant="secondary">
					Resolved
				</Badge>
			</span>
			<ol mix={[vstack({ gap: 3, align: "stretch" }), raw({ listStyle: "none", padding: "0" })]}>
				{TIMELINE.map(([time, state, body]) => (
					<li
						key={time}
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "3.5rem minmax(0, 1fr)",
								gap: "0.75rem",
							}),
						]}
					>
						<span
							mix={[
								font("mono"),
								text("xs"),
								fg("neutral.muted"),
								raw({ paddingBlockStart: "2px" }),
							]}
						>
							{time}
						</span>
						<span mix={[vstack({ gap: 0.5, align: "stretch" })]}>
							<span mix={[weight("medium"), fg("neutral.emphasis")]}>{state}</span>
							<span mix={[fg("neutral")]}>{body}</span>
						</span>
					</li>
				))}
			</ol>
		</div>
	);
}

/** Props for {@link Wordmark}. */
export interface WordmarkProps {
	/** The company name the mark spells. */
	name: string;
	/** Which geometric glyph leads the name. */
	glyph: "ring" | "bolt" | "stack" | "leaf" | "grid";
}

/** The glyph paths a wordmark leads with, drawn in a 24-unit box. */
const GLYPHS: Record<WordmarkProps["glyph"], string> = {
	ring: "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Zm0 4a5 5 0 1 1 0 10a5 5 0 0 1 0-10Z",
	bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
	stack: "M12 2 2 7l10 5 10-5-10-5Zm-10 10 10 5 10-5M2 17l10 5 10-5",
	leaf: "M20 4C9 4 4 9 4 20c11 0 16-5 16-16Zm-14 14 10-10",
	grid: "M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z",
};

/**
 * A generic company wordmark — a glyph and a name in `currentColor` — that a logo cloud
 * sizes like any adopter's SVG, so a demo shows marks at their real size.
 *
 * @param handle Runtime handle carrying the mark's name and glyph.
 * @returns The render function producing the SVG.
 */
export function Wordmark(handle: Handle<WordmarkProps>) {
	return () => {
		let { glyph, name } = handle.props;
		let width = 34 + name.length * 11;
		let isStroke = glyph === "stack" || glyph === "leaf";

		return (
			<svg viewBox={`0 0 ${width} 28`} role="img" aria-label={name} fill="currentColor">
				<path
					d={GLYPHS[glyph]}
					transform="translate(0 2)"
					fill={isStroke ? "none" : "currentColor"}
					stroke={isStroke ? "currentColor" : "none"}
					stroke-width={isStroke ? "2" : undefined}
					stroke-linejoin="round"
				/>
				<text
					x="32"
					y="20.5"
					font-size="19"
					font-weight="650"
					letter-spacing="-0.4"
					font-family="ui-sans-serif, system-ui, sans-serif"
				>
					{name}
				</text>
			</svg>
		);
	};
}

/** The wordmarks every demo logo cloud shows, in one order. */
export const WORDMARKS: readonly WordmarkProps[] = [
	{ name: "Northwind", glyph: "ring" },
	{ name: "Voltage", glyph: "bolt" },
	{ name: "Layerline", glyph: "stack" },
	{ name: "Fernway", glyph: "leaf" },
	{ name: "Quadrant", glyph: "grid" },
];
