/**
 * The "Display" popover beside a list: layout, grouping, ordering, density and the visible
 * properties, each a field of one GET form, so the URL holds the view and a link shares it.
 * "Set as default" posts the same fields to an endpoint that stores them for the reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { SlidersHorizontalIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, mergeMix } from "@sdxc/u/general";
import {
	flex,
	flexWrap,
	gap,
	inlineBlock,
	inlineFlex,
	items,
	justify,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { bs, is, m, maxIs, minIs, p, pb, pi } from "@sdxc/u/size";
import { has, hover, when } from "@sdxc/u/state";
import { nowrap, text, weight } from "@sdxc/u/typography";

import { Button } from "../components/button.js";
import { Popover } from "../components/popover.js";
import { Select } from "../components/select.js";
import { interactiveTransition } from "../styles/interactive-transition.js";
import { segmentedItem, segmentedTrack } from "../styles/segmented-control.js";

import { carriedParams, paramValues } from "./utils/search-params.js";

/** The URL read when `url` is unset: a page with nothing applied. */
const DEFAULT_URL = "/";

/** The parameter each field writes when its `name` is unset. */
const DEFAULT_NAMES = {
	layout: "layout",
	grouping: "group",
	ordering: "order",
	density: "density",
	properties: "props",
} as const;

/** Prop types for {@link ViewOptions}. */
export namespace ViewOptions {
	/** One choice of a field. */
	export interface Choice {
		value: string;
		label: string;
		/** A glyph drawn with the label in a segmented control, decorative. */
		icon?: RemixNode;
	}

	/** A single-choice field: a segmented control (layout, density) or a select (grouping, ordering). */
	export interface Field {
		/** The search parameter it writes. */
		name?: string;
		options: Choice[];
		/** The choice the list uses while the URL names none. */
		defaultValue: string;
	}

	/** The visible-properties field: one toggle chip per property, written as a repeated parameter. */
	export interface Properties {
		/** The search parameter it writes. @default "props" */
		name?: string;
		options: Choice[];
		/** The properties shown while the URL names none. */
		defaultValue: string[];
	}

	/** Every string the popover shows. */
	export interface Labels {
		/** The trigger's text and the popover's accessible name, such as "Display". */
		trigger: string;
		layout: string;
		grouping: string;
		ordering: string;
		density: string;
		properties: string;
		apply: string;
		/** The button that stores this view as the reader's default, such as "Set as default". */
		setDefault: string;
	}

	/** Props accepted by {@link ViewOptions}; the host is a `<div>`. */
	export interface Props extends Omit<TagProps<"div">, "children" | "id"> {
		/** Prefix for the popover and form ids; unique on the page. */
		id: string;
		/**
		 * The page's current URL, where every applied value is read from.
		 *
		 * @default "/", a page with no parameters
		 */
		url?: URL | string;
		/** Where Apply submits. Defaults to the current path. */
		action?: string;
		/** @default name "layout" */
		layout?: Field;
		/** @default name "group" */
		grouping?: Field;
		/** @default name "order" */
		ordering?: Field;
		/** @default name "density" */
		density?: Field;
		properties?: Properties;
		/** Where "Set as default" posts the fields; omitted hides the button. */
		setDefault?: { action: string };
		labels: Labels;
	}
}

/**
 * Renders the trigger and its popover. Every field reads its value from `url`, falling back to
 * the field's default, and Apply submits them with every other parameter carried as hidden
 * fields, so the filters and tab the page shows survive a view change.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the trigger and popover.
 * @example
 * <ViewOptions
 * 	id="monitors-view"
 * 	url={request.url}
 * 	layout={{ defaultValue: "table", options: [{ value: "table", label: "Table", icon: <TableIcon /> }, { value: "grid", label: "Grid", icon: <LayoutGridIcon /> }] }}
 * 	density={{ defaultValue: "compact", options: [{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }] }}
 * 	setDefault={{ action: "/settings/views/monitors" }}
 * 	labels={labels}
 * />
 */
