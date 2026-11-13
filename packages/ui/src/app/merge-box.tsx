/**
 * The box at the end of a pull request that answers "can I merge, and if not, why?": one ruled
 * row per precondition (reviews, checks, conflicts), then a split merge button whose method menu
 * is a native radio group. Merging is a plain form POST, so the whole box works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import {
	CheckIcon,
	ChevronDownIcon,
	CircleCheckIcon,
	CircleDotIcon,
	CircleIcon,
	CircleXIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import { flex, flexCol, flexWrap, gap, grow, inlineFlex, items, shrink } from "@sdxc/u/layout";
import { minIs, p, pb, pi } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { leading, pretty, text, weight } from "@sdxc/u/typography";

import { Button } from "../components/button.js";
import { Card } from "../components/card.js";
import { Group } from "../components/group.js";
import { Popover } from "../components/popover.js";

/** The methods offered when `methods` is unset, in the order the menu lists them. */
const DEFAULT_METHODS: MergeBox.Method[] = ["merge", "squash", "rebase"];

/** The rows a box draws, top to bottom, when each is given. */
const ROW_ORDER: (keyof MergeBox.Rows)[] = ["reviews", "checks", "conflicts"];

/** The field name the chosen method posts under. */
const METHOD_FIELD = "method";

/**
 * Prop types for {@link MergeBox}.
 */
export namespace MergeBox {
	/**
	 * Where the pull request stands: `ready` can merge, `blocked` waits on a review or a check,
	 * `conflicts` needs the branch updated, and `merged` and `closed` are settled.
	 */
	export type State = "ready" | "blocked" | "conflicts" | "merged" | "closed";

	/** How the branch lands: a merge commit, one squashed commit, or rebased commits. */
	export type Method = "merge" | "squash" | "rebase";

	/** The tone a row reads in: met is `success`, waiting `warning`, failing `danger`. */
	export type Tone = "success" | "warning" | "danger" | "neutral";

	/** One precondition. */
	export interface Row {
		tone: Tone;
		/** The row's claim ("1 approving review", "All checks have passed"). */
		title: RemixNode;
		/** One sentence under the title ("24 successful checks"). */
		detail?: RemixNode;
		/** Content below the row's text, such as a `CheckRuns` list. */
		children?: RemixNode;
	}

	/** The precondition rows, drawn in this order when given. */
	export interface Rows {
		reviews?: Row;
		checks?: Row;
		conflicts?: Row;
	}

	/** Every string the box shows, so an app translates each one. */
	export interface Labels {
		/** Each method's button text ("Merge pull request", "Squash and merge", "Rebase and merge"). */
		methods: Record<Method, string>;
		/** One line under each method in the menu ("All commits will be added to the base branch"). */
		methodDetails?: Partial<Record<Method, string>>;
		/** The menu toggle's name and the menu's legend ("Choose a merge method"). */
		chooseMethod: string;
		/**
		 * One sentence per state: for `blocked` and `conflicts` the reason the button is disabled,
		 * for `merged` and `closed` the outcome, and for `ready` an optional hint.
		 */
		status: Partial<Record<State, string>>;
	}

	/** Props accepted by {@link MergeBox}; the host is a `<section>`. */
	export interface Props extends Omit<TagProps<"section">, "children"> {
		state: State;
		rows?: Rows;
		/** The methods offered. @default ["merge", "squash", "rebase"] */
		methods?: Method[];
		/** The method chosen when the box renders. Defaults to the first of `methods`. */
		defaultMethod?: Method;
		/** Where the form posts; the body carries `method` and any `fields`. */
		action: string;
		/** Extra hidden fields posted with the merge, such as a CSRF token. */
		fields?: RemixNode;
		/** What follows a settled pull request, such as a "Delete branch" form. */
		followUp?: RemixNode;
		labels: Labels;
	}
}

