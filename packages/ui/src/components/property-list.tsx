/**
 * Label/value rows for one record's properties, as a `<dl>`: a fixed label column beside
 * each value that stacks once its container narrows, empty values named in words, and an
 * editable row whose value opens an anchored native popover holding the app's own form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronDownIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor, raw, mergeMix } from "@sdxc/u/general";
import { container, flex, gap, grid, items, justify, shrink, vstack } from "@sdxc/u/layout";
import { is, m, minBs, minIs, p, pb, pi } from "@sdxc/u/size";
import { focusVisible, hover } from "@sdxc/u/state";
import { leading, tabularNums, text, textAlign, weight } from "@sdxc/u/typography";

import { Popover } from "./popover.js";

/** Container the list names, so its rows stack against the list's own width. */
const PROPERTY_LIST_CONTAINER = "ui-property-list";

/** Layout a list takes when `variant` is left unset. */
const DEFAULT_VARIANT: PropertyList.Variant = "rows";

/** Shown for a value the caller leaves empty and names no empty text for. */
const DEFAULT_EMPTY = "—";

/**
 * Prop types for {@link PropertyList} and its compound parts.
 */
export namespace PropertyList {
	/**
	 * `"rows"` sets each label beside its value in a ruled-free column; `"tiles"` sets each
	 * property in its own bordered tile, two to a row, for a record's headline figures.
	 */
	export type Variant = "rows" | "tiles";

	/** What {@link PropertyList} shares with its items. */
	export interface Context {
		variant: Variant;
	}

	/** Every native `<dl>` attribute, plus the layout variant. */
	export interface Props extends TagProps<"dl"> {
		/** @default {@link DEFAULT_VARIANT} */
		variant?: Variant;
	}

	/**
	 * Makes a row editable in place: its value becomes a button that opens a popover
	 * anchored under it, holding whatever form the app renders as `content`.
	 */
	export interface Edit {
		/** Id of the popover, which the value button targets. */
		id: string;
		/** What the button does, read before the current value, such as "Edit assignee". */
		label: string;
		/** The popover's content: the app's form, its described options and its submit. */
		content: RemixNode;
	}

	/** Every native `<div>` attribute the row's group accepts, plus its label and value. */
	export interface ItemProps extends Omit<TagProps<"div">, "children"> {
		/** The property's name, rendered in the `<dt>`. */
		label: RemixNode;
		/**
		 * What the row says when `children` is empty, such as "None" or "No reviews".
		 *
		 * @default "—"
		 */
		empty?: RemixNode;
		/** Turns the value into a button opening an anchored edit popover. */
		edit?: Edit;
		/** The value: text, a link, a badge, an avatar with a name. */
		children?: RemixNode;
	}
}

/**
 * Whether `node` renders nothing a reader would see, which is when the row shows its
 * named empty value instead.
 *
 * @param node The value a row was given.
 * @returns `true` for `null`, `undefined`, `false`, `""` and a list of those.
 */
function isEmptyValue(node: RemixNode | undefined): boolean {
	if (node === null || node === undefined || node === false || node === "") return true;
	if (Array.isArray(node)) return node.every((child) => isEmptyValue(child));
	return false;
}

/**
 * Renders the `<dl>`. Each item is a `<div>` grouping one `<dt>` and one `<dd>`, which
 * keeps the label/value pairing in the accessibility tree; the list measures itself as a
 * container, so rows stack in a narrow side pane at any viewport width.
 *
 * @param handle Runtime handle carrying the `<dl>`'s props and providing the variant.
 * @returns The render function producing the list's markup.
 * @example
 * <PropertyList>
 * 	<PropertyList.Item label="Status"><Badge color="success">Up</Badge></PropertyList.Item>
 * 	<PropertyList.Item label="Reviewers" empty="No reviews" />
 * </PropertyList>
 * @example
 * <PropertyList variant="tiles">
 * 	<PropertyList.Item label="Uptime">99.98%</PropertyList.Item>
 * </PropertyList>
 */
export function PropertyList(handle: Handle<PropertyList.Props, PropertyList.Context>) {
	return () => {
		let { variant, mix, ...rest } = handle.props;
		let resolved = variant ?? DEFAULT_VARIANT;
		handle.context.set({ variant: resolved });

		return (
			<dl
				data-slot="property-list"
				data-variant={resolved}
				{...rest}
				mix={mergeMix(
					[
						m(0),
						container(PROPERTY_LIST_CONTAINER),
						text("sm"),
						resolved === "tiles"
							? [
									grid(),
									gap(2),
									/**
									 * Each tile claims at least half the row, so two fit side by side once
									 * both reach 9rem and a narrower list falls back to one column.
									 */
									raw({
										gridTemplateColumns:
											"repeat(auto-fit, minmax(max(9rem, calc(50% - 0.25rem)), 1fr))",
									}),
								]
							: vstack({ gap: 0 }),
					],
					mix,
				)}
			/>
		);
	};
}

