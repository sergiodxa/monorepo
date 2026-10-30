/**
 * FAQ band: a {@link MarketingHeader} over one or two {@link Accordion}
 * columns. The page supplies every question and answer as accordion children.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { container, gap, grid, gridTemplate, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";

import { MarketingHeader } from "../components/marketing-header.js";
import { MarketingSection } from "../components/marketing-section.js";

/** How many accordion columns {@link FaqBand} uses when `columns` is omitted. */
const DEFAULT_COLUMNS: FaqBand.Columns = 1;

/** Band fill {@link FaqBand} applies when `tone` is omitted. */
const DEFAULT_TONE: FaqBand.Tone = "plain";

/**
 * Prop types for {@link FaqBand}.
 */
export namespace FaqBand {
	/**
	 * How many accordion columns to lay out above the stack breakpoint.
	 */
	export type Columns = 1 | 2;

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
		/** Styling for the accordion column grid. */
		columns?: TagProps<"div">["mix"];
	}

	/**
	 * Props accepted by {@link FaqBand}.
	 */
	export interface Props extends Omit<
		MarketingSection.Props,
		"children" | "tone" | "title" | "parts"
	> {
		/** Column count. Defaults to {@link DEFAULT_COLUMNS}. */
		columns?: Columns;
		/** Band fill. Defaults to {@link DEFAULT_TONE}. */
		tone?: Tone;
		/** Optional eyebrow above the title. */
		eyebrow?: RemixNode;
		/** Section title — required, always supplied by the page. */
		title: RemixNode;
		/** Supporting lead under the title. */
		description?: RemixNode;
		/**
		 * Accordion column(s). Pass one {@link Accordion} for a single column,
		 * or two for a split FAQ — the band lays them in a responsive grid.
		 */
		children: RemixNode;
		/** Per-part styling for title, lead, and columns. */
		parts?: PartsProps;
	}
}

/**
 * Renders a FAQ band with a chapter header and one or two accordion columns.
 * The column host is the named sizing container; an inner wrapper holds the
 * `@container` tracks so the query can restyle a descendant.
 *
 * @param handle Runtime handle carrying the band's props.
 * @returns The render function producing the band's markup.
 * @example
 * <FaqBand title={t("faq.title")} columns={2}>
 * 	<Accordion>{leftItems}</Accordion>
 * 	<Accordion>{rightItems}</Accordion>
 * </FaqBand>
 */
export function FaqBand(handle: Handle<FaqBand.Props>) {
	return () => {
		let {
			children,
			columns,
			description,
			eyebrow,
			mix,
			parts,
			ruled,
			spacing,
			title,
			tone,
			...rest
		} = handle.props;
		let resolvedColumns = columns ?? DEFAULT_COLUMNS;
		let resolvedTone = tone ?? DEFAULT_TONE;
		let resolvedSpacing = spacing ?? "normal";
		let isTwo = resolvedColumns === 2;

		return (
			<MarketingSection
				{...rest}
				tone={resolvedTone}
				spacing={resolvedSpacing}
				ruled={ruled}
				mix={mix}
			>
				<div mix={[vstack({ gap: 0, align: "stretch" })]}>
					<MarketingHeader
						eyebrow={eyebrow}
						description={description}
						parts={{
							title: parts?.title,
							description: parts?.description,
						}}
					>
						{title}
					</MarketingHeader>
					<div
						data-columns={String(resolvedColumns)}
						mix={[container("ui-marketing-faq"), parts?.columns]}
					>
						<div
							mix={[
								grid(),
								gap(0, 8),
								gridTemplate({ columns: "minmax(0, 1fr)" }),
								isTwo
									? at(
											"xl",
											"ui-marketing-faq",
											gridTemplate({ columns: "minmax(0, 1fr) minmax(0, 1fr)" }),
										)
									: [],
							]}
						>
							{children}
						</div>
					</div>
				</div>
			</MarketingSection>
		);
	};
}