/**
 * Renders the precondition rows, then the merge control or the outcome. While the request can't
 * merge, both halves of the split button stay on screen, disabled, and the sentence naming why is
 * their `aria-describedby`. The method menu is a radio group posting `method`; the submit button
 * names the chosen method through CSS, so choosing one needs no script.
 *
 * @param handle Runtime handle carrying the host `<section>`'s props.
 * @returns The render function producing the box's markup.
 * @example
 * <MergeBox
 * 	state="ready"
 * 	action={href("pulls.merge", { number })}
 * 	rows={{
 * 		reviews: { tone: "success", title: t("pr.approved", { count: 1 }) },
 * 		checks: { tone: "success", title: t("pr.checksPassed"), children: <CheckRuns runs={runs} labels={checkLabels} /> },
 * 		conflicts: { tone: "success", title: t("pr.noConflicts") },
 * 	}}
 * 	labels={mergeLabels}
 * />
 */
export function MergeBox(handle: Handle<MergeBox.Props>) {
	return () => {
		let {
			state,
			rows = {},
			methods = DEFAULT_METHODS,
			defaultMethod,
			action,
			fields,
			followUp,
			labels,
			mix,
			...rest
		} = handle.props;
		let given = ROW_ORDER.flatMap((key) => {
			let row = rows[key];
			return row === undefined ? [] : [{ key, row }];
		});

		return (
			<Card
				{...rest}
				data-slot="merge-box"
				data-state={state}
				mix={mergeMix([raw({ overflow: "clip" }), minIs(0)], mix)}
			>
				{given.map(({ key, row }) => (
					<MergeBoxRow key={key} name={key} row={row} />
				))}
				{state === "merged" || state === "closed" ? (
					<MergeBoxOutcome state={state} message={labels.status[state]} followUp={followUp} />
				) : (
					<MergeBoxControl
						id={handle.id}
						state={state}
						methods={methods}
						defaultMethod={
							defaultMethod !== undefined && methods.includes(defaultMethod)
								? defaultMethod
								: (methods[0] ?? "merge")
						}
						action={action}
						fields={fields}
						labels={labels}
					/>
				)}
			</Card>
		);
	};
}

/** Props for {@link MergeBoxRow}. */
interface MergeBoxRowProps {
	name: keyof MergeBox.Rows;
	row: MergeBox.Row;
}

/**
 * One precondition as a ruled row: a toned icon whose shape follows the tone (✓ met, ● waiting,
 * ✗ failing), the title, the detail, then any content such as the check list.
 *
 * @param handle Runtime handle carrying the row.
 * @returns The render function producing the row.
 */
function MergeBoxRow(handle: Handle<MergeBoxRowProps>) {
	return () => {
		let { name, row } = handle.props;

		return (
			<div
				data-slot="merge-box-row"
				data-row={name}
				data-tone={row.tone}
				mix={[
					flex(),
					gap(3),
					p(4),
					minIs(0),
					when("& + &", raw({ borderBlockStart: "1px solid var(--ui-neutral-border)" })),
				]}
			>
				<ToneIcon tone={row.tone} />
				<div mix={[flex(), flexCol(), gap(1), grow(), minIs(0)]}>
					<span
						data-slot="merge-box-row-title"
						mix={[weight("semibold"), fg("neutral.emphasis"), leading(1.4), pretty()]}
					>
						{row.title}
					</span>
					{row.detail === undefined ? null : (
						<span
							data-slot="merge-box-row-detail"
							mix={[text("sm"), fg("neutral.muted"), pretty()]}
						>
							{row.detail}
						</span>
					)}
					{row.children === undefined ? null : <div mix={[minIs(0), pb(1)]}>{row.children}</div>}
				</div>
			</div>
		);
	};
}

/** Props for {@link ToneIcon}. */
interface ToneIconProps {
	tone: MergeBox.Tone;
}

/**
 * A row's icon in a filled circle of its tone. The shape repeats the tone, so a row never relies
 * on hue alone; the title beside it names the state, so the icon is decorative.
 *
 * @param handle Runtime handle carrying the tone.
 * @returns The render function producing the icon.
 */
function ToneIcon(handle: Handle<ToneIconProps>) {
	return () => {
		let { tone } = handle.props;

		return (
			<span
				aria-hidden="true"
				data-slot="merge-box-icon"
				data-tone={tone}
				mix={[
					inlineFlex(),
					items("center"),
					raw({ justifyContent: "center", inlineSize: "2rem", blockSize: "2rem" }),
					shrink(0),
					rounded("full"),
					bg("neutral.tint"),
					fg("neutral.muted"),
					when('&[data-tone="success"]', [bg("success.solid"), fg("success.onSolid")]),
					when('&[data-tone="warning"]', [bg("warning.solid"), fg("warning.onSolid")]),
					when('&[data-tone="danger"]', [bg("danger.solid"), fg("danger.onSolid")]),
				]}
			>
				<ToneGlyph tone={tone} />
			</span>
		);
	};
}

