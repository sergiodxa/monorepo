/**
 * Closing call-to-action band: inverse or tinted section with a title, lead,
 * and action cluster. Encodes the catalog closing pattern.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { vstack } from "@sdxc/u/layout";

import { CtaGroup } from "../components/cta-group.js";
import { HeadingScope } from "../components/heading-scope.js";
import { MarketingHeader } from "../components/marketing-header.js";
import { MarketingSection } from "../components/marketing-section.js";

/** Band fill {@link ClosingCta} applies when `tone` is omitted. */
const DEFAULT_TONE: ClosingCta.Tone = "inverse";

/**
 * Prop types for {@link ClosingCta}.
 */
export namespace ClosingCta {
	/**
	 * Band fill forwarded to {@link MarketingSection}. Prefer `"inverse"` or
	 * `"tinted"` so the close reads as a distinct final statement.
	 */
	export type Tone = MarketingSection.Tone;

	/**
	 * Per-part styling for slots the band composes.
	 */
	export interface PartsProps {
		/** Styling for the title. */
		title?: TagProps<"h1">["mix"];
		/** Styling for the lead. */
		description?: TagProps<"p">["mix"];
		/** Styling for the {@link CtaGroup}. */
		actions?: TagProps<"div">["mix"];
	}

	/**
	 * Props accepted by {@link ClosingCta}.
	 */
	export interface Props extends Omit<
		MarketingSection.Props,
		"children" | "tone" | "align" | "title" | "parts"
	> {
		/** Band fill. Defaults to {@link DEFAULT_TONE}. */
		tone?: Tone;
		/** Optional eyebrow above the title. */
		eyebrow?: RemixNode;
		/** Closing title — required, always supplied by the page. */
		title: RemixNode;
		/** Supporting lead under the title. */
		description?: RemixNode;
		/** Primary/secondary actions rendered inside a {@link CtaGroup}. */
		actions?: RemixNode;
		/** Per-part styling for title, lead, and actions. */
		parts?: PartsProps;
	}
}

/**
 * Renders a centered closing band with chapter title, optional lead, and CTAs.
 *
 * @param handle Runtime handle carrying the band's props.
 * @returns The render function producing the band's markup.
 * @example
 * <ClosingCta
 * 	title={t("close.title")}
 * 	description={t("close.lead")}
 * 	actions={<Button size="lg">{t("close.cta")}</Button>}
 * />
 */
export function ClosingCta(handle: Handle<ClosingCta.Props>) {
	return () => {
		let { actions, description, eyebrow, mix, parts, spacing, title, tone, ...rest } = handle.props;
		let resolvedTone = tone ?? DEFAULT_TONE;
		let resolvedSpacing = spacing ?? "normal";

		return (
			<MarketingSection
				{...rest}
				tone={resolvedTone}
				spacing={resolvedSpacing}
				align="center"
				mix={mix}
			>
				<HeadingScope>
					<div mix={[vstack({ gap: 6, align: "center" })]}>
						<MarketingHeader
							eyebrow={eyebrow}
							description={description}
							align="center"
							parts={{
								title: parts?.title,
								description: parts?.description,
							}}
						>
							{title}
						</MarketingHeader>
						{actions ? <CtaGroup mix={[parts?.actions]}>{actions}</CtaGroup> : null}
					</div>
				</HeadingScope>
			</MarketingSection>
		);
	};
}
