/**
 * A bundle's price beside what its parts cost apart: a line per part (flight, stay, car) with
 * its separate price struck through, then the bundled price large with a "You save" badge.
 * Prices arrive formatted; the summary sits beside the parts once its container is wide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { BedDoubleIcon, CarIcon, PlaneIcon, TicketIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, raw, mergeMix } from "@sdxc/u/general";
import { container, flex, gap, grid, inlineFlex, items, justify, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is, m, minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, tabularNums, text, weight } from "@sdxc/u/typography";

/** Container the summary names, so it lays out by its own width. */
const CONTAINER_NAME = "ui-package-savings";

/** Summary width from which the bundled price sits beside the parts. */
const SIDE_BY_SIDE_WIDTH = "32rem";

/**
 * Prop types for {@link PackageSavings} and its compound parts.
 */
export namespace PackageSavings {
	/** What a part is, which picks its icon. */
	export type Kind = "flight" | "stay" | "car" | "activity";

	/** What {@link PackageSavings} shares with its parts. */
	export interface Context {
		separateLabel?: string;
	}

	/** Every native `<section>` attribute, plus the bundle's price and what it saves. */
	export interface Props extends Omit<TagProps<"section">, "title"> {
		/** What the bundle is, such as "Flight + Hotel + Car", over the parts. */
		title?: RemixNode;
		/** The saving as a badge, such as "You save $212". */
		savings: RemixNode;
		/** What the bundled price is, such as "Package price". */
		bundleLabel: RemixNode;
		/** The bundled price, formatted, such as "$1,486". */
		bundlePrice: string;
		/** What the price covers, such as "2 travellers · taxes included", under it. */
		bundleDetail?: RemixNode;
		/** The parts' prices added up, struck through above the bundled price, such as "$1,698". */
		separateTotal?: string;
		/**
		 * Read before every struck price, such as "Booked separately", since a strike-through
		 * is silent to most screen readers.
		 */
		separateLabel?: string;
		/** A booking button or link under the bundled price. */
		action?: RemixNode;
		/** The {@link PackageSavings.Part} lines. */
		children: RemixNode;
	}

	/** Every native `<li>` attribute, plus what the part is and costs alone. */
	export interface PartProps extends Omit<TagProps<"li">, "children"> {
		kind: Kind;
		/** A glyph in place of the kind's own. */
		icon?: RemixNode;
		/** What the part is, such as "Return flights MRW ⇄ VLS". */
		label: RemixNode;
		/** A second line, such as "Larkwing Air · Economy". */
		detail?: RemixNode;
		/** What the part costs booked alone, formatted, such as "$684"; drawn struck through. */
		price: string;
	}
}

/**
 * The glyph for a part of each kind.
 *
 * @param kind What the part is.
 * @returns A 16px icon for the kind.
 */
function kindIcon(kind: PackageSavings.Kind): RemixNode {
	if (kind === "flight") return <PlaneIcon size={16} />;
	if (kind === "stay") return <BedDoubleIcon size={16} />;
	if (kind === "car") return <CarIcon size={16} />;
	return <TicketIcon size={16} />;
}

/** Props {@link StruckPrice} reads. */
interface StruckPriceProps {
	price: string;
	label?: string;
}

/**
 * A price as it would cost apart: muted and inside `<s>`, led by hidden words that say so.
 *
 * @param handle Runtime handle carrying the price and its hidden lead.
 * @returns The render function producing the struck price.
 */
function StruckPrice(handle: Handle<StruckPriceProps>) {
	return () => {
		let { price, label } = handle.props;
		return (
			<>
				{label === undefined ? null : <span mix={[visuallyHidden()]}>{`${label}: `}</span>}
				<s data-slot="package-savings-separate" mix={[fg("neutral.muted"), tabularNums()]}>
					{price}
				</s>
			</>
		);
	};
}

/**
 * Renders the bundle: a `<section>` whose title and parts list sit over the bundled price under
 * 32rem, and beside it from there. The parts total is struck through over the bundled price,
 * and the saving is a success-toned badge beside it.
 *
 * @param handle Runtime handle carrying the section's props and sharing the struck-price words.
 * @returns The render function producing the bundle's markup.
 * @example
 * <PackageSavings title="Flight + Hotel" savings="You save $212" bundleLabel="Package price"
 * 	bundlePrice="$1,486" separateTotal="$1,698" separateLabel="Booked separately">
 * 	<PackageSavings.Part kind="flight" label="Return flights MRW ⇄ VLS" price="$684" />
 * 	<PackageSavings.Part kind="stay" label="5 nights at Hotel Saltmarsh" price="$1,014" />
 * </PackageSavings>
 */