/**
 * The glyph for one tone at the row icon's 16px size.
 *
 * @param handle Runtime handle carrying the tone.
 * @returns The render function producing the glyph.
 */
function ToneGlyph(handle: Handle<ToneIconProps>) {
	return () => {
		switch (handle.props.tone) {
			case "success":
				return <CircleCheckIcon size={16} />;
			case "warning":
				return <CircleDotIcon size={16} />;
			case "danger":
				return <CircleXIcon size={16} />;
			case "neutral":
				return <CircleIcon size={16} />;
		}
	};
}

/** Props for {@link MergeBoxControl}. */
interface MergeBoxControlProps {
	id: string;
	state: MergeBox.State;
	methods: MergeBox.Method[];
	defaultMethod: MergeBox.Method;
	action: string;
	fields?: RemixNode;
	labels: MergeBox.Labels;
}

/**
 * The merge form: a submit button joined to a toggle that opens the method menu, and the
 * state's sentence. Each method's label sits in the submit button and only the checked radio's
 * shows, so the button's text and accessible name follow the choice with no script. The submit
 * button states `formmethod` because the `method` radios shadow `form.method` for any script that
 * reads it. Space picks a method in the menu, Escape closes it, and Enter merges.
 *
 * @param handle Runtime handle carrying the form's inputs.
 * @returns The render function producing the form.
 */
function MergeBoxControl(handle: Handle<MergeBoxControlProps>) {
	return () => {
		let { id, state, methods, defaultMethod, action, fields, labels } = handle.props;
		let menuId = `${id}-methods`;
		let statusId = `${id}-status`;
		let disabled = state !== "ready";
		let status = labels.status[state];
		let describedBy = status === undefined ? undefined : statusId;
		let chosenRules: Parameters<typeof raw>[0] = {
			'& [data-slot="merge-box-method-label"]': { display: "none" },
		};
		for (let method of methods) {
			chosenRules[
				`&:has(input[name="${METHOD_FIELD}"][value="${method}"]:checked) [data-slot="merge-box-method-label"][data-method="${method}"]`
			] = { display: "inline" };
		}

		return (
			<form
				method="post"
				action={action}
				data-slot="merge-box-form"
				mix={[
					flex(),
					flexWrap(),
					items("center"),
					gap(3),
					p(4),
					raw({
						borderBlockStart: "1px solid var(--ui-neutral-border)",
						"&:first-child": { borderBlockStart: "none" },
					}),
					raw(chosenRules),
				]}
			>
				{fields}
				<Group>
					<Button
						type="submit"
						formmethod="post"
						color={disabled ? "neutral" : "success"}
						disabled={disabled}
						aria-describedby={describedBy}
						data-slot="merge-box-submit"
					>
						{methods.map((method) => (
							<span data-slot="merge-box-method-label" data-method={method}>
								{labels.methods[method]}
							</span>
						))}
					</Button>
					<Button
						color={disabled ? "neutral" : "success"}
						disabled={disabled}
						commandfor={menuId}
						command="toggle-popover"
						aria-label={labels.chooseMethod}
						aria-describedby={describedBy}
						aria-haspopup="true"
						data-slot="merge-box-toggle"
						mix={[
							pi(2.5),
							raw({ borderRadius: "var(--ui-button-radius, var(--ui-radius-md, 0.375rem))" }),
						]}
					>
						<ChevronDownIcon size={16} aria-hidden="true" />
					</Button>
				</Group>
				<Popover
					id={menuId}
					placement="bottom-start"
					data-slot="merge-box-methods"
					mix={[p(1), raw({ minInlineSize: "16rem", maxInlineSize: "min(22rem, 100vw - 2rem)" })]}
				>
					<fieldset mix={[raw({ border: "none", margin: 0, padding: 0, minInlineSize: 0 })]}>
						<legend mix={[visuallyHidden()]}>{labels.chooseMethod}</legend>
						{methods.map((method) => (
							<MethodOption
								method={method}
								checked={method === defaultMethod}
								label={labels.methods[method]}
								detail={labels.methodDetails?.[method]}
							/>
						))}
					</fieldset>
				</Popover>
				{status === undefined ? null : (
					<p
						id={statusId}
						data-slot="merge-box-status"
						mix={[
							raw({ margin: 0, flex: "1 1 12rem" }),
							minIs(0),
							text("sm"),
							fg("neutral.muted"),
							pretty(),
						]}
					>
						{status}
					</p>
				)}
			</form>
		);
	};
}