export function ViewOptions(handle: Handle<ViewOptions.Props>) {
	return () => {
		let {
			id,
			url = DEFAULT_URL,
			action,
			layout,
			grouping,
			ordering,
			density,
			properties,
			setDefault,
			labels,
			mix,
			...rest
		} = handle.props;
		let popoverId = `${id}-popover`;
		let names = {
			layout: layout?.name ?? DEFAULT_NAMES.layout,
			grouping: grouping?.name ?? DEFAULT_NAMES.grouping,
			ordering: ordering?.name ?? DEFAULT_NAMES.ordering,
			density: density?.name ?? DEFAULT_NAMES.density,
			properties: properties?.name ?? DEFAULT_NAMES.properties,
		};
		let owned = [
			layout ? names.layout : null,
			grouping ? names.grouping : null,
			ordering ? names.ordering : null,
			density ? names.density : null,
			properties ? names.properties : null,
		].filter((name): name is string => name !== null);

		return (
			<div {...rest} data-slot="view-options" mix={mergeMix([inlineBlock()], mix)}>
				<Button
					variant="ghost"
					size="sm"
					commandfor={popoverId}
					command="toggle-popover"
					data-slot="view-options-trigger"
					mix={[fg("neutral"), weight(400), when("& > svg", fg("neutral.muted"))]}
				>
					<SlidersHorizontalIcon size={16} aria-hidden="true" />
					{labels.trigger}
				</Button>
				<Popover
					id={popoverId}
					placement="bottom-end"
					role="dialog"
					aria-label={labels.trigger}
					mix={[p(3), is("18rem"), maxIs("calc(100vw - 2rem)")]}
				>
					<form method="get" action={action} mix={[vstack({ gap: 3 })]}>
						{carriedParams(url, owned).map(([name, value]) => (
							<input type="hidden" name={name} value={value} />
						))}
						{layout ? (
							<Segmented
								name={names.layout}
								label={labels.layout}
								field={layout}
								value={chosen(url, names.layout, layout)}
							/>
						) : null}
						{grouping ? (
							<SelectRow
								id={`${id}-grouping`}
								name={names.grouping}
								label={labels.grouping}
								field={grouping}
								value={chosen(url, names.grouping, grouping)}
							/>
						) : null}
						{ordering ? (
							<SelectRow
								id={`${id}-ordering`}
								name={names.ordering}
								label={labels.ordering}
								field={ordering}
								value={chosen(url, names.ordering, ordering)}
							/>
						) : null}
						{density ? (
							<Segmented
								name={names.density}
								label={labels.density}
								field={density}
								value={chosen(url, names.density, density)}
							/>
						) : null}
						{properties ? (
							<PropertyChips
								name={names.properties}
								label={labels.properties}
								field={properties}
								selected={shownProperties(url, names.properties, properties)}
							/>
						) : null}
						<div mix={[flex(), items("center"), justify("end"), gap(2)]}>
							{setDefault ? (
								<Button
									type="submit"
									variant="ghost"
									size="sm"
									formMethod="post"
									formAction={setDefault.action}
									data-slot="view-options-default"
								>
									{labels.setDefault}
								</Button>
							) : null}
							<Button type="submit" size="sm" color="brand" data-slot="view-options-apply">
								{labels.apply}
							</Button>
						</div>
					</form>
				</Popover>
			</div>
		);
	};
}

/**
 * The value a single-choice field shows: the URL's, when it names one of the field's options,
 * else the field's default, so a stale or hand-typed value never leaves the control blank.
 *
 * @param url The page's current URL.
 * @param name The field's parameter.
 * @param field The field.
 * @returns The value to mark chosen.
 */
function chosen(url: URL | string, name: string, field: ViewOptions.Field): string {
	let value = paramValues(url, name)[0];
	return field.options.some((option) => option.value === value) && value !== undefined
		? value
		: field.defaultValue;
}

/**
 * The properties shown: the URL's list once the parameter is present, even empty (every chip
 * off), else the default list. The form always sends an empty value first, which is what
 * marks the parameter present after the reader turns every chip off.
 *
 * @param url The page's current URL.
 * @param name The parameter.
 * @param field The properties field.
 * @returns The property values to mark on.
 */
function shownProperties(url: URL | string, name: string, field: ViewOptions.Properties): string[] {
	let present = new URL(url.toString(), "http://localhost").searchParams.has(name);
	return present ? paramValues(url, name) : field.defaultValue;
}

/** Props for {@link Segmented}. */
interface SegmentedProps {
	name: string;
	label: string;
	field: ViewOptions.Field;
	value: string;
}

/**
 * Renders a single-choice field as a segmented control of native radios, so arrow keys move
 * between choices and the chosen one submits under `name`.
 *
 * @param handle Runtime handle carrying the field.
 * @returns The render function producing the fieldset.
 */
