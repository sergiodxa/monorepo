/**
 * Mid-page feature band: a {@link MarketingHeader} plus either a {@link Split},
 * a {@link Feature.Grid}, or a {@link StepList}, selected by `layout`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { vstack } from "@sdxc/u/layout";

import { Feature } from "../components/feature.js";
import { HeadingScope } from "../components/heading-scope.js";
import { MarketingHeader } from "../components/marketing-header.js";
import { MarketingSection } from "../components/marketing-section.js";
import { Split } from "../components/split.js";

import { StepList } from "./step-list.js";

/** Layout {@link FeatureBand} applies when `layout` is omitted. */
const DEFAULT_LAYOUT: FeatureBand.Layout = "split";

/** Band fill {@link FeatureBand} applies when `tone` is omitted. */
const DEFAULT_TONE: FeatureBand.Tone = "plain";

/**
 * Prop types for {@link FeatureBand}.
 */
export namespace FeatureBand {
	/**
	 * How the band body lays out under the header.
	 */
	export type Layout = "split" | "grid" | "steps";

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
		/** Styling for the media column when `layout="split"`. */
		media?: TagProps<"div">["mix"];
	}

	/**
	 * Props accepted by {@link FeatureBand}.
	 */
	export interface Props extends Omit<
		MarketingSection.Props,
		"children" | "tone" | "title" | "parts"
	> {
		/** Body layout. Defaults to {@link DEFAULT_LAYOUT}. */
		layout?: Layout;
		/** Band fill. Defaults to {@link DEFAULT_TONE}. */
		tone?: Tone;
		/** Optional eyebrow above the title. */
		eyebrow?: RemixNode;
		/** Eyebrow chrome forwarded to {@link MarketingHeader}. */
		eyebrowVariant?: MarketingHeader.EyebrowVariant;
		/** Section title — required, always supplied by the page. */
		title: RemixNode;
		/** Supporting lead under the title. */
		description?: RemixNode;
		/**
		 * Media for `layout="split"`. Ignored for `"grid"` and `"steps"`.
		 */
		media?: RemixNode;
		/** Which column is wider when `layout="split"`. */
		lean?: Split.Lean;
		/** Grid column count when `layout="grid"`. */
		columns?: Feature.Columns;
		/**
		 * Body content: claim list / copy for `"split"`, {@link Feature} cells
		 * for `"grid"`, or {@link StepList.Item} children for `"steps"`.
		 */
		children?: RemixNode;
		/** Per-part styling for title, lead, and media. */
		parts?: PartsProps;
	}
}

/**
 * Renders a feature band with a chapter header and a split, grid, or steps
 * body. Opens a nested {@link HeadingScope} so cell titles sit under the
 * section heading.
 *
 * @param handle Runtime handle carrying the band's props.
 * @returns The render function producing the band's markup.
 * @example
 * <FeatureBand layout="split" title={t("f1.title")} description={t("f1.lead")} media={shot}>
 * 	<ul><li>{t("f1.claim")}</li></ul>
 * </FeatureBand>
 * @example
 * <FeatureBand layout="grid" title={t("grid.title")} columns={3}>
 * 	<Feature>...</Feature>
 * </FeatureBand>
 */
export function FeatureBand(handle: Handle<FeatureBand.Props>) {
	return () => {
		let {
			children,
			columns,
			description,
			eyebrow,
			eyebrowVariant,
			layout,
			lean,
			media,
			mix,
			parts,
			ruled,
			spacing,
			title,
			tone,
			...rest
		} = handle.props;
		let resolvedLayout = layout ?? DEFAULT_LAYOUT;
		let resolvedTone = tone ?? DEFAULT_TONE;
		let resolvedSpacing = spacing ?? "normal";

		let body = <div mix={[vstack({ gap: 4, align: "stretch" })]}>{children}</div>;

		if (resolvedLayout === "grid") {
			body = <Feature.Grid columns={columns}>{children}</Feature.Grid>;
		} else if (resolvedLayout === "steps") {
			body = <StepList>{children}</StepList>;
		} else if (media !== undefined) {
			body = (
				<Split lean={lean}>
					<Split.Copy checks={Boolean(children)}>{children}</Split.Copy>
					<Split.Media mix={[parts?.media]}>{media}</Split.Media>
				</Split>
			);
		}

		return (
			<MarketingSection
				{...rest}
				tone={resolvedTone}
				spacing={resolvedSpacing}
				ruled={ruled}
				mix={mix}
			>
				<HeadingScope>
					<div mix={[vstack({ gap: 0, align: "stretch" })]}>
						<MarketingHeader
							eyebrow={eyebrow}
							eyebrowVariant={eyebrowVariant}
							description={description}
							parts={{
								title: parts?.title,
								description: parts?.description,
							}}
						>
							{title}
						</MarketingHeader>
						<HeadingScope>{body}</HeadingScope>
					</div>
				</HeadingScope>
			</MarketingSection>
		);
	};
}