/**
 * Renders one property. In the rows variant the label column holds
 * `--ui-property-list-label-width` (9rem) from a 22rem container up and stacks above the
 * value below it; a value-less row names its emptiness in muted text.
 *
 * @param handle Runtime handle carrying the group `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <PropertyList.Item label="Owner"><a href="/people/ana">Ana Souza</a></PropertyList.Item>
 * @example
 * <PropertyList.Item
 * 	label="Assignee"
 * 	empty="No one"
 * 	edit={{ id: "edit-assignee", label: "Edit assignee", content: <AssigneeForm /> }}
 * >
 * 	{assignee?.name}
 * </PropertyList.Item>
 */
PropertyList.Item = function PropertyListItem(handle: Handle<PropertyList.ItemProps>) {
	return () => {
		let { label, empty, edit, children, mix, ...rest } = handle.props;
		let { variant } = handle.context.get(PropertyList);
		let tiles = variant === "tiles";
		let isEmpty = isEmptyValue(children);

		let value = isEmpty ? (
			<span data-slot="property-empty" mix={[fg("neutral.muted")]}>
				{empty ?? DEFAULT_EMPTY}
			</span>
		) : (
			children
		);

		return (
			<div
				data-slot="property"
				{...rest}
				mix={mergeMix(
					tiles
						? [
								vstack({ gap: 1 }),
								p(3),
								rounded("md"),
								border({ color: "neutral.border", width: 1 }),
							]
						: [
								grid(),
								pb(1),
								items("baseline"),
								/**
								 * The stacked and side-by-side tracks live in one rule, so the label column
								 * holds at its width whatever order the stylesheet layers land in.
								 */
								raw({
									gridTemplateColumns: "minmax(0, 1fr)",
									rowGap: "0.125rem",
									[`@container ${PROPERTY_LIST_CONTAINER} (min-width: 22rem)`]: {
										gridTemplateColumns: "var(--ui-property-list-label-width, 9rem) minmax(0, 1fr)",
										columnGap: "1rem",
									},
								}),
							],
					mix,
				)}
			>
				<dt
					data-slot="property-label"
					mix={[
						m(0),
						minIs(0),
						fg("neutral.muted"),
						tiles ? text("xs") : text("sm"),
						leading("1.25rem"),
						pb(tiles ? 0 : 1.5),
					]}
				>
					{label}
				</dt>
				<dd
					data-slot="property-value"
					mix={[
						m(0),
						minIs(0),
						flex(),
						items("center"),
						gap(1.5),
						raw({ flexWrap: "wrap" }),
						minBs("2rem"),
						tabularNums(),
						tiles ? [text("lg"), weight("semibold")] : null,
					]}
				>
					{edit ? (
						<PropertyEdit edit={edit} empty={isEmpty}>
							{value}
						</PropertyEdit>
					) : (
						value
					)}
				</dd>
			</div>
		);
	};
};

/** Props {@link PropertyEdit} reads. */
interface PropertyEditProps {
	edit: PropertyList.Edit;
	empty: boolean;
	children: RemixNode;
}

/**
 * The editable value: a full-width button naming its action before the current value,
 * and the popover it opens. The button is the popover's invoker, which makes it the
 * popover's implicit anchor, so the form opens directly under its row.
 *
 * @param handle Runtime handle carrying the edit description and the rendered value.
 * @returns The render function producing the button and its popover.
 */
function PropertyEdit(handle: Handle<PropertyEditProps>) {
	return () => {
		let { edit, children } = handle.props;

		return (
			<>
				<button
					type="button"
					data-slot="property-edit"
					popovertarget={edit.id}
					aria-haspopup="dialog"
					mix={[
						flex(),
						items("center"),
						justify("between"),
						gap(1.5),
						is("full"),
						minBs("2rem"),
						pi(2),
						raw({ marginInline: "-0.5rem", inlineSize: "calc(100% + 1rem)" }),
						rounded("md"),
						border({ color: "transparent", width: 0 }),
						bg("transparent"),
						fg(),
						text("sm"),
						textAlign("start"),
						cursor("pointer"),
						transition("background-color"),
						hover(bg("neutral.tint")),
						focusVisible(outline({ color: "brand.ring", width: 2, offset: -2 })),
					]}
				>
					<span mix={[flex(), items("center"), gap(1.5), raw({ flexWrap: "wrap" }), minIs(0)]}>
						<span mix={[visuallyHidden()]}>{`${edit.label}: `}</span>
						{children}
					</span>
					<ChevronDownIcon size={14} aria-hidden="true" mix={[shrink(0), fg("neutral.muted")]} />
				</button>
				<Popover
					id={edit.id}
					placement="bottom-start"
					role="dialog"
					aria-label={edit.label}
					data-slot="property-popover"
					mix={[p(3), is("min(20rem, calc(100vw - 2rem))"), text("sm")]}
				>
					{edit.content}
				</Popover>
			</>
		);
	};
}