function Segmented(handle: Handle<SegmentedProps>) {
	return () => {
		let { name, label, field, value } = handle.props;
		return (
			<fieldset
				data-slot="view-options-segmented"
				data-name={name}
				mix={[
					m(0),
					p(0),
					border({ width: 0 }),
					flex(),
					items("center"),
					justify("between"),
					gap(3),
					minIs(0),
				]}
			>
				<legend mix={[visuallyHidden()]}>{label}</legend>
				<span aria-hidden="true" mix={[text("sm"), fg("neutral"), nowrap()]}>
					{label}
				</span>
				<span mix={[segmentedTrack(), minIs(0)]}>
					{field.options.map((option) => (
						<label
							title={option.label}
							mix={[
								interactiveTransition(),
								inlineFlex(),
								items("center"),
								justify("center"),
								gap(1.5),
								bs(7),
								pi(2),
								text("sm"),
								cursor("pointer"),
								nowrap(),
								segmentedItem({
									selected: "&:has(input:checked)",
									focused: "&:has(input:focus-visible)",
								}),
								when("& > svg", shrink(0)),
							]}
						>
							<input
								type="radio"
								name={name}
								value={option.value}
								defaultChecked={option.value === value}
								mix={[visuallyHidden()]}
							/>
							{option.icon}
							{option.icon ? <span mix={[visuallyHidden()]}>{option.label}</span> : option.label}
						</label>
					))}
				</span>
			</fieldset>
		);
	};
}

/** Props for {@link SelectRow}. */
interface SelectRowProps {
	id: string;
	name: string;
	label: string;
	field: ViewOptions.Field;
	value: string;
}

/**
 * Renders a single-choice field with many options (grouping, ordering) as a labelled select
 * on the same row as its label.
 *
 * @param handle Runtime handle carrying the field.
 * @returns The render function producing the row.
 */
function SelectRow(handle: Handle<SelectRowProps>) {
	return () => {
		let { id, name, label, field, value } = handle.props;
		return (
			<div mix={[flex(), items("center"), justify("between"), gap(3)]}>
				<label for={id} mix={[text("sm"), fg("neutral"), nowrap()]}>
					{label}
				</label>
				<Select id={id} name={name} mix={[is("10rem"), bs(8), minIs(0)]}>
					{field.options.map((option) => (
						<option value={option.value} selected={option.value === value}>
							{option.label}
						</option>
					))}
				</Select>
			</div>
		);
	};
}

/** Props for {@link PropertyChips}. */
interface PropertyChipsProps {
	name: string;
	label: string;
	field: ViewOptions.Properties;
	selected: string[];
}

/**
 * Renders the visible properties as toggle chips: native checkboxes under one repeated name,
 * behind an empty value that keeps the parameter present when every chip is off.
 *
 * @param handle Runtime handle carrying the field.
 * @returns The render function producing the fieldset.
 */
function PropertyChips(handle: Handle<PropertyChipsProps>) {
	return () => {
		let { name, label, field, selected } = handle.props;
		return (
			<fieldset
				data-slot="view-options-properties"
				mix={[m(0), p(0), border({ width: 0 }), vstack({ gap: 2 }), minIs(0)]}
			>
				<legend mix={[pb(2), text("sm"), fg("neutral")]}>{label}</legend>
				<input type="hidden" name={name} value="" />
				<div mix={[flex(), flexWrap(), gap(1.5)]}>
					{field.options.map((option) => (
						<label
							mix={[
								interactiveTransition(),
								inlineFlex(),
								items("center"),
								gap(1),
								bs(7),
								pi(2.5),
								rounded("full"),
								border({ width: 1, color: "neutral.border" }),
								text("xs"),
								weight(500),
								fg("neutral"),
								cursor("pointer"),
								nowrap(),
								hover(bg("neutral.bg-tint-hover")),
								has("input:checked", [
									bg("brand.tint"),
									border("brand.border"),
									fg("brand.emphasis"),
								]),
								has("input:focus-visible", outline({ color: "brand.ring", offset: 2 })),
							]}
						>
							<input
								type="checkbox"
								name={name}
								value={option.value}
								defaultChecked={selected.includes(option.value)}
								mix={[visuallyHidden()]}
							/>
							{option.icon}
							{option.label}
						</label>
					))}
				</div>
			</fieldset>
		);
	};
}
