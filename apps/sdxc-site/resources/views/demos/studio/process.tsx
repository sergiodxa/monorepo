/**
 * Quoin's process as a printed schedule: five phases on a sixteen-week scale, each bar set
 * where the phase runs and each phase naming what the client holds at its end, so the
 * overlap between designing and building is drawn rather than described.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { LandingSection } from "@sdxc/ui/landing";
import { landingLead } from "@sdxc/ui/styles";

import { renderNearView } from "~/resources/views/demos/near-view";
import {
	BAND,
	caption,
	chapter,
	pageGrid,
	RULE,
	runningHead,
	span,
} from "~/resources/views/demos/studio/grid";
import { DIDONE } from "~/resources/views/demos/studio/type";

/** How many weeks the scale runs. */
const WEEKS = 16;

/** The weeks the scale labels; the rest are hairlines only. */
const SCALE = [1, 4, 8, 12, 16];

/** The phases, each with its first and last week and what the client holds when it ends. */
const PHASES = [
	{
		name: "Brief and audit",
		from: 1,
		to: 2,
		outcome: "A written audit, and the one number we agree to move.",
	},
	{
		name: "Field study",
		from: 2,
		to: 4,
		outcome: "Twenty interviews, held where the work happens.",
	},
	{
		name: "Prototype",
		from: 4,
		to: 8,
		outcome: "A working prototype, tested with the same twenty people.",
	},
	{
		name: "Build",
		from: 7,
		to: 14,
		outcome: "Production code, released weekly to a staging you use.",
	},
	{
		name: "Launch and measure",
		from: 14,
		to: 16,
		outcome: "The release, then the number again at 30 and 90 days.",
		measured: true,
	},
];

/**
 * Renders the claim, then the schedule: on a phone each phase over its own full-width
 * track, from the `lg` container the phase in four columns beside its track in eight.
 *
 * @returns The render function producing the process band.
 */
export default function StudioProcess() {
	return () => (
		<LandingSection id="process" tone="tinted" mix={[renderNearView(997, 1398)]}>
			<div mix={[pageGrid(), raw({ rowGap: "3rem" })]}>
				<p mix={[runningHead()]}>
					<span>03 — Process</span>
					<span>A typical engagement</span>
				</p>
				<div mix={[span("1 / 8"), raw({ display: "grid", gap: "1.5rem" })]}>
					<h2 mix={[chapter()]}>Sixteen weeks, and design never stops at handoff</h2>
				</div>
				<p mix={[span("8 / -1"), landingLead(), raw({ margin: "0", alignSelf: "end" })]}>
					The designers who interviewed your team are still in the room when the build starts in
					week seven, so the product that ships is <strong>the one that was tested</strong>.
				</p>
				<ol aria-label="Sixteen-week schedule" mix={[schedule()]}>
					<li
						aria-hidden="true"
						mix={[row(), raw({ paddingBlock: "0 0.5rem", borderBlockStart: "0" })]}
					>
						<span />
						<span mix={[track(), raw({ backgroundImage: "none" })]}>
							{SCALE.map((week) => (
								<span
									key={week}
									mix={[
										caption(),
										raw({
											gridColumn: `${week}`,
											gridRow: "1",
											justifySelf: week === WEEKS ? "end" : "start",
										}),
									]}
								>
									W{week}
								</span>
							))}
						</span>
					</li>
					{PHASES.map((phase) => (
						<li key={phase.name} mix={[row()]}>
							<div mix={[raw({ display: "grid", gap: "0.375rem" })]}>
								<span
									mix={[
										raw({
											fontFamily: DIDONE,
											fontSize: "1.625rem",
											lineHeight: "1.15",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								>
									{phase.name}
								</span>
								<span mix={[caption()]}>
									Weeks {phase.from}–{phase.to}
								</span>
								<span
									mix={[
										raw({ color: "var(--ui-neutral-fg)", lineHeight: "1.5", textWrap: "pretty" }),
									]}
								>
									{phase.outcome}
								</span>
							</div>
							<span mix={[track()]}>
								<span
									data-slot="studio-phase-bar"
									mix={[
										raw({
											gridColumn: `${phase.from} / ${phase.to + 1}`,
											gridRow: "1",
											alignSelf: "center",
											blockSize: "0.875rem",
											backgroundColor: phase.measured
												? "var(--ui-brand-fg)"
												: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								/>
							</span>
						</li>
					))}
				</ol>
			</div>
		</LandingSection>
	);
}

/** The schedule list, across all twelve columns. */
function schedule() {
	return raw({
		gridColumn: "1 / -1",
		margin: "0",
		padding: "0",
		listStyle: "none",
		display: "grid",
	});
}

/** One row: the phase over its track on a phone, four columns to eight from `lg`. */
function row() {
	return [
		raw({
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr)",
			gap: "1rem 2rem",
			paddingBlock: "1.25rem",
			borderBlockStart: RULE,
		}),
		at(
			"lg",
			BAND,
			raw({ gridTemplateColumns: "minmax(0, 4fr) minmax(0, 8fr)", alignItems: "center" }),
		),
	];
}

/** A track of sixteen weeks, each week's start drawn as a faint hairline. */
function track() {
	return raw({
		display: "grid",
		gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`,
		minBlockSize: "1.5rem",
		backgroundImage: `repeating-linear-gradient(to right, var(--ui-landing-hairline) 0 1px, transparent 1px calc(100% / ${WEEKS}))`,
	});
}