export function PackageSavings(handle: Handle<PackageSavings.Props, PackageSavings.Context>) {
	return () => {
		let {
			title,
			savings,
			bundleLabel,
			bundlePrice,
			bundleDetail,
			separateTotal,
			separateLabel,
			action,
			children,
			mix,
			...rest
		} = handle.props;
		handle.context.set({ separateLabel });

		return (
			<section
				data-slot="package-savings"
				{...rest}
				mix={mergeMix([container(CONTAINER_NAME, "inline-size"), minIs(0), text("sm")], mix)}
			>
				<div
					data-slot="package-savings-body"
					mix={[
						grid(),
						gap(4),
						at(
							SIDE_BY_SIDE_WIDTH,
							CONTAINER_NAME,
							raw({
								gridTemplateColumns: "minmax(0, 1fr) minmax(11rem, auto)",
								columnGap: "1.5rem",
								alignItems: "start",
							}),
						),
					]}
				>
					<div mix={[vstack({ gap: 3 }), minIs(0)]}>
						{title === undefined ? null : (
							<p
								data-slot="package-savings-title"
								mix={[m(0), weight("semibold"), fg("neutral.emphasis")]}
							>
								{title}
							</p>
						)}
						<ul
							data-slot="package-savings-parts"
							mix={[m(0), p(0), listStyle("none"), vstack({ gap: 3 })]}
						>
							{children}
						</ul>
					</div>
					<div
						data-slot="package-savings-bundle"
						mix={[
							vstack({ gap: 2 }),
							p(4),
							rounded("lg"),
							bg("success.tint"),
							border({ color: "success.border", width: 1 }),
						]}
					>
						<div
							mix={[flex(), items("center"), justify("between"), raw({ flexWrap: "wrap" }), gap(2)]}
						>
							<span
								data-slot="package-savings-bundle-label"
								mix={[text("xs"), weight("medium"), fg("neutral.emphasis")]}
							>
								{bundleLabel}
							</span>
							<span
								data-slot="package-savings-badge"
								mix={[
									inlineFlex(),
									raw({ paddingInline: "0.5rem", paddingBlock: "0.125rem" }),
									rounded("full"),
									bg("success.solid"),
									fg("success.onSolid"),
									text("xs"),
									weight("semibold"),
									leading(1.4),
								]}
							>
								{savings}
							</span>
						</div>
						<p mix={[m(0), flex(), items("baseline"), raw({ flexWrap: "wrap" }), gap(2)]}>
							{separateTotal === undefined ? null : (
								<span mix={[text("sm")]}>
									<StruckPrice price={separateTotal} label={separateLabel} />
								</span>
							)}
							<output
								data-slot="package-savings-price"
								mix={[
									text("2xl"),
									weight("semibold"),
									leading(1.1),
									tabularNums(),
									fg("neutral.emphasis"),
								]}
							>
								{bundlePrice}
							</output>
						</p>
						{bundleDetail === undefined ? null : (
							<span
								data-slot="package-savings-bundle-detail"
								mix={[text("xs"), fg("neutral.muted")]}
							>
								{bundleDetail}
							</span>
						)}
						{action === undefined ? null : (
							<div
								data-slot="package-savings-action"
								mix={[
									flex(),
									raw({ marginBlockStart: "0.25rem" }),
									when("& > *", raw({ flex: "1 1 auto" })),
								]}
							>
								{action}
							</div>
						)}
					</div>
				</div>
			</section>
		);
	};
}

/**
 * Renders one part of the bundle: its icon in a tinted square, its label and detail, and what
 * it costs alone struck through at the end, led by the bundle's `separateLabel` when set.
 *
 * @param handle Runtime handle carrying the part's props.
 * @returns The render function producing the part's list item.
 * @example
 * <PackageSavings.Part kind="car" label="Compact car, 5 days" detail="Tallow Rent" price="$190" />
 */
PackageSavings.Part = function PackageSavingsPart(handle: Handle<PackageSavings.PartProps>) {
	return () => {
		let { kind, icon, label, detail, price, mix, ...rest } = handle.props;
		let { separateLabel } = handle.context.get(PackageSavings);

		return (
			<li
				data-slot="package-savings-part"
				data-kind={kind}
				{...rest}
				mix={mergeMix(
					[
						grid(),
						raw({
							gridTemplateColumns: "2rem minmax(0, 1fr) auto",
							columnGap: "0.75rem",
							alignItems: "center",
						}),
					],
					mix,
				)}
			>
				<span
					aria-hidden="true"
					mix={[
						inlineFlex(),
						items("center"),
						justify("center"),
						is("2rem"),
						bs("2rem"),
						rounded("md"),
						bg("neutral.tint"),
						fg("neutral.muted"),
					]}
				>
					{icon ?? kindIcon(kind)}
				</span>
				<span mix={[vstack({ gap: 0.5 }), minIs(0)]}>
					<span
						data-slot="package-savings-part-label"
						mix={[weight("medium"), fg("neutral.emphasis"), raw({ overflowWrap: "anywhere" })]}
					>
						{label}
					</span>
					{detail === undefined ? null : (
						<span mix={[text("xs"), fg("neutral.muted")]}>{detail}</span>
					)}
				</span>
				<span mix={[raw({ whiteSpace: "nowrap", textAlign: "end" })]}>
					<StruckPrice price={price} label={separateLabel} />
				</span>
			</li>
		);
	};
};
