/**
 * Quoin's opening spread: the studio's claim in an oversized Didone across the whole
 * twelve-column grid, the faint column guides it is set on, a lead in the right-hand half,
 * and the studio's index of figures as the page's first ruled table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { Link, LinkButton } from "@sdxc/ui";
import { LandingSection } from "@sdxc/ui/landing";
import { landingCtaChrome, landingLead } from "@sdxc/ui/styles";

import {
	BAND,
	caption,
	pageGrid,
	RULE,
	runningHead,
	span,
} from "~/resources/views/demos/studio/grid";
import { DIDONE } from "~/resources/views/demos/studio/type";

/** The studio's figures, each counted from the work the page goes on to show. */
const INDEX = [
	{ value: "38", label: "Products shipped since 2014" },
	{ value: "11", label: "Designers and engineers" },
	{ value: "4.6", label: "Years an average client stays" },
	{ value: "2", label: "Projects at a time, never more" },
];

/**
 * Renders the spread with the claim spanning every column, the lead and actions from the
 * seventh column, and the four figures a quarter of the grid each.
 *
 * @returns The render function producing the hero band.
 */
export default function StudioHero() {
	return () => (
		<LandingSection id="top" spacing="hero" level={1}>
			<div mix={[pageGrid(), raw({ position: "relative", rowGap: "2.5rem" })]}>
				<ColumnGuides />
				<p mix={[runningHead()]}>
					<span>Design &amp; engineering studio · Antwerp</span>
					<a href="#availability" mix={[availabilityLink()]}>
						<span
							aria-hidden="true"
							mix={[
								raw({
									inlineSize: "0.5rem",
									blockSize: "0.5rem",
									backgroundColor: "var(--ui-brand-fg)",
								}),
							]}
						/>
						Booking from March
					</a>
				</p>
				<h1 mix={[display()]}>
					Designed and built <i>in one room</i>
				</h1>
				<div mix={[span("7 / -1"), raw({ display: "grid", gap: "2rem", justifyItems: "start" })]}>
					<p mix={[landingLead("hero"), raw({ margin: "0" })]}>
						Quoin is eleven designers and engineers who take a product from the first interview to
						the release people use every day, and then <strong>measure what it changed</strong>.
					</p>
					<div
						mix={[raw({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1.5rem" })]}
					>
						<LinkButton href="#start" color="brand" mix={[landingCtaChrome()]}>
							Start a project
						</LinkButton>
						<Link href="#work" color="neutral" mix={[raw({ fontWeight: "500" })]}>
							See the work
						</Link>
					</div>
				</div>
				<dl mix={[figures()]}>
					{INDEX.map((item) => (
						<div key={item.label} mix={[figureCell()]}>
							<dt mix={[caption(), raw({ order: "2" })]}>{item.label}</dt>
							<dd
								mix={[
									raw({
										margin: "0",
										fontFamily: DIDONE,
										fontSize: "3.5rem",
										lineHeight: "1",
										color: "var(--ui-neutral-fg-emphasis)",
										fontVariantNumeric: "lining-nums",
									}),
								]}
							>
								{item.value}
							</dd>
						</div>
					))}
				</dl>
			</div>
		</LandingSection>
	);
}

/**
 * The layout grid drawn faintly behind the spread from `lg`, twelve columns with hairline
 * edges, so the claim is seen sitting on the grid every band below keeps to.
 *
 * @returns The render function producing the guides.
 */
function ColumnGuides() {
	return () => (
		<div
			aria-hidden="true"
			data-slot="studio-guides"
			mix={[
				raw({ display: "none" }),
				at(
					"lg",
					BAND,
					raw({
						position: "absolute",
						inset: "-2rem 0",
						zIndex: "-1",
						pointerEvents: "none",
						display: "grid",
						gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
						columnGap: "2rem",
					}),
				),
			]}
		>
			{Array.from({ length: 12 }, (_, index) => (
				<span
					key={index}
					mix={[
						raw({
							backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 4%, transparent)",
							borderInline: "1px solid color-mix(in oklch, var(--ui-brand-fg) 10%, transparent)",
						}),
					]}
				/>
			))}
		</div>
	);
}

/** The availability note in the running head, in the brand ink with its square marker. */
function availabilityLink() {
	return raw({
		display: "inline-flex",
		alignItems: "center",
		gap: "0.5rem",
		color: "var(--ui-brand-fg)",
		textDecoration: "none",
	});
}

/**
 * The claim at poster scale: from 3.25rem on a phone to 9rem, sized on the band's width so
 * it sets in two lines across the grid on a desktop, tight in the Didone's regular weight.
 */
function display() {
	return raw({
		gridColumn: "1 / -1",
		margin: "0",
		fontFamily: DIDONE,
		fontWeight: "400",
		fontSize: "clamp(3.25rem, 9.5cqi, 9rem)",
		lineHeight: "0.92",
		letterSpacing: "-0.035em",
		color: "var(--ui-neutral-fg-emphasis)",
		textWrap: "balance",
		maxInlineSize: "13ch",
	});
}

/** The figures table: two by two on a phone, four quarters of the grid from `lg`. */
function figures() {
	return [
		raw({
			gridColumn: "1 / -1",
			margin: "0",
			marginBlockStart: "1rem",
			display: "grid",
			gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
			gap: "2rem",
			borderBlockStart: RULE,
			paddingBlockStart: "1.5rem",
		}),
		at("lg", BAND, raw({ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" })),
	];
}

/** One figure: the number over its caption. */
function figureCell() {
	return raw({ display: "flex", flexDirection: "column", gap: "0.75rem" });
}
