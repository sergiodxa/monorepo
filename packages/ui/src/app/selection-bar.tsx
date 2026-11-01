/**
 * The floating bar at the foot of a list: it reads "Viewing 1–50 of 1,234" with previous and
 * next links, and morphs into "✕ 3 selected · Pause P · Delete X" once rows are checked, each
 * action a submit button that posts the checked ids and answers to its key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { opacity, rounded, visibility } from "@sdxc/u/effects";
import { mergeMix, pointerEvents, raw } from "@sdxc/u/general";
import {
	center,
	flex,
	flexWrap,
	gap,
	hidden,
	inlineFlex,
	insBe,
	items,
	justify,
	shrink,
	sticky,
	zstack,
} from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, maxIs, mi, mis, pb, pi, pie, pis } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { scale } from "@sdxc/u/transform";
import { nowrap, tabularNums, text, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { durations, easings } from "../animations/tokens.js";
import { Button } from "../components/button.js";
import { Keyboard } from "../components/keyboard.js";
import { floatingSurface } from "../styles/floating-surface.js";
import { interactiveTransition } from "../styles/interactive-transition.js";

import { selectionBarSync } from "./mixins/selection-bar-sync.js";

/** Distance the bar keeps from the bottom of its scroll container. */
const OFFSET = "var(--ui-selection-bar-offset, 1rem)";

/** Prop types for {@link SelectionBar} and {@link SelectionBarController}. */
export namespace SelectionBar {
	/**
	 * A bulk action: a submit button for the form holding the rows' checkboxes, so it sends
	 * every checked id under the checkboxes' own name.
	 */
	export interface Action {
		label: string;
		/** A single key that runs the action while rows are selected, printed as a key cap. */
		key?: string;
		/** A glyph before the label, decorative. */
		icon?: RemixNode;
		/** Where the action posts; defaults to the form's own `action`. */
		formAction?: string;
		/** @default "post" */
		formMethod?: "get" | "post";
		/** Submitted with `value`, so one endpoint can tell the actions apart (`intent=archive`). */
		name?: string;
		value?: string;
		/** Draws the action in the danger tone; put it last. */
		danger?: boolean;
	}

	/** What the bar shows while nothing is selected. */
	export interface Pagination {
		/** The range text, such as "Viewing 1–50 of 1,234". */
		summary: RemixNode;
		/** The previous page's URL; omitted disables the link. */
		previous?: string;
		/** The next page's URL; omitted disables the link. */
		next?: string;
	}

	/** Every string the bar shows or announces. */
	export interface Labels {
		/** The toolbar's accessible name, such as "Monitor list". */
		toolbar: string;
		/** The clear button's accessible name, such as "Clear selection". */
		clear: string;
		/** The count with a `{count}` placeholder, such as "{count} selected". */
		selected: string;
		/** Announced once the selection empties, such as "Selection cleared". */
		cleared: string;
		previous: string;
		next: string;
	}

	/** Props accepted by {@link SelectionBar}; the host is a `<div>`. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The `id` of the region holding the `[data-selection-item]` checkboxes. */
		target: string;
		/** The `id` of the form those checkboxes submit with. Defaults to `target`. */
		form?: string;
		/** Range and page links shown while nothing is selected; omitted hides the idle bar. */
		pagination?: Pagination;
		actions: Action[];
		/** Locale for the count. Defaults to the runtime's. */
		locale?: string;
		labels: Labels;
	}

	/** Props {@link SelectionBarController} serializes for hydration, which is why they are a `type`. */
	export type ControllerProps = {
		target: string;
		selected: string;
		cleared: string;
		locale?: string;
	};
}

/**
 * Renders the bar sticky at the bottom of its scroll container, with both layers stacked in
 * one grid cell so the morph cross-fades in place. The layers' text and links work without
 * script; the selection layer appears once the `@sdxc/ui/app/selection-bar` island loads.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the bar.
 * @example
 * <form id="monitors" method="post" action="/monitors/bulk">{rows with <input type="checkbox" data-selection-item name="id" value={id} />}</form>
 * <SelectionBar
 * 	target="monitors"
 * 	pagination={{ summary: "Viewing 1–50 of 1,234", next: "?page=2" }}
 * 	actions={[{ label: "Pause", key: "p", name: "intent", value: "pause" }, { label: "Delete", key: "x", danger: true, name: "intent", value: "delete" }]}
 * 	labels={{ toolbar: "Monitors", clear: "Clear selection", selected: "{count} selected", cleared: "Selection cleared", previous: "Previous page", next: "Next page" }}
 * />
 */
