/**
 * Fare classes as cards in a `<fieldset>`, each a native radio sharing one `name`, so the
 * choice posts with its form and needs no script. Each card lists what the fare includes with
 * a check, cross or coin, and the cards sit side by side once their container is wide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { CheckIcon, CoinsIcon, XIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, listStyle, raw, mergeMix } from "@sdxc/u/general";
import { container, flex, gap, grid, inlineFlex, items, relative, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, tabularNums, text, weight } from "@sdxc/u/typography";

/** Container the fieldset names, so the cards follow the width they are given. */
const CONTAINER_NAME = "ui-fare-options";

/** Fieldset width from which the cards sit side by side. */
const ROW_WIDTH = "36rem";

/**
 * Prop types for {@link FareOptions} and its compound parts.
 */
export namespace FareOptions {
	/** Whether a fare includes a feature, leaves it out, or offers it for a fee. */
	export type Included = "yes" | "no" | "fee";

	/** One line of a fare's feature list. */
	export interface Feature {
		/** What the feature is, such as "Carry-on bag" or "Free changes". */
		label: RemixNode;
		included: Included;
	}

	/** The words a screen reader hears before each feature in place of its icon. */
	export interface StatusLabels {
		/** Such as "Included". */
		yes: string;
		/** Such as "Not included". */
		no: string;
		/** Such as "Available for a fee". */
		fee: string;
	}

	/** What {@link FareOptions} shares with its cards. */
	export interface Context {
		name: string;
		statusLabels: StatusLabels;
	}

	/** Every native `<fieldset>` attribute, plus the group's legend, name and status words. */
	export interface Props extends TagProps<"fieldset"> {
		/** What the choice is, such as "Choose your fare"; it names the group. */
		legend: RemixNode;
		/** Hides the legend visually while it still names the group. */
		hideLegend?: boolean;
		/** The radio name every card shares; the chosen card's `value` posts under it. */
		name: string;
		statusLabels: StatusLabels;
		/** The {@link FareOptions.Option} cards. */
		children: RemixNode;
	}

	/** Every native `<label>` attribute, plus the fare's value, title, price and features. */
	export interface OptionProps extends Omit<TagProps<"label">, "children" | "title"> {
		/** What the form posts when this fare is chosen, such as "standard". */
		value: string;
		/** The fare's name, such as "Standard"; it names the radio. */
		title: RemixNode;
		/** The fare's price, formatted by the caller, such as "$468". */
		price: RemixNode;
		/** What the price covers, or the difference from the cheapest fare, such as "+$56". */
		priceDetail?: RemixNode;
		features?: Feature[];
		/** A ribbon over the card, such as "Recommended". */
		ribbon?: RemixNode;
		/** Starts chosen. */
		checked?: boolean;
		disabled?: boolean;
		/** Makes a choice required before the form submits; set it on one card of the group. */
		required?: boolean;
	}
}

/**
 * Renders the group: a `<fieldset>` named by its `<legend>`, with its cards stacked under 36rem
 * and side by side, equal width, from there. Arrow keys move between the cards and the chosen
 * one posts its `value` under `name`, both native radio behaviour.
 *
 * @param handle Runtime handle carrying the fieldset's props and providing name and words to the cards.
 * @returns The render function producing the group's markup.
 * @example
 * <FareOptions legend="Choose your fare" name="fare" statusLabels={{ yes: "Included", no: "Not included", fee: "For a fee" }}>
 * 	<FareOptions.Option value="basic" title="Basic" price="$412" features={[{ label: "Carry-on bag", included: "fee" }]} />
 * 	<FareOptions.Option value="standard" title="Standard" price="$468" ribbon="Recommended" checked />
 * </FareOptions>
 */
export function FareOptions(handle: Handle<FareOptions.Props, FareOptions.Context>) {
	return () => {
		let { legend, hideLegend, name, statusLabels, children, mix, ...rest } = handle.props;
		handle.context.set({ name, statusLabels });

		return (
			<fieldset
				data-slot="fare-options"
				{...rest}
				mix={mergeMix(
					[
						container(CONTAINER_NAME, "inline-size"),
						m(0),
						p(0),
						raw({ border: 0, minInlineSize: 0 }),
						text("sm"),
					],
					mix,
				)}
			>
				<legend
					data-slot="fare-options-legend"
					mix={[
						p(0),
						hideLegend
							? visuallyHidden()
							: [weight("semibold"), fg("neutral.emphasis"), raw({ marginBlockEnd: "0.75rem" })],
					]}
				>
					{legend}
				</legend>
				<div
					data-slot="fare-options-list"
					mix={[
						grid(),
						gap(3),
						raw({ paddingBlockStart: "0.75rem" }),
						at(
							ROW_WIDTH,
							CONTAINER_NAME,
							raw({ gridAutoFlow: "column", gridAutoColumns: "minmax(0, 1fr)" }),
						),
					]}
				>
					{children}
				</div>
			</fieldset>
		);
	};
}

/**
 * Renders one fare as a `<label>` card around its radio: the title and the radio, the price,
 * then the feature list. A chosen card gains a brand border twice as thick, and a ribbon sits
 * across its top edge; the radio is named by the title and described by price and features.
 *
 * @param handle Runtime handle carrying the card's props.
 * @returns The render function producing the card's markup.
 * @example
 * <FareOptions.Option value="flex" title="Flex" price="$544" priceDetail="+$132" features={[
 * 	{ label: "Free changes", included: "yes" },
 * 	{ label: "Refund", included: "fee" },
 * ]} />
 */
