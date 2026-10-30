/**
 * The `section-block` tag: one band of the landing page, optionally opened by a short
 * mono label and a display-size title. Built on {@link MarketingSection} (via Band) and
 * {@link MarketingHeader} so section chrome shares the marketing vocabulary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m, maxIs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { balance, font, text, textTransform, tracking } from "@sdxc/u/typography";
import { HeadingScope, MarketingHeader } from "@sdxc/ui";
import { marketingLead } from "@sdxc/ui/styles";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import Band from "~/resources/components/band";
import { blocksUseGap } from "~/resources/components/block-flow";
import { DisplayHeadings } from "~/resources/components/prose";

namespace SectionBlock {
	export interface Props extends MarkdownProps {
		id: string;
		/** The band's heading; a band laid out as a split writes its heading in the copy instead. */
		title?: string;
		/** The short label set above the title, naming what kind of section this is. */
		eyebrow?: string;
		tone?: "plain" | "tinted" | "grid";
		align?: "start" | "center";
	}
}

/** Renders one band. */
export default function SectionBlock(handle: Handle<SectionBlock.Props>) {
	return () => {
		let { align = "start", children, eyebrow, id, title, tone = "plain" } = handle.props;
		let hasHeader = Boolean(eyebrow || title);
		let header: RemixNode = null;

		if (title) {
			header = (
				<HeadingScope level={2}>
					<MarketingHeader
						eyebrow={eyebrow ? `[ ${eyebrow} ]` : undefined}
						eyebrowVariant="mono"
						align={align}
						mix={[maxIs("52rem")]}
						parts={{
							eyebrow: [raw({ "--ui-marketing-eyebrow-color": "var(--ui-brand-fg)" })],
						}}
					>
						{title}
					</MarketingHeader>
				</HeadingScope>
			);
		} else if (eyebrow) {
			header = (
				<p
					mix={[
						m(0),
						font("mono"),
						text("xs"),
						textTransform("uppercase"),
						tracking("widest"),
						fg("brand"),
						maxIs("52rem"),
					]}
				>
					[ {eyebrow} ]
				</p>
			);
		}

		return (
			<Band id={id} tone={tone} align={align}>
				<DisplayHeadings>
					<div
						mix={[
							vstack({
								gap: hasHeader ? 0 : 10,
								align: align === "center" ? "center" : "stretch",
							}),
							blocksUseGap(),
						]}
					>
						{header}

						{hasContent(children) ? (
							<HeadingScope level={title ? 3 : 2}>
								<div
									mix={[
										vstack({ gap: 6, align: align === "center" ? "center" : "stretch" }),
										blocksUseGap(),

										align === "center"
											? [
													marketingLead(),
													balance(),

													when('& [data-slot="actions"]', raw({ justifyContent: "center" })),
													when('& [data-slot="cta-group"]', raw({ justifyContent: "center" })),
												]
											: [],
									]}
								>
									{children}
								</div>
							</HeadingScope>
						) : null}
					</div>
				</DisplayHeadings>
			</Band>
		);
	};
}

/**
 * Whether the band holds anything beyond its heading. A band that is only a statement
 * draws no empty body under it, which is what keeps the statement centered in the band.
 */
function hasContent(children: RemixNode): boolean {
	if (Array.isArray(children)) return children.some(hasContent);
	return children !== null && children !== undefined && children !== false && children !== "";
}
