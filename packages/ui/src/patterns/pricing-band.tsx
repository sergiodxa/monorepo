/**
 * Pricing band: a {@link MarketingHeader} over a grid of plan cards, each with
 * a price, a checked feature list and an action. A featured plan inverts its
 * card and moves first on a phone, so the recommended plan is the first read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityMixin } from "@sdxc/u";
import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container, flexWrap, gap, grid, hstack, items, vstack } from "@sdxc/u/layout";
import { at, dark } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { balance, leading, tabularNums, text, weight } from "@sdxc/u/typography";

import { HeadingScope, resolveHeadingLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";
import { MarketingHeader } from "../components/marketing-header.js";
import { MarketingSection } from "../components/marketing-section.js";
import { balancedGrid } from "../styles/card-grid.js";
import {
	marketingBandTone,
	marketingCtaChrome,
	marketingEmphasis,
	marketingSurface,
} from "../styles/marketing.js";

import { CheckList } from "./check-row.js";

/** How many plans share one row from the `lg` container when `columns` is omitted. */
const DEFAULT_COLUMNS: PricingBand.Columns = 3;

/** Band fill {@link PricingBand} applies when `tone` is omitted. */
const DEFAULT_TONE: PricingBand.Tone = "plain";

/** Container the plan grid and every plan card query. */
const CONTAINER_NAME = "ui-marketing-pricing";

/**
 * Corner radius of a plan card, a step rounder than a staged surface by default; a page
 * sets `--ui-marketing-plan-radius` to square or soften every plan at once.
 */
const PLAN_RADIUS = "var(--ui-marketing-plan-radius, 1.5rem)";

/**
 * The lift a featured plan floats on in light mode. A page sets `--ui-marketing-plan-lift`
 * to a shadow of its own, or to `0 0 #0000` for a plan that sits flat on the band.
 */
const FEATURED_LIFT =
	"var(--ui-marketing-plan-lift, 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1))";

/**
 * The featured plan's edge on a dark page, where the inverse tone renders as a raised
 * surface: a strong brand ring over a deeper lift keeps it distinct from its neighbours.
 * The ring stays when a page flattens the lift through `--ui-marketing-plan-lift`.
 */
const FEATURED_DARK_EDGE =
	"inset 0 0 0 1px var(--ui-brand-border-strong), var(--ui-marketing-plan-lift, 0 20px 25px -5px rgb(0 0 0 / 0.5))";

/**
 * Prop types for {@link PricingBand} and {@link PricingBand.Plan}.
 */
export namespace PricingBand {
	/**
	 * How many plans share one row from the `lg` container; a phone stacks them and the
	 * `md` container pairs them.
	 */
	export type Columns = 2 | 3;

	/**
	 * Band fill forwarded to {@link MarketingSection}.
	 */
	export type Tone = MarketingSection.Tone;

	/**
	 * Per-part styling for slots the band composes.
	 */
	export interface PartsProps {
		/** Styling for the header title. */
		title?: TagProps<"h1">["mix"];
		/** Styling for the header lead. */
		description?: TagProps<"p">["mix"];
		/** Styling for the plan grid. */
		plans?: TagProps<"div">["mix"];
	}

	/**
	 * Props accepted by {@link PricingBand}.
	 */
	export interface Props extends Omit<
		MarketingSection.Props,
		"children" | "tone" | "title" | "parts"
	> {
		/** Plans per row from the `lg` container. Defaults to {@link DEFAULT_COLUMNS}. */
		columns?: Columns;
		/** Band fill. Defaults to {@link DEFAULT_TONE}. */
		tone?: Tone;
		/** Optional eyebrow above the title. */
		eyebrow?: RemixNode;
		/** Section title — required, always supplied by the page. */
		title: RemixNode;
		/** Supporting lead under the title. */
		description?: RemixNode;
		/** One {@link PricingBand.Plan} per plan, in reading order for wide layouts. */
		children: RemixNode;
		/** Per-part styling for title, lead, and plan grid. */
		parts?: PartsProps;
	}

	/**
	 * Props accepted by {@link PricingBand.Plan}.
	 */
	export interface PlanProps extends Omit<TagProps<"div">, "children"> {
		/** Plan name, rendered as the card's heading one level below the band title. */
		name: RemixNode;
		/** The amount, drawn large in tabular figures (`"$29"`, `"Free"`). */
		price: RemixNode;
		/** Billing period beside the amount, drawn muted (`"/month"`). */
		period?: RemixNode;
		/** One line on who the plan is for. */
		description?: RemixNode;
		/** {@link CheckRow} items; the card lays them in a {@link CheckList}. */
		features?: RemixNode;
		/**
		 * The plan's call to action, stretched across the card's foot. Its button or link
		 * takes the marketing CTA radius, weight and edge; leave `size` at the 40px default.
		 */
		action: RemixNode;
		/** Inverts the card, lifts it, and moves it first while plans stack. */
		featured?: boolean;
		/** A short label beside the name, such as "Most popular". */
		badge?: RemixNode;
	}
}

/**
 * Renders a pricing band with a chapter header and a plan grid of one column on a phone, two
 * from the `md` container and `columns` from `lg`, evened per plan count with a short last
 * row centred. Each card pushes its action to the foot, so actions in one row line up.
 *
 * @param handle Runtime handle carrying the band's props.
 * @returns The render function producing the band's markup.
 * @example
 * <PricingBand title={t("pricing.title")}>
 * 	<PricingBand.Plan name="Team" price="$29" period="/month" featured action={cta} />
 * </PricingBand>
 */
