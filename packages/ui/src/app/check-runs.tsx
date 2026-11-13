/**
 * The checks on a commit or pull request: one sentence counting them by state ("1 failing,
 * 1 pending and 22 successful checks") that discloses the list, sorted failures first. Each
 * state carries its own icon shape as well as its tone, and the whole part works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import {
	ChevronDownIcon,
	CircleCheckIcon,
	CircleDotIcon,
	CircleMinusIcon,
	CircleSlashIcon,
	CircleXIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { animationHost, keyframes } from "@sdxc/u/animation";
import { fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import { flex, gap, grow, inlineFlex, items, shrink } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { minIs, pb, pi } from "@sdxc/u/size";
import { focusVisible, hover, when } from "@sdxc/u/state";
import {
	font,
	nowrap,
	tabularNums,
	text,
	textDecoration,
	truncate,
	weight,
} from "@sdxc/u/typography";

/** Order rows and the summary's counts follow: what needs attention first, settled runs last. */
const STATE_ORDER: Record<CheckRuns.State, number> = {
	failure: 0,
	pending: 1,
	success: 2,
	skipped: 3,
	cancelled: 3,
};

/** The states in the order the summary sentence counts them. */
const SUMMARY_STATES: CheckRuns.State[] = ["failure", "pending", "success", "skipped", "cancelled"];

/**
 * Prop types for {@link CheckRuns}.
 */
export namespace CheckRuns {
	/** Where one run stands; `failure` reads danger, `pending` warning, `success` success. */
	export type State = "success" | "failure" | "pending" | "skipped" | "cancelled";

	/** One check run. */
	export interface Run {
		/** The job's name ("test (ubuntu-latest)"). */
		name: string;
		/** The workflow it belongs to ("CI / pull_request"). */
		workflow?: string;
		state: State;
		/** How long it ran, already formatted ("2m 14s"). */
		duration?: string;
		/** Where its log lives; the row's Details link. */
		href?: string;
	}

	/** Every string the part shows, so an app translates each one. */
	export interface Labels {
		/** One count of the summary per state, plural-aware: `(1) => "1 failing"`. */
		counts: Record<State, (count: number) => string>;
		/**
		 * The whole sentence around the joined counts, plural on the total:
		 * `(list, total) => \`${list} ${total === 1 ? "check" : "checks"}\``.
		 */
		summary: (list: string, total: number) => string;
		/** The name each state's icon announces ("Failed", "In progress"). */
		states: Record<State, string>;
		/** The row link's text ("Details"); the run's name follows it for assistive technology. */
		details: string;
		/** The summary when there are no runs ("No checks"). */
		empty: string;
	}

	/** Props accepted by {@link CheckRunIcon}. */
	export interface IconProps {
		state: State;
		/** The state's name, announced in place of the shape ("Failed"). */
		label: string;
	}

	/** Props accepted by {@link CheckRuns}; the host is a `<details>`. */
	export interface Props extends Omit<TagProps<"details">, "children" | "open"> {
		runs: readonly Run[];
		labels: Labels;
		/** Locale the counts are joined in ("1 failing, 1 pending and 22 successful"). */
		locale?: string;
		/**
		 * Whether the list starts open. Unset, it opens exactly when a run failed, so the
		 * failure is on screen and a green list stays one line.
		 */
		open?: boolean;
	}
}

/**
 * Sorts runs failure → pending → success → skipped and cancelled, keeping the given order
 * within a state, so the run that needs attention is the first row.
 *
 * @param runs The runs in any order.
 * @returns A sorted copy.
 */
export function sortCheckRuns(runs: readonly CheckRuns.Run[]): CheckRuns.Run[] {
	return runs
		.map((run, index) => ({ run, index }))
		.sort((a, b) => STATE_ORDER[a.run.state] - STATE_ORDER[b.run.state] || a.index - b.index)
		.map(({ run }) => run);
}

/**
 * Writes the summary sentence: each state with runs counted through `labels.counts`, joined as
 * a list in `locale`, then wrapped by `labels.summary` with the total for its plural.
 *
 * @param runs The runs to count.
 * @param labels The part's strings.
 * @param locale Locale the counts are joined in.
 * @returns The sentence, or `labels.empty` when there are no runs.
 * @example checkRunsSummary(runs, labels, "en-GB") // "1 failing, 1 pending and 22 successful checks"
 */