/** Props for {@link MethodOption}. */
interface MethodOptionProps {
	method: MergeBox.Method;
	checked: boolean;
	label: string;
	detail?: string;
}

/**
 * One method as a menu row: a visually hidden radio posting `method`, a check that marks the
 * chosen row, the method's name and its one-line detail. The whole row is the radio's label.
 *
 * @param handle Runtime handle carrying the method and its strings.
 * @returns The render function producing the row.
 */
function MethodOption(handle: Handle<MethodOptionProps>) {
	return () => {
		let { method, checked, label, detail } = handle.props;

		return (
			<label
				data-slot="merge-box-method"
				data-method={method}
				mix={[
					flex(),
					items("start"),
					gap(2),
					pi(3),
					pb(2),
					rounded("md"),
					cursor("default"),
					text("sm"),
					fg("neutral.emphasis"),
					hover(bg("neutral.bg-tint-hover")),
					when("&:has(:focus-visible)", [
						bg("brand.tint"),
						outline({ color: "brand.ring", offset: 2 }),
					]),
					when("& > svg", [
						raw({ visibility: "hidden", marginBlockStart: "0.125rem" }),
						shrink(0),
						fg("brand"),
					]),
					when("&:has(:checked) > svg", raw({ visibility: "visible" })),
				]}
			>
				<input
					type="radio"
					name={METHOD_FIELD}
					value={method}
					defaultChecked={checked}
					mix={[visuallyHidden()]}
				/>
				<CheckIcon size={16} aria-hidden="true" />
				<span mix={[flex(), flexCol(), gap(0.5), minIs(0)]}>
					<span mix={[weight("medium")]}>{label}</span>
					{detail === undefined ? null : (
						<span mix={[text("xs"), fg("neutral.muted"), pretty()]}>{detail}</span>
					)}
				</span>
			</label>
		);
	};
}

/** Props for {@link MergeBoxOutcome}. */
interface MergeBoxOutcomeProps {
	state: "merged" | "closed";
	message?: string;
	followUp?: RemixNode;
}

/**
 * The settled box: the outcome with its icon, and the follow-up beside it, such as "Delete branch".
 *
 * @param handle Runtime handle carrying the outcome.
 * @returns The render function producing the outcome row.
 */
function MergeBoxOutcome(handle: Handle<MergeBoxOutcomeProps>) {
	return () => {
		let { state, message, followUp } = handle.props;

		return (
			<div
				data-slot="merge-box-outcome"
				data-state={state}
				mix={[
					flex(),
					flexWrap(),
					items("center"),
					gap(3),
					p(4),
					raw({
						borderBlockStart: "1px solid var(--ui-neutral-border)",
						"&:first-child": { borderBlockStart: "none" },
					}),
				]}
			>
				<span
					aria-hidden="true"
					data-slot="merge-box-icon"
					data-state={state}
					mix={[
						inlineFlex(),
						items("center"),
						raw({ justifyContent: "center", inlineSize: "2rem", blockSize: "2rem" }),
						shrink(0),
						rounded("full"),
						bg("brand.solid"),
						fg("brand.onSolid"),
						when('&[data-state="closed"]', [bg("danger.solid"), fg("danger.onSolid")]),
					]}
				>
					{state === "merged" ? <GitMergeIcon size={16} /> : <GitPullRequestClosedIcon size={16} />}
				</span>
				{message === undefined ? null : (
					<p
						data-slot="merge-box-status"
						mix={[raw({ margin: 0, flex: "1 1 12rem" }), minIs(0), weight("medium"), pretty()]}
					>
						{message}
					</p>
				)}
				{followUp === undefined ? null : (
					<div data-slot="merge-box-follow-up" mix={[shrink(0)]}>
						{followUp}
					</div>
				)}
			</div>
		);
	};
}
