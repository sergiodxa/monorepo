/**
 * Mid-page feature band: a {@link MarketingHeader} plus a {@link Split}, a
 * {@link Feature.Grid}, a numbered or timeline {@link StepList}, or a vertical
 * {@link TabbedStage}, selected by `layout`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";

import { Feature } from "../components/feature.js";
import { HeadingScope } from "../components/heading-scope.js";
import { MarketingHeader } from "../components/marketing-header.js";
import { MarketingSection } from "../components/marketing-section.js";
import { Split } from "../components/split.js";

import { StepList } from "./step-list.js";
import { TabbedStage } from "./tabbed-stage.js";

/** Layout {@link FeatureBand} applies when `layout` is omitted. */
const DEFAULT_LAYOUT: FeatureBand.Layout = "split";

/** Radio group name a `stage` band uses when it has neither `stageName` nor `id`. */
const DEFAULT_STAGE_NAME = "feature-band-stage";

/** Band fill {@link FeatureBand} applies when `tone` is omitted. */
const DEFAULT_TONE: FeatureBand.Tone = "plain";

/**
 * Prop types for {@link FeatureBand}.
 */
export namespace FeatureBand {
	/**
	 * How the band body lays out under the header.
	 */
	export type Layout = "split" | "grid" | "steps" | "stage" | "timeline";

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
		/** Turns the eyebrow into a link to this URL, forwarded to {@link MarketingHeader}. */
		eyebrowHref?: string;
		/** Index a `numbered` eyebrow leads with, such as `"02"`. */
		eyebrowIndex?: RemixNode;
		/** Section title — required, always supplied by the page. */
		title: RemixNode;
		/** Supporting lead under the title. */
		description?: RemixNode;
		/**
		 * Media for `layout="split"`. Every other layout carries its media in its items.
		 */
		media?: RemixNode;
		/** Which column is wider when `layout="split"`. */
		lean?: Split.Lean;
		/** Grid column count when `layout="grid"`. */
		columns?: Feature.Columns;
		/**
		 * Radio group name for `layout="stage"`. Defaults to `"<id>-stage"` when the band
		 * has an `id`, else {@link DEFAULT_STAGE_NAME}; give every stage band on a page
		 * its own `id` or `stageName` so their selections stay independent.
		 */
		stageName?: string;
		/**
		 * Accessible name for the stage when `layout="stage"`. Defaults to the title when
		 * the title is a string; pass it whenever the title is markup.
		 */
		stageLabel?: string;
		/**
		 * Body content: claim list / copy for `"split"`, {@link Feature} cells
		 * for `"grid"`, {@link StepList.Item} children for `"steps"` and `"timeline"`,
		 * or {@link TabbedStage.Item} children for `"stage"`.
		 */
		children?: RemixNode;
		/** Per-part styling for title, lead, and media. */
		parts?: PartsProps;
	}
}

/**
 * Renders a feature band with a chapter header and a split, grid, steps, timeline,
 * or stage body. A split with media carries its header in the copy column, so copy and
 * media share one grid; cell and step titles sit one heading level under the band title.
 *
 * @param handle Runtime handle carrying the band's props.
 * @returns The render function producing the band's markup.
 * @example
 * <FeatureBand layout="split" title={t("f1.title")} description={t("f1.lead")} media={shot}>
 * 	<ul><li>{t("f1.claim")}</li></ul>
 * </FeatureBand>
 * @example
 * <FeatureBand layout="stage" id="how" title={t("how.title")}>
 * 	<TabbedStage.Item value="detect" label={t("how.detect")} defaultChecked>{shot}</TabbedStage.Item>
 * </FeatureBand>
 * @example
 * <FeatureBand layout="timeline" title={t("incident.title")}>
 * 	<StepList.Item meta="14:02 UTC" title={t("incident.detect")}>{t("incident.body")}</StepList.Item>
 * </FeatureBand>
 */
export function FeatureBand(handle: Handle<FeatureBand.Props>) {
	return () => {
		let {
			children,
			columns,
			description,
			eyebrow,
			eyebrowHref,
			eyebrowIndex,
			eyebrowVariant,
			id,
			layout,
			lean,
			media,
			mix,
			parts,
			ruled,
			spacing,
			stageLabel,
			stageName,
			title,
			tone,
			...rest
		} = handle.props;
		let resolvedLayout = layout ?? DEFAULT_LAYOUT;
		let resolvedTone = tone ?? DEFAULT_TONE;
		let resolvedSpacing = spacing ?? "normal";

		let body = <div mix={[vstack({ gap: 4, align: "stretch" })]}>{children}</div>;
		let isSplit = resolvedLayout === "split" && media !== undefined;
		let isSelfScoped =
			resolvedLayout === "grid" || resolvedLayout === "steps" || resolvedLayout === "timeline";

		if (resolvedLayout === "grid") {
			body = <Feature.Grid columns={columns}>{children}</Feature.Grid>;
		} else if (resolvedLayout === "steps") {
			body = <StepList>{children}</StepList>;
		} else if (resolvedLayout === "timeline") {
			body = <StepList variant="timeline">{children}</StepList>;
		} else if (resolvedLayout === "stage") {
			body = (
				<TabbedStage
					name={stageName ?? (id ? `${id}-stage` : DEFAULT_STAGE_NAME)}
					orientation="vertical"
					aria-label={stageLabel ?? (typeof title === "string" ? title : "")}
				>
					{children}
				</TabbedStage>
			);
		}

		let header = (
			<MarketingHeader
				eyebrow={eyebrow}
				eyebrowHref={eyebrowHref}
				eyebrowIndex={eyebrowIndex}
				eyebrowVariant={eyebrowVariant}
				description={description}
				mix={isSplit ? [raw({ "--ui-marketing-header-end": "0" })] : []}
				parts={{
					title: parts?.title,
					description: parts?.description,
				}}
			>
				{title}
			</MarketingHeader>
		);

		if (isSplit) {
			return (
				<MarketingSection
					{...rest}
					id={id}
					tone={resolvedTone}
					spacing={resolvedSpacing}
					ruled={ruled}
					mix={mix}
				>
					<Split lean={lean}>
						<Split.Copy checks={Boolean(children)}>
							{header}
							<HeadingScope>{children}</HeadingScope>
						</Split.Copy>
						<Split.Media mix={[parts?.media]}>
							<HeadingScope>{media}</HeadingScope>
						</Split.Media>
					</Split>
				</MarketingSection>
			);
		}

		return (
			<MarketingSection
				{...rest}
				id={id}
				tone={resolvedTone}
				spacing={resolvedSpacing}
				ruled={ruled}
				mix={mix}
			>
				<div mix={[vstack({ gap: 0, align: "stretch" })]}>
					{header}
					{isSelfScoped ? body : <HeadingScope>{body}</HeadingScope>}
				</div>
			</MarketingSection>
		);
	};
}
