/**
 * A rental car result: the car's picture, its class and example model, spec chips with an icon
 * each, perks, the rental company and its rating, the pickup point, and the daily and total
 * price over the caller's actions. The picture heads the card when narrow and leads it when wide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import {
	CarFrontIcon,
	CheckIcon,
	CogIcon,
	FuelIcon,
	GaugeIcon,
	LuggageIcon,
	MapPinIcon,
	SnowflakeIcon,
	StarIcon,
	UsersIcon,
	ZapIcon,
} from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { listStyle, raw, mergeMix } from "@sdxc/u/general";
import { container, flex, gap, grid, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, minIs, p, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, tabularNums, text, truncate, weight } from "@sdxc/u/typography";

import type { HeadingLevel } from "../components/heading-scope.js";

import {
	readAmbientLevel,
	resolveHeadingLevel,
	TAG_BY_LEVEL,
} from "../components/heading-scope.js";

/** Container the card names, so it lays out by the width of the results column. */
const CONTAINER_NAME = "ui-car-offer";

/** Card width from which the picture and the price each take a column. */
const ROW_WIDTH = "38rem";

/** Heading level the class and model take where nothing sets one. */
const DEFAULT_LEVEL: HeadingLevel = 3;

/**
 * Prop types for {@link CarOffer}.
 */
export namespace CarOffer {
	/** What a spec chip states, which picks its icon. */
	export type SpecKind =
		| "seats"
		| "bags"
		| "doors"
		| "transmission"
		| "fuel"
		| "electric"
		| "ac"
		| "mileage";

	/** One spec chip, such as `{ kind: "seats", label: "5 seats" }`. */
	export interface Spec {
		kind: SpecKind;
		label: RemixNode;
		/** A glyph in place of the kind's own. */
		icon?: RemixNode;
	}

	/** Every native `<article>` attribute, plus the car, the company and the price. */
	export interface Props extends Omit<TagProps<"article">, "children"> {
		/** The car's picture, such as an `<img>` or SVG; it fills a 16:10 frame. */
		art?: RemixNode;
		/** The car class, such as "Compact"; it heads the card. */
		category: RemixNode;
		/** The example model, such as "Velo C3 or similar", after the class. */
		model?: RemixNode;
		/** The heading level of the class and model; the ambient level, then 3, when left out. */
		level?: HeadingLevel;
		specs?: Spec[];
		/** Short benefits, each drawn with a check, such as "Free cancellation". */
		perks?: RemixNode[];
		/** The rental company's name, such as "Tallow Rent". */
		vendor?: RemixNode;
		/** The rental company's logo, drawn in a 1.5rem-tall box before its name. */
		vendorLogo?: RemixNode;
		/** The company's rating as shown, such as "8.6 · Excellent", after a star. */
		rating?: RemixNode;
		/** Where the car is collected, such as "In terminal · Merrow Airport". */
		pickup?: RemixNode;
		/** Labels over the card, such as a `<Badge>` reading "Great value". */
		badges?: RemixNode;
		/** The daily price, formatted by the caller, such as "$38". */
		price: RemixNode;
		/** What the price is per, such as "/ day", after it in small type. */
		priceUnit?: RemixNode;
		/** The total for the rental, such as "$266 total". */
		total?: RemixNode;
		/** The select link or button, under the price. */
		actions?: RemixNode;
	}
}

/**
 * The glyph for a spec chip of each kind.
 *
 * @param kind What the chip states.
 * @returns A 16px icon for the kind.
 */
function specIcon(kind: CarOffer.SpecKind): RemixNode {
	if (kind === "seats") return <UsersIcon size={16} />;
	if (kind === "bags") return <LuggageIcon size={16} />;
	if (kind === "doors") return <CarFrontIcon size={16} />;
	if (kind === "transmission") return <CogIcon size={16} />;
	if (kind === "fuel") return <FuelIcon size={16} />;
	if (kind === "electric") return <ZapIcon size={16} />;
	if (kind === "ac") return <SnowflakeIcon size={16} />;
	return <GaugeIcon size={16} />;
}

