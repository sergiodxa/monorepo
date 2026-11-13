/**
 * Student work and outcomes, kept honest: six pieces from students with the faults they
 * named themselves, then how many students finished each module, falling to the share who
 * finished all six, with the cohort the figures come from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { combine, raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { DrawnChart, LandingHeader, LandingSection } from "@sdxc/ui/landing";

import type { PotShape } from "~/resources/views/demos/course/data";

import { Pot } from "~/resources/views/demos/course/clay";
import { COHORT_SIZE, COMPLETION, MODULES } from "~/resources/views/demos/course/data";
import { renderNearView } from "~/resources/views/demos/near-view";

/** One piece a student shared, with what they would change about it. */
interface Piece {
	student: string;
	module: number;
	week: number;
	shape: PotShape;
	glaze?: string;
	tilt?: number;
	note: string;
}

/** The pieces, in module order: first attempts and the fixes that followed. */
const PIECES: readonly Piece[] = [
	{
		student: "Dana",
		module: 3,
		week: 4,
		shape: "cylinder",
		tilt: 3,
		note: "My third cylinder. It leans and the floor is thick, so it holds brushes.",
	},
	{
		student: "Ade",
		module: 3,
		week: 5,
		shape: "cylinder",
		glaze: "oklch(0.72 0.12 75)",
		note: "Cut in half for the module check: 6 mm walls at the base, 4 at the rim.",
	},
	{
		student: "Tomás",
		module: 4,
		week: 6,
		shape: "bowl",
		glaze: "oklch(0.76 0.07 170)",
		note: "The first bowl to survive trimming. Two rims cracked before it.",
	},
	{
		student: "Hye-jin",
		module: 5,
		week: 8,
		shape: "mug",
		glaze: "oklch(0.9 0.03 85)",
		note: "Handle reattached once after it dried too fast. Holds 310 ml.",
	},
	{
		student: "Ola",
		module: 5,
		week: 9,
		shape: "mug",
		glaze: "oklch(0.36 0.06 40)",
		tilt: -2,
		note: "Tenmoku ran off the rim and onto the shelf. Wipe your feet, it turns out.",
	},
	{
		student: "Marcus",
		module: 6,
		week: 11,
		shape: "jar",
		glaze: "oklch(0.52 0.14 262)",
		note: "The lid sits 2 mm proud; the gallery was too shallow. Re-thrown the next week.",
	},
];

/** Container the band's grids query. */
const BAND = "course-work";

/**
 * Renders the band: the gallery in a grid that takes three columns from the `lg`
 * container, then the finishing figures beside the chart of who finished each module.
 *
 * @returns The render function producing the band.
 */
export function CourseWork() {
	return () => {
		let finished = COMPLETION.at(-1)!.percent;
		return (
			<LandingSection id="work" mix={[renderNearView(1605, 3295)]}>
				<div mix={[container(BAND), raw({ display: "grid", gap: "3rem" })]}>
					<LandingHeader
						eyebrow="Student work"
						description={
							<>
								Shared by students, with their own notes.{" "}
								<strong>We show the leaning cylinder next to the lidded jar</strong>, because that
								is what the middle of the course looks like.
							</>
						}
					>
						Pots from the course, wobbles included
					</LandingHeader>
					<ul
						mix={[
							combine([
								raw({
									listStyle: "none",
									margin: "0",
									padding: "0",
									display: "grid",
									gap: "1rem",
									gridTemplateColumns: "minmax(0, 1fr)",
								}),
								at("sm", BAND, raw({ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" })),
								at("lg", BAND, raw({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" })),
							]),
						]}
					>
						{PIECES.map((piece, index) => (
							<li key={`${piece.student}-${index}`}>
								<PieceCard piece={piece} index={index} />
							</li>
						))}
					</ul>
					<div
						mix={[
							combine([
								raw({
									display: "grid",
									gap: "2rem",
									gridTemplateColumns: "minmax(0, 1fr)",
									alignItems: "center",
								}),
								at(
									"lg",
									BAND,
									raw({ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: "4rem" }),
								),
							]),
						]}
					>
						<div mix={[raw({ display: "grid", gap: "1rem" })]}>
							<p
								mix={[
									raw({
										margin: "0",
										fontFamily: "var(--ui-font-display)",
										fontWeight: "700",
										fontSize: "clamp(2rem, 4vw, 2.75rem)",
										lineHeight: "1.1",
										letterSpacing: "-0.03em",
										color: "var(--ui-neutral-fg-emphasis)",
										textWrap: "balance",
									}),
								]}
							>
								{finished}% finish all six modules
							</p>
							<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg)", textWrap: "pretty" })]}>
								Most people who stop, stop at opening and pulling, the module where the wheel stops
								forgiving. So module 3 has the most practice time, and one of its lessons is free,
								to try before you reach it.
							</p>
						</div>
						<DrawnChart
							aria-label={`Share of students who finished each module, falling from ${COMPLETION[0]!.percent}% to ${finished}%`}
							pauseLabel="Pause the chart"
							metric={{ value: COHORT_SIZE, label: "students started January to June 2025" }}
							series={COMPLETION.map((entry) => ({
								label: `${entry.module} · ${MODULES[entry.module - 1]!.title}`,
								value: entry.percent,
								display: `${entry.percent}%`,
							}))}
							max={100}
							highlight={COMPLETION.length - 1}
							footnote="Finished a module means watched every lesson and logged its piece. Self-paced and cohort students together."
						/>
					</div>
				</div>
			</LandingSection>
		);
	};
}

/**
 * One shared piece: the pot on a soft plinth, then whose it is, when, and the note.
 *
 * @param handle Runtime handle carrying the piece and its position.
 * @returns The render function producing the card.
 */
function PieceCard(handle: Handle<{ piece: Piece; index: number }>) {
	return () => {
		let { index, piece } = handle.props;
		return (
			<figure
				mix={[
					raw({
						margin: "0",
						display: "grid",
						gap: "0.75rem",
						blockSize: "100%",
						alignContent: "start",
						padding: "0.75rem 0.75rem 1rem",
						boxSizing: "border-box",
						borderRadius: "var(--ui-landing-card-radius-outer)",
						backgroundColor: "var(--ui-surface-raised)",
						boxShadow: "var(--ui-shadow-surface)",
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "grid",
							placeItems: "center",
							aspectRatio: "4 / 3",
							borderRadius: "var(--ui-landing-card-radius-inner)",
							background:
								"linear-gradient(to bottom, var(--ui-neutral-bg-tint), var(--ui-neutral-bg-tint-hover))",
						}),
					]}
				>
					<span mix={[raw({ display: "block", inlineSize: "55%", aspectRatio: "1" })]}>
						<Pot id={`work-${index}`} shape={piece.shape} glaze={piece.glaze} tilt={piece.tilt} />
					</span>
				</div>
				<figcaption mix={[raw({ display: "grid", gap: "0.25rem", paddingInline: "0.25rem" })]}>
					<span
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								gap: "0.5rem",
								alignItems: "baseline",
							}),
						]}
					>
						<span mix={[raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}>
							{piece.student}
						</span>
						<span
							mix={[
								raw({
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.75rem",
									color: "var(--ui-neutral-fg-muted)",
									fontVariantNumeric: "tabular-nums",
								}),
							]}
						>
							Module {piece.module} · week {piece.week}
						</span>
					</span>
					<span
						mix={[
							raw({
								fontSize: "0.875rem",
								lineHeight: "1.375rem",
								color: "var(--ui-neutral-fg)",
								textWrap: "pretty",
							}),
						]}
					>
						{piece.note}
					</span>
				</figcaption>
			</figure>
		);
	};
}
