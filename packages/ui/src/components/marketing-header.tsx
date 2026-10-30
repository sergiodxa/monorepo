/**
 * Eyebrow, chapter title, and lead copy that open a marketing band. The title
 * uses display chapter typography; the lead stays on the marketing lead measure
 * so the claim reads first and the support follows, at token-driven spacing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { self, vstack } from "@sdxc/u/layout";
import { m, mi } from "@sdxc/u/size";
import { textAlign } from "@sdxc/u/typography";

import type { MarketingEyebrowVariant } from "../styles/marketing.js";

import { marketingLead } from "../styles/marketing.js";
import { Eyebrow } from "../utils/eyebrow.js";

import { Heading } from "./heading.js";

/** Content alignment {@link MarketingHeader} applies when `align` is omitted. */
const DEFAULT_ALIGN: MarketingHeader.Align = "start";

/** Eyebrow look {@link MarketingHeader} applies when `eyebrowVariant` is omitted. */
const DEFAULT_EYEBROW_VARIANT: MarketingHeader.EyebrowVariant = "mono";

/**
 * Space below the header, before the band's body: 2.5rem on a phone, 4rem wide. A host
 * that lays out its own gap sets `--ui-marketing-header-end` on the header instead.
 */
const HEADER_SPACE =
	"var(--ui-marketing-header-end, var(--ui-marketing-header-space, clamp(2.5rem, 1.82rem + 2.91cqi, 4rem)))";

/**
 * Prop types for {@link MarketingHeader}.
 */
export namespace MarketingHeader {
	/**
	 * Whether the stack stretches start-aligned or centers as one statement.
	 */
	export type Align = "start" | "center";

	/**
	 * How the optional eyebrow reads: a quiet mono label (the section default), a
	 * hairline `quiet` pill, a filled `soft` pill, the brand `pill`, or a
	 * brand-ringed `numbered` pill led by `eyebrowIndex`.
	 */
	export type EyebrowVariant = MarketingEyebrowVariant;

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
		 * Eyebrow look. Defaults to {@link DEFAULT_EYEBROW_VARIANT} when an
		 * eyebrow is present.
		 */
		eyebrowVariant?: EyebrowVariant;
		/** Turns the eyebrow into a link with a trailing arrow that nudges on hover. */
		eyebrowHref?: string;
		/** Index a `numbered` eyebrow leads with, such as `"01"`. */
		eyebrowIndex?: RemixNode;
		/** Supporting copy under the title; `<strong>` fragments draw in the heading ink. */
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
 * and an optional lead paragraph. A mono eyebrow sits 0.5rem above the title and a
 * pill 1.5rem; the lead follows 1rem below; the band's body starts
 * `--ui-marketing-header-space` after. The title renders at the enclosing band's
 * heading level: `<h2>` in a band on a bare page.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the header's markup.
 * @example
 * <MarketingHeader eyebrow={t("badge")} description={t("lead")} align="center">
 * 	{t("title")}
 * </MarketingHeader>
 * @example
 * <MarketingHeader eyebrow={t("chapter")} eyebrowVariant="numbered" eyebrowIndex="02">
 * 	{t("title")}
 * </MarketingHeader>
 */
export function MarketingHeader(handle: Handle<MarketingHeader.Props>) {
	return () => {
		let {
			align,
			children,
			description,
			eyebrow,
			eyebrowHref,
			eyebrowIndex,
			eyebrowVariant,
			mix,
			parts,
			...rest
		} = handle.props;
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
						gap: 0,
					}),
					isCenter ? [textAlign("center"), mi("auto")] : [],
					raw({ marginBlockEnd: HEADER_SPACE }),
					mix,
				]}
			>
				{eyebrow ? (
					<Eyebrow
						href={eyebrowHref}
						variant={resolvedEyebrowVariant}
						index={resolvedEyebrowVariant === "numbered" ? eyebrowIndex : undefined}
						mix={[
							self(isCenter ? "center" : "start"),
							raw({ marginBlockEnd: resolvedEyebrowVariant === "mono" ? "0.5rem" : "1.5rem" }),
							parts?.eyebrow,
						]}
					>
						{eyebrow}
					</Eyebrow>
				) : null}

				<Heading size="chapter" mix={[m(0), parts?.title]}>
					{children}
				</Heading>

				{description ? (
					<p
						mix={[
							marketingLead(),
							raw({ marginBlockStart: "1rem" }),
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