export function SelectionBar(handle: Handle<SelectionBar.Props>) {
	return () => {
		let { target, form, pagination, actions, locale, labels, mix, ...rest } = handle.props;
		let formId = form ?? target;
		let layer = [
			flex(),
			flexWrap(),
			items("center"),
			justify("center"),
			gap(1),
			morphTransition("opacity, transform, visibility"),
		];

		return (
			<div
				{...rest}
				role="toolbar"
				aria-label={labels.toolbar}
				data-slot="selection-bar"
				data-state="idle"
				data-paginated={pagination ? "" : undefined}
				mix={mergeMix(
					[
						sticky(),
						insBe(OFFSET),
						z(10),
						zstack(),
						is("fit-content"),
						maxIs("100%"),
						mi("auto"),
						floatingSurface(),
						rounded("xl"),
						pi(1.5),
						pb(1),
						text("sm"),
						morphTransition("opacity"),
						when('&[data-state="idle"]:not([data-paginated])', [opacity(0), pointerEvents()]),
					],
					mix,
				)}
			>
				<div
					data-slot="selection-bar-pagination"
					mix={[
						...layer,
						gap(2),
						pis(2),
						when('[data-state="selecting"] > &', [opacity(0), scale(0.98), hiddenLayer()]),
					]}
				>
					{pagination ? (
						<>
							<span
								data-slot="selection-bar-summary"
								mix={[fg("neutral"), tabularNums(), nowrap()]}
							>
								{pagination.summary}
							</span>
							<span mix={[flex(), gap(0.5)]}>
								<PageLink href={pagination.previous} label={labels.previous} rel="prev">
									<ChevronLeftIcon size={16} aria-hidden="true" />
								</PageLink>
								<PageLink href={pagination.next} label={labels.next} rel="next">
									<ChevronRightIcon size={16} aria-hidden="true" />
								</PageLink>
							</span>
						</>
					) : null}
				</div>
				<div
					data-slot="selection-bar-selection"
					inert
					mix={[
						...layer,
						when('[data-state="idle"] > &', [opacity(0), scale(0.98), hiddenLayer()]),
					]}
				>
					<span mix={[flex(), items("center"), gap(1), shrink(0), pie(2)]}>
						<button
							type="button"
							data-slot="selection-clear"
							aria-label={labels.clear}
							title={labels.clear}
							mix={[
								interactiveTransition(),
								center(),
								is(7),
								bs(7),
								rounded("md"),
								border({ width: 0 }),
								bg("transparent"),
								fg("neutral.muted"),
								hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
								focusVisible(outline({ color: "brand.ring", offset: 2 })),
							]}
						>
							<XIcon size={16} aria-hidden="true" />
						</button>
						<span
							data-slot="selection-count"
							mix={[fg("neutral.emphasis"), weight(500), tabularNums(), nowrap()]}
						/>
					</span>
					<span aria-hidden="true" mix={[is("1px"), bs(5), bg("neutral.border"), shrink(0)]} />
					{actions.map((action) => (
						<Button
							type="submit"
							form={formId}
							formAction={action.formAction}
							formMethod={action.formMethod ?? "post"}
							name={action.name}
							value={action.value}
							variant="ghost"
							size="sm"
							color={action.danger ? "danger" : "neutral"}
							data-selection-key={action.key}
							aria-keyshortcuts={action.key?.toUpperCase()}
							mix={[gap(1.5), weight(400), when("& > svg", fg("neutral.muted"))]}
						>
							{action.icon}
							{action.label}
							{action.key ? (
								<Keyboard aria-hidden="true" mix={[mis(1), media("(hover: none)", hidden())]}>
									{action.key.toUpperCase()}
								</Keyboard>
							) : null}
						</Button>
					))}
				</div>
				<SelectionBarController
					target={target}
					selected={labels.selected}
					cleared={labels.cleared}
					locale={locale}
				/>
			</div>
		);
	};
}

/**
 * The morph's fade: 200ms ease-out, and none under reduced motion. Both live in one rule so
 * the reduced-motion override always outranks the fade, whatever order the page met them in.
 *
 * @param properties The properties that fade.
 * @returns The mixin carrying the transition.
 */
function morphTransition(properties: string) {
	return raw({
		transitionProperty: properties,
		transitionDuration: `${durations.normal}ms`,
		transitionTimingFunction: easings.decelerate,
		"@media (prefers-reduced-motion: reduce)": { transitionDuration: "0s" },
	});
}

/**
 * Styles the layer that is not showing: invisible once its fade ends, so its controls leave
 * the tab order and the accessibility tree even before the island marks it `inert`.
 *
 * @returns The mixins for a hidden layer.
 */
function hiddenLayer() {
	return [pointerEvents(), visibility("hidden")];
}

/** Props for {@link PageLink}. */
interface PageLinkProps {
	href?: string;
	label: string;
	rel: "prev" | "next";
	children: RemixNode;
}

/**
 * Renders a previous or next page link as a square icon target; without `href` it is a
 * disabled placeholder that keeps the pair in place on the first and last pages.
 *
 * @param handle Runtime handle carrying the link's props.
 * @returns The render function producing the link.
 */
function PageLink(handle: Handle<PageLinkProps>) {
	return () => {
		let { href, label, rel, children } = handle.props;
		return (
			<a
				href={href}
				rel={href ? rel : undefined}
				aria-label={label}
				aria-disabled={href ? undefined : "true"}
				title={label}
				data-slot={`selection-bar-${rel}`}
				mix={[
					interactiveTransition(),
					inlineFlex(),
					items("center"),
					justify("center"),
					is(7),
					bs(7),
					rounded("md"),
					fg("neutral"),
					hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
					focusVisible(outline({ color: "brand.ring", offset: 2 })),
					when('&[aria-disabled="true"]', [opacity(40), pointerEvents()]),
				]}
			>
				{children}
			</a>
		);
	};
}

/**
 * The island inside the bar: a visually hidden status region that announces the count, and
 * the behavior that counts checked rows in `target`, morphs the bar, clears on Escape and
 * runs an action on its key. Load `@sdxc/ui/app/selection-bar` in the browser entry.
 *
 * @example <SelectionBarController target="monitors" selected="{count} selected" cleared="Selection cleared" />
 */
export const SelectionBarController: EntryComponent<SelectionBar.ControllerProps> = clientEntry(
	"@sdxc/ui/app/selection-bar#SelectionBarController",
	function SelectionBarController(handle: Handle<SelectionBar.ControllerProps>) {
		return () => {
			let { target, selected, cleared, locale } = handle.props;
			return (
				<span
					role="status"
					data-slot="selection-bar-status"
					mix={[visuallyHidden(), selectionBarSync({ target, selected, cleared, locale })]}
				/>
			);
		};
	},
);