FareOptions.Option = function FareOptionsOption(handle: Handle<FareOptions.OptionProps>) {
	return () => {
		let {
			value,
			title,
			price,
			priceDetail,
			features,
			ribbon,
			checked,
			disabled,
			required,
			mix,
			...rest
		} = handle.props;
		let { name, statusLabels } = handle.context.get(FareOptions);
		let titleId = `${handle.id}-title`;
		let detailId = `${handle.id}-detail`;

		return (
			<label
				data-slot="fare-option"
				data-ribbon={ribbon === undefined ? undefined : ""}
				{...rest}
				mix={mergeMix(
					[
						relative(),
						vstack({ gap: 3 }),
						minIs(0),
						p(4),
						rounded("lg"),
						bg("var(--ui-surface-raised, var(--ui-bg, Canvas))"),
						border({ color: "neutral.border", width: 1 }),
						raw({ boxShadow: "inset 0 0 0 1px transparent" }),
						cursor("pointer"),
						when("&:has(input:checked)", [
							border({ color: "brand.strong", width: 1 }),
							raw({ boxShadow: "inset 0 0 0 1px var(--ui-brand-border-strong)" }),
							bg("brand.tint"),
						]),
						when(
							"&:has(input:focus-visible)",
							outline({ color: "brand.ring", width: 2, offset: 2 }),
						),
						when("&:has(input:disabled)", raw({ cursor: "not-allowed", opacity: 0.55 })),
						when(
							"&:hover:not(:has(input:disabled, input:checked))",
							border({ color: "neutral.strong", width: 1 }),
						),
					],
					mix,
				)}
			>
				{ribbon === undefined ? null : (
					<span
						data-slot="fare-option-ribbon"
						mix={[
							raw({
								position: "absolute",
								insetBlockStart: 0,
								insetInlineStart: "1rem",
								translate: "0 -50%",
								paddingInline: "0.5rem",
								paddingBlock: "0.125rem",
							}),
							rounded("full"),
							bg("brand.solid"),
							fg("brand.onSolid"),
							text("xs"),
							weight("semibold"),
							leading(1.4),
						]}
					>
						{ribbon}
					</span>
				)}
				<span mix={[flex(), items("start"), raw({ justifyContent: "space-between" }), gap(3)]}>
					<span
						id={titleId}
						data-slot="fare-option-title"
						mix={[text("base"), weight("semibold"), fg("neutral.emphasis"), minIs(0)]}
					>
						{title}
					</span>
					<input
						type="radio"
						name={name}
						value={value}
						checked={checked}
						disabled={disabled}
						required={required}
						aria-labelledby={titleId}
						aria-describedby={detailId}
						mix={[
							m(0),
							raw({ inlineSize: "1.125rem", blockSize: "1.125rem", flexShrink: 0 }),
							raw({ accentColor: "var(--ui-brand-bg-solid)", outline: "none" }),
						]}
					/>
				</span>
				<span id={detailId} mix={[vstack({ gap: 3 })]}>
					<span mix={[vstack({ gap: 0.5 })]}>
						<span
							data-slot="fare-option-price"
							mix={[
								text("2xl"),
								weight("semibold"),
								leading(1.1),
								tabularNums(),
								fg("neutral.emphasis"),
							]}
						>
							{price}
						</span>
						{priceDetail === undefined ? null : (
							<span data-slot="fare-option-price-detail" mix={[text("xs"), fg("neutral.muted")]}>
								{priceDetail}
							</span>
						)}
					</span>
					{features === undefined || features.length === 0 ? null : (
						<ul
							data-slot="fare-option-features"
							mix={[m(0), p(0), listStyle("none"), vstack({ gap: 2 })]}
						>
							{features.map((feature) => (
								<FeatureLine feature={feature} statusLabels={statusLabels} />
							))}
						</ul>
					)}
				</span>
			</label>
		);
	};
};

/** Props {@link FeatureLine} reads. */
interface FeatureLineProps {
	feature: FareOptions.Feature;
	statusLabels: FareOptions.StatusLabels;
}

/**
 * One feature: a check, cross or coin in its tone, the status words for a screen reader, and
 * the label. A left-out feature is muted and struck through, so its status reads by shape too.
 *
 * @param handle Runtime handle carrying the feature and the status words.
 * @returns The render function producing the feature's list item.
 */
function FeatureLine(handle: Handle<FeatureLineProps>) {
	return () => {
		let { feature, statusLabels } = handle.props;
		let status = feature.included;

		return (
			<li
				data-slot="fare-option-feature"
				data-included={status}
				mix={[
					flex(),
					items("start"),
					gap(2),
					leading(1.35),
					status === "no" ? fg("neutral.muted") : fg("neutral.emphasis"),
				]}
			>
				<span
					aria-hidden="true"
					mix={[
						inlineFlex(),
						raw({ flexShrink: 0, marginBlockStart: "0.0625rem" }),
						status === "yes" ? fg("success") : null,
						status === "fee" ? fg("warning.emphasis") : null,
						when("& > svg", raw({ inlineSize: "1rem", blockSize: "1rem" })),
					]}
				>
					{status === "yes" ? <CheckIcon size={16} /> : null}
					{status === "no" ? <XIcon size={16} /> : null}
					{status === "fee" ? <CoinsIcon size={16} /> : null}
				</span>
				<span
					mix={[minIs(0), status === "no" ? raw({ textDecorationLine: "line-through" }) : null]}
				>
					<span mix={[visuallyHidden()]}>{`${statusLabels[status]}: `}</span>
					{feature.label}
				</span>
			</li>
		);
	};
}