export function checkRunsSummary(
	runs: readonly CheckRuns.Run[],
	labels: CheckRuns.Labels,
	locale?: string,
): string {
	if (runs.length === 0) return labels.empty;
	let parts = SUMMARY_STATES.flatMap((state) => {
		let count = runs.filter((run) => run.state === state).length;
		return count === 0 ? [] : [labels.counts[state](count)];
	});
	let list = new Intl.ListFormat(locale, { type: "conjunction", style: "long" }).format(parts);
	return labels.summary(list, runs.length);
}

/**
 * The state the whole set reads as: the first run after sorting, so one failure makes the set
 * failing, a running check makes it pending, and a single pass outweighs skipped runs.
 *
 * @param runs The runs to summarise.
 * @returns The overall state, or `undefined` for no runs.
 */
function overallState(runs: readonly CheckRuns.Run[]): CheckRuns.State | undefined {
	return sortCheckRuns(runs)[0]?.state;
}

/**
 * Renders the summary sentence as the `<summary>` of a `<details>` that lists every run, failed
 * ones first. The list opens on its own when a run failed; the pending icon pulses and holds still
 * for visitors who prefer reduced motion. Each row links to its log.
 *
 * @param handle Runtime handle carrying the host `<details>`'s props.
 * @returns The render function producing the part's markup.
 * @example
 * <CheckRuns
 * 	runs={runs}
 * 	locale="en"
 * 	labels={{
 * 		counts: { failure: (n) => `${n} failing`, pending: (n) => `${n} pending`, success: (n) => `${n} successful`, skipped: (n) => `${n} skipped`, cancelled: (n) => `${n} cancelled` },
 * 		summary: (list, total) => `${list} ${total === 1 ? "check" : "checks"}`,
 * 		states: { failure: "Failed", pending: "In progress", success: "Passed", skipped: "Skipped", cancelled: "Cancelled" },
 * 		details: "Details",
 * 		empty: "No checks",
 * 	}}
 * />
 */
export function CheckRuns(handle: Handle<CheckRuns.Props>) {
	return () => {
		let { runs, labels, locale, open, mix, ...rest } = handle.props;
		let sorted = sortCheckRuns(runs);
		let overall = overallState(runs);
		let isOpen = open ?? runs.some((run) => run.state === "failure");

		return (
			<details
				{...rest}
				open={isOpen}
				data-slot="check-runs"
				data-state={overall}
				mix={mergeMix([minIs(0), text("sm")], mix)}
			>
				<summary
					data-slot="check-runs-summary"
					mix={[
						flex(),
						items("center"),
						gap(2),
						pb(1),
						rounded("sm"),
						cursor("pointer"),
						weight("medium"),
						fg("neutral.emphasis"),
						raw({ listStyle: "none", "&::-webkit-details-marker": { display: "none" } }),
						focusVisible(outline({ color: "brand.ring", offset: 2 })),
					]}
				>
					{overall === undefined ? null : (
						<CheckRunIcon state={overall} label={labels.states[overall]} />
					)}
					<span mix={[grow(), minIs(0)]}>{checkRunsSummary(runs, labels, locale)}</span>
					{runs.length === 0 ? null : (
						<ChevronDownIcon
							size={16}
							aria-hidden="true"
							mix={[
								shrink(0),
								fg("neutral.muted"),
								raw({ transition: "rotate 150ms ease" }),
								when(":is(details[open] > summary) > &", raw({ rotate: "180deg" })),
							]}
						/>
					)}
				</summary>
				{runs.length === 0 ? null : (
					<ul data-slot="check-runs-list" mix={[raw({ listStyle: "none", margin: 0, padding: 0 })]}>
						{sorted.map((run, index) => (
							<CheckRunRow key={index} run={run} labels={labels} />
						))}
					</ul>
				)}
			</details>
		);
	};
}

/** Props for {@link CheckRunRow}. */
interface CheckRunRowProps {
	run: CheckRuns.Run;
	labels: CheckRuns.Labels;
}