/**
 * Renders the card as an `<article>` headed by the class and model in a heading at the ambient
 * level. Under 38rem the picture heads the card and the price closes it; wider, the picture,
 * the details and the price take three columns. Spec icons are decoration beside their words.
 *
 * @param handle Runtime handle carrying the card's props.
 * @returns The render function producing the card's markup.
 * @example
 * <CarOffer art={<img src="/cars/c3.png" alt="" />} category="Compact" model="Velo C3 or similar"
 * 	specs={[{ kind: "seats", label: "5 seats" }, { kind: "transmission", label: "Automatic" }]}
 * 	vendor="Tallow Rent" rating="8.6 · Excellent" pickup="In terminal" price="$38" priceUnit="/ day"
 * 	total="$266 total" actions={<Button>View deal</Button>} />
 */
export function CarOffer(handle: Handle<CarOffer.Props>) {
	return () => {
		let {
			art,
			category,
			model,
			level,
			specs,
			perks,
			vendor,
			vendorLogo,
			rating,
			pickup,
			badges,
			price,
			priceUnit,
			total,
			actions,
			mix,
			...rest
		} = handle.props;
		let Heading =
			TAG_BY_LEVEL[resolveHeadingLevel(handle, level ?? readAmbientLevel(handle) ?? DEFAULT_LEVEL)];

		return (
			<article
				data-slot="car-offer"
				{...rest}
				mix={mergeMix(
					[
						container(CONTAINER_NAME, "inline-size"),
						minIs(0),
						rounded("lg"),
						bg("var(--ui-surface-raised, var(--ui-bg, Canvas))"),
						border({ color: "neutral.border", width: 1 }),
						shadow("xs"),
						raw({ overflow: "clip" }),
						text("sm"),
					],
					mix,
				)}
			>
				<div
					data-slot="car-offer-body"
					mix={[
						grid(),
						raw({ gridTemplateAreas: '"art" "details" "price"' }),
						at(
							ROW_WIDTH,
							CONTAINER_NAME,
							raw({
								gridTemplateColumns: "minmax(9rem, 13rem) minmax(0, 1fr) minmax(9rem, auto)",
								gridTemplateAreas: '"art details price"',
							}),
						),
					]}
				>
					{art === undefined ? null : (
						<div
							data-slot="car-offer-art"
							mix={[
								raw({
									gridArea: "art",
									aspectRatio: "16 / 10",
									maxBlockSize: "11rem",
									alignSelf: "center",
								}),
								flex(),
								items("center"),
								raw({ justifyContent: "center" }),
								p(4),
								bg("neutral.tint"),
								when(
									"& > :is(img, svg)",
									raw({ inlineSize: "100%", blockSize: "100%", objectFit: "contain" }),
								),
								at(
									ROW_WIDTH,
									CONTAINER_NAME,
									raw({ alignSelf: "stretch", aspectRatio: "auto", maxBlockSize: "none" }),
								),
							]}
						>
							{art}
						</div>
					)}
					<div
						data-slot="car-offer-details"
						mix={[raw({ gridArea: "details" }), vstack({ gap: 3 }), minIs(0), p(4)]}
					>
						{badges === undefined ? null : (
							<div mix={[flex(), raw({ flexWrap: "wrap" }), gap(1.5)]}>{badges}</div>
						)}
						<Heading
							data-slot="car-offer-title"
							mix={[m(0), text("base"), leading(1.3), fg("neutral.emphasis")]}
						>
							<span mix={[weight("semibold")]}>{category}</span>
							{model === undefined ? null : (
								<span data-slot="car-offer-model" mix={[weight("normal"), fg("neutral.muted")]}>
									{" · "}
									{model}
								</span>
							)}
						</Heading>
						{specs === undefined || specs.length === 0 ? null : (
							<ul
								data-slot="car-offer-specs"
								mix={[m(0), p(0), listStyle("none"), flex(), raw({ flexWrap: "wrap" }), gap(1.5)]}
							>
								{specs.map((spec) => (
									<li
										data-slot="car-offer-spec"
										data-kind={spec.kind}
										mix={[
											inlineFlex(),
											items("center"),
											gap(1.5),
											pi(2),
											raw({ paddingBlock: "0.1875rem" }),
											rounded("md"),
											bg("neutral.tint"),
											border({ color: "neutral.border", width: 1 }),
											text("xs"),
											fg("neutral.emphasis"),
										]}
									>
										<span
											aria-hidden="true"
											mix={[
												inlineFlex(),
												fg("neutral.muted"),
												when("& > svg", raw({ inlineSize: "0.875rem", blockSize: "0.875rem" })),
											]}
										>
											{spec.icon ?? specIcon(spec.kind)}
										</span>
										{spec.label}
									</li>
								))}
							</ul>
						)}
						{perks === undefined || perks.length === 0 ? null : (
							<ul
								data-slot="car-offer-perks"
								mix={[m(0), p(0), listStyle("none"), vstack({ gap: 1 }), text("xs")]}
							>
								{perks.map((perk) => (
									<li mix={[flex(), items("start"), gap(1.5), fg("success.emphasis")]}>
										<span aria-hidden="true" mix={[inlineFlex(), fg("success")]}>
											<CheckIcon size={14} />
										</span>
										{perk}
									</li>
								))}
							</ul>
						)}
						{vendor === undefined && pickup === undefined ? null : (
							<div
								data-slot="car-offer-vendor"
								mix={[vstack({ gap: 1.5 }), text("xs"), fg("neutral.muted")]}
							>
								{vendor === undefined ? null : (
									<span mix={[flex(), items("center"), raw({ flexWrap: "wrap" }), gap(2)]}>
										{vendorLogo === undefined ? null : (
											<span
												aria-hidden="true"
												mix={[
													inlineFlex(),
													raw({ blockSize: "1.5rem", maxInlineSize: "5rem" }),
													when("& > :is(svg, img)", raw({ blockSize: "100%", inlineSize: "auto" })),
												]}
											>
												{vendorLogo}
											</span>
										)}
										<span
											data-slot="car-offer-vendor-name"
											mix={[weight("medium"), fg("neutral.emphasis")]}
										>
											{vendor}
										</span>
										{rating === undefined ? null : (
											<span
												data-slot="car-offer-rating"
												mix={[inlineFlex(), items("center"), gap(1)]}
											>
												<span aria-hidden="true" mix={[inlineFlex(), fg("warning")]}>
													<StarIcon size={12} fill="currentColor" stroke-width={0} />
												</span>
												{rating}
											</span>
										)}
									</span>
								)}
								{pickup === undefined ? null : (
									<span data-slot="car-offer-pickup" mix={[flex(), items("start"), gap(1.5)]}>
										<span aria-hidden="true" mix={[inlineFlex(), raw({ flexShrink: 0 })]}>
											<MapPinIcon size={14} />
										</span>
										<span mix={[minIs(0)]}>{pickup}</span>
									</span>
								)}
							</div>
						)}
					</div>
					<div
						data-slot="car-offer-price"
						mix={[
							raw({ gridArea: "price" }),
							flex(),
							items("center"),
							raw({ justifyContent: "space-between", flexWrap: "wrap" }),
							gap(3),
							p(4),
							border({ color: "neutral.border", width: 0 }),
							raw({ borderBlockStartWidth: "1px", borderBlockStartStyle: "solid" }),
							at(
								ROW_WIDTH,
								CONTAINER_NAME,
								raw({
									flexDirection: "column",
									alignItems: "stretch",
									justifyContent: "end",
									textAlign: "end",
									borderBlockStartWidth: "0",
									borderInlineStartWidth: "1px",
									borderInlineStartStyle: "solid",
								}),
							),
						]}
					>
						<p mix={[m(0), vstack({ gap: 0.5 })]}>
							<span mix={[raw({ whiteSpace: "nowrap" })]}>
								<span
									data-slot="car-offer-amount"
									mix={[text("xl"), weight("semibold"), tabularNums(), fg("neutral.emphasis")]}
								>
									{price}
								</span>
								{priceUnit === undefined ? null : (
									<span mix={[text("xs"), fg("neutral.muted")]}> {priceUnit}</span>
								)}
							</span>
							{total === undefined ? null : (
								<span
									data-slot="car-offer-total"
									mix={[text("xs"), fg("neutral.muted"), tabularNums(), truncate()]}
								>
									{total}
								</span>
							)}
						</p>
						{actions === undefined ? null : (
							<div
								data-slot="car-offer-actions"
								mix={[flex(), raw({ flexWrap: "wrap", justifyContent: "end" }), gap(2)]}
							>
								{actions}
							</div>
						)}
					</div>
				</div>
			</article>
		);
	};
}