export function PricingBand(handle: Handle<PricingBand.Props>) {
	return () => {
		let { children, columns, description, eyebrow, mix, parts, spacing, title, tone, ...rest } =
			handle.props;
		let resolvedColumns = columns ?? DEFAULT_COLUMNS;
		let resolvedTone = tone ?? DEFAULT_TONE;
		let resolvedSpacing = spacing ?? "normal";

		return (
			<MarketingSection {...rest} tone={resolvedTone} spacing={resolvedSpacing} mix={mix}>
				<div mix={[vstack({ gap: 0, align: "stretch" })]}>
					<MarketingHeader
						eyebrow={eyebrow}
						description={description}
						parts={{ title: parts?.title, description: parts?.description }}
					>
						{title}
					</MarketingHeader>
					<div data-columns={String(resolvedColumns)} mix={[container(CONTAINER_NAME)]}>
						<HeadingScope>
							<div
								data-slot="pricing-plans"
								mix={[
									grid(),
									gap(8),
									balancedGrid(CONTAINER_NAME, [
										{ query: "(width < 36rem)", columns: 1 },
										{ query: "(36rem <= width < 48rem)", columns: 2 },
										{ query: "(width >= 48rem)", columns: resolvedColumns },
									]),
									parts?.plans,
								]}
							>
								{children}
							</div>
						</HeadingScope>
					</div>
				</div>
			</MarketingSection>
		);
	};
}

/**
 * Card fill and edge for a plan. A plain plan is a raised surface whose radius comes
 * through the surface radius token; a featured one takes the inverse band tone, sits first
 * while the grid is one column, and draws its lift on an overlay so the tone's own edge stays.
 */
function planSurface(featured: boolean) {
	let shape = combine([
		raw({ "--ui-marketing-radius-surface": PLAN_RADIUS, padding: "1.5rem" }),
		at("md", CONTAINER_NAME, raw({ padding: "2rem" })),
	]);
	if (!featured) return [marketingSurface(), shape];

	return [
		marketingBandTone("inverse"),
		shape,
		combine([
			raw({ position: "relative", borderRadius: PLAN_RADIUS, order: "-1" }),
			at("md", CONTAINER_NAME, raw({ order: "0" })),
			when(
				"&::after",
				raw({
					content: '""',
					position: "absolute",
					inset: "0",
					borderRadius: "inherit",
					pointerEvents: "none",
					boxShadow: FEATURED_LIFT,
				}),
			),
			dark(when("&::after", raw({ boxShadow: FEATURED_DARK_EDGE }))),
		]),
	];
}

/**
 * The marketing CTA chrome for the control in a plan's action, wrapped or not, so it
 * shares the hero CTA's radius, weight and tactile edge. `marketingCtaChrome()` builds
 * a `@sdxc/u` utility, which nests under the slot's descendant selector.
 */
function actionChrome(): UtilityMixin {
	return marketingCtaChrome() as unknown as UtilityMixin;
}

/**
 * One plan card: name and badge, price with its period, a one-line pitch, the checked
 * features, and the action at the foot.
 *
 * @param handle Runtime handle carrying the card's props.
 * @returns The render function producing the card's markup.
 * @example
 * <PricingBand.Plan
 * 	name="Team" price="$29" period="/month" featured badge="Most popular"
 * 	features={<><CheckRow>50 monitors</CheckRow><CheckRow>30-second checks</CheckRow></>}
 * 	action={<LinkButton href="/signup" color="brand">Start trial</LinkButton>}
 * />
 */
PricingBand.Plan = function PricingBandPlan(handle: Handle<PricingBand.PlanProps>) {
	return () => {
		let { action, badge, description, featured, features, mix, name, period, price, ...rest } =
			handle.props;
		let isFeatured = featured === true;
		let Tag = TAG_BY_LEVEL[resolveHeadingLevel(handle)];

		return (
			<div
				{...rest}
				data-slot="pricing-plan"
				data-featured={isFeatured ? "true" : undefined}
				mix={[vstack({ gap: 6, align: "stretch" }), planSurface(isFeatured), mix]}
			>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<div mix={[hstack({ gap: 3, justify: "between" }), items("center"), flexWrap()]}>
						<Tag
							data-slot="pricing-plan-name"
							mix={[
								text("lg"),
								leading("snug"),
								balance(),
								weight("semibold"),
								fg("neutral.emphasis"),
							]}
						>
							{name}
						</Tag>
						{badge}
					</div>
					<p
						data-slot="pricing-plan-price"
						mix={[hstack({ gap: 1 }), items("baseline"), raw({ margin: "0" })]}
					>
						<span
							mix={[
								tabularNums(),
								weight("semibold"),
								fg("neutral.emphasis"),
								raw({ fontSize: "2.5rem", lineHeight: "1", letterSpacing: "-0.025em" }),
							]}
						>
							{price}
						</span>
						{period ? (
							<span mix={[fg("neutral.muted"), raw({ fontSize: "1rem", lineHeight: "1.5rem" })]}>
								{period}
							</span>
						) : null}
					</p>
					{description ? (
						<p
							data-slot="pricing-plan-description"
							mix={[
								fg("neutral"),
								text("sm"),
								raw({ margin: "0", lineHeight: "1.5rem" }),
								marketingEmphasis(),
							]}
						>
							{description}
						</p>
					) : null}
				</div>
				{features ? <CheckList>{features}</CheckList> : null}
				<div
					data-slot="pricing-plan-action"
					mix={[
						grid(),
						raw({ marginBlockStart: "auto" }),
						when("& :is(button, a)", actionChrome()),
					]}
				>
					{action}
				</div>
			</div>
		);
	};
};