/**
 * One run as a ruled row: its icon, name and workflow, duration, and a Details link whose
 * accessible name ends with the run's name, so a list of "Details" links stays distinguishable.
 *
 * @param handle Runtime handle carrying the run and the part's strings.
 * @returns The render function producing the row.
 */
function CheckRunRow(handle: Handle<CheckRunRowProps>) {
	return () => {
		let { run, labels } = handle.props;

		return (
			<li
				data-slot="check-run"
				data-state={run.state}
				mix={[
					flex(),
					items("center"),
					gap(2),
					pb(1.5),
					pi(1),
					minIs(0),
					raw({ borderBlockStart: "1px solid var(--ui-neutral-border)" }),
				]}
			>
				<CheckRunIcon state={run.state} label={labels.states[run.state]} />
				<span mix={[flex(), items("baseline"), gap(2), grow(), minIs(0)]}>
					<span
						data-slot="check-run-name"
						mix={[weight("medium"), fg("neutral.emphasis"), truncate()]}
					>
						{run.name}
					</span>
					{run.workflow === undefined ? null : (
						<span data-slot="check-run-workflow" mix={[fg("neutral.muted"), truncate(), minIs(0)]}>
							{run.workflow}
						</span>
					)}
				</span>
				{run.duration === undefined ? null : (
					<span
						data-slot="check-run-duration"
						mix={[
							shrink(0),
							font("mono"),
							text("xs"),
							fg("neutral.muted"),
							tabularNums(),
							nowrap(),
						]}
					>
						{run.duration}
					</span>
				)}
				{run.href === undefined ? null : (
					<a
						href={run.href}
						data-slot="check-run-details"
						mix={[
							shrink(0),
							rounded("sm"),
							fg("brand"),
							textDecoration("none"),
							hover(textDecoration("underline")),
							focusVisible(outline({ color: "brand.ring", offset: 2 })),
						]}
					>
						{labels.details}
						<span mix={[visuallyHidden()]}> {run.name}</span>
					</a>
				)}
			</li>
		);
	};
}

/**
 * A state's named icon, read by shape as well as tone (✗ failure, ● pending, ✓ success, ⊘ skipped,
 * ⊖ cancelled), also usable alone as a commit's status. The pending icon pulses until the run
 * settles, and holds still under reduced motion.
 *
 * @param handle Runtime handle carrying the state and its name.
 * @returns The render function producing the icon.
 * @example <CheckRunIcon state="failure" label={t("checks.failed")} />
 */
export function CheckRunIcon(handle: Handle<CheckRuns.IconProps>) {
	return () => {
		let { state, label } = handle.props;

		return (
			<span
				role="img"
				aria-label={label}
				data-slot="check-run-icon"
				data-state={state}
				mix={[
					inlineFlex(),
					shrink(0),
					fg("neutral.muted"),
					when('&[data-state="failure"]', fg("danger")),
					when('&[data-state="pending"]', [
						fg("warning"),
						keyframes("ui-check-run-pending", {
							"0%, 100%": { opacity: 1 },
							"50%": { opacity: 0.35 },
						}),
						motionSafe(
							animationHost("ui-check-run-pending", {
								duration: "1.4s",
								easing: "ease-in-out",
								iterationCount: "infinite",
							}),
						),
					]),
					when('&[data-state="success"]', fg("success")),
				]}
			>
				<StateGlyph state={state} />
			</span>
		);
	};
}

/** Props for {@link StateGlyph}. */
interface StateGlyphProps {
	state: CheckRuns.State;
}

/**
 * Draws the glyph for one state at the row's 16px icon size.
 *
 * @param handle Runtime handle carrying the state.
 * @returns The render function producing the glyph.
 */
function StateGlyph(handle: Handle<StateGlyphProps>) {
	return () => {
		let { state } = handle.props;
		switch (state) {
			case "failure":
				return <CircleXIcon size={16} aria-hidden="true" />;
			case "pending":
				return <CircleDotIcon size={16} aria-hidden="true" />;
			case "success":
				return <CircleCheckIcon size={16} aria-hidden="true" />;
			case "skipped":
				return <CircleSlashIcon size={16} aria-hidden="true" />;
			case "cancelled":
				return <CircleMinusIcon size={16} aria-hidden="true" />;
		}
	};
}
