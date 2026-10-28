/**
 * Eyebrow, chapter title, and lead copy that open a marketing band. The title
 * uses display chapter typography; the lead stays on the marketing lead measure
 * so the claim reads first and the support follows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { inlineFlex, items, vstack } from "@sdxc/u/layout";
import { m, mbe, mi, pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import {
	font,
	leading,
	text,
	textAlign,
	textTransform,
	tracking,
	weight,
} from "@sdxc/u/typography";

import { marketingLead } from "../styles/marketing.js";

import { Heading } from "./heading.js";

/** Content alignment {@link MarketingHeader} applies when `align` is omitted. */
const DEFAULT_ALIGN: MarketingHeader.Align = "start";

/** Eyebrow chrome {@link MarketingHeader} applies when `eyebrowVariant` is omitted. */
const DEFAULT_EYEBROW_VARIANT: MarketingHeader.EyebrowVariant = "pill";

/**
 * Prop types for {@link MarketingHeader}.
 */
export namespace MarketingHeader {
	/**
	 * Whether the stack stretches start-aligned or centers as one statement.
	 */
	export type Align = "start" | "center";

	/**
	 * How the optional eyebrow reads: a filled pill, a mono label, or a chip
	 * with stronger tracking for short announcements.
	 */
	export type EyebrowVariant = "pill" | "mono" | "chip";

	/**
	 * Per-part styling for the elements the header renders besides its host.
	 */
	export interface PartsProps {
		/** Styling for the optional eyebrow label. */
		eyebrow?: TagProps<"span">["mix"];
		/** Styling for the title {@link Heading}. */
		title?: TagProps<"h1">["mix"];
		/** Styling for the optional lead paragraph. */
		description?: TagProps<"p">["mix"];
	}

	/**
	 * Props accepted by {@link MarketingHeader}.
	 */
	export interface Props extends TagProps<"header"> {
		/** Short label above the title. */
		eyebrow?: RemixNode;
		/**
		 * Eyebrow chrome. Defaults to {@link DEFAULT_EYEBROW_VARIANT} when an
		 * eyebrow is present.
		 */
		eyebrowVariant?: EyebrowVariant;
		/** Supporting copy under the title. */
		description?: RemixNode;
		/** Stack alignment. Defaults to {@link DEFAULT_ALIGN}. */
		align?: Align;
		/** Per-part styling for eyebrow, title, and description. */
		parts?: PartsProps;
		/** Title copy — rendered through {@link Heading} at chapter display size. */
		children: RemixNode;
	}
}

/**
 * Renders an optional eyebrow, a chapter-sized {@link Heading} from `children`,
 * and an optional lead paragraph. Nest inside a {@link HeadingScope} so the
 * title picks up the band's outline depth.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the header's markup.
 * @example
 * <MarketingHeader eyebrow={t("badge")} description={t("lead")} align="center">
 * 	{t("title")}
 * </MarketingHeader>
 * @example
 * <MarketingHeader eyebrow={t("new")} eyebrowVariant="chip" description={t("lead")}>
 * 	{t("title")}
 * </MarketingHeader>
 */
export function MarketingHeader(handle: Handle<MarketingHeader.Props>) {
	return () => {
		let { align, children, description, eyebrow, eyebrowVariant, mix, parts, ...rest } =
			handle.props;
		let resolvedAlign = align ?? DEFAULT_ALIGN;
		let resolvedEyebrowVariant = eyebrowVariant ?? DEFAULT_EYEBROW_VARIANT;
		let isCenter = resolvedAlign === "center";

		return (
			<header
				{...rest}
				data-align={resolvedAlign}
				mix={[
					vstack({
						align: isCenter ? "center" : "stretch",
						gap: 2,
					}),
					isCenter ? [textAlign("center"), mi("auto")] : [],
					mbe(10),
					mix,
				]}
			>
				{eyebrow ? (
					<span
						data-variant={resolvedEyebrowVariant}
						mix={[
							inlineFlex(),
							items("center"),
							text("xs"),
							weight("semibold"),
							when('&[data-variant="pill"]', [
								pb(0.5),
								pi(2.5),
								rounded("full"),
								border({ color: "brand", width: 1, style: "solid" }),
								bg("brand.tint"),
								fg("brand"),
							]),
							when('&[data-variant="mono"]', [
								font("mono"),
								tracking("wide"),
								textTransform("uppercase"),
								fg("neutral.muted"),
							]),
							when('&[data-variant="chip"]', [
								pb(0.5),
								pi(2.5),
								rounded("full"),
								border({ color: "brand", width: 1, style: "solid" }),
								bg("brand.solid"),
								fg("brand.onSolid"),
								tracking("wider"),
								textTransform("uppercase"),
							]),
							parts?.eyebrow,
						]}
					>
						{eyebrow}
					</span>
				) : null}

				<Heading size="chapter" mix={[m(0), description ? mbe(2) : [], parts?.title]}>
					{children}
				</Heading>

				{description ? (
					<p
						mix={[
							marketingLead(),
							leading("relaxed"),
							isCenter ? mi("auto") : [],
							parts?.description,
						]}
					>
						{description}
					</p>
				) : null}
			</header>
		);
	};
}
