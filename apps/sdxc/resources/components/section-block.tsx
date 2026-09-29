/**
 * The `section-block` tag: one band of the landing page, optionally opened by a short
 * mono label and a display-size title. The `id` is the anchor the page is linked to by,
 * so it belongs in the content file beside the title it names rather than in a view a
 * reader of the copy never opens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m, maxIs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { balance, font, leading, text, textTransform, tracking } from "@sdxc/u/typography";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import Band from "~/resources/components/band";
import { blocksUseGap } from "~/resources/components/block-flow";
import { DisplayHeadings, ProseHeading } from "~/resources/components/prose";

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

		return (
			<Band id={id} tone={tone} align={align}>
				<DisplayHeadings>
					<div
						mix={[
							vstack({ gap: 10, align: align === "center" ? "center" : "stretch" }),
							blocksUseGap(),
						]}
					>
						{eyebrow || title ? (
							<header
								mix={[
									vstack({ gap: 4, align: align === "center" ? "center" : "start" }),
									maxIs("52rem"),
								]}
							>
								{eyebrow ? (
									<p
										mix={[
											m(0),
											font("mono"),
											text("xs"),
											textTransform("uppercase"),
											tracking("widest"),
											fg("brand"),
										]}
									>
										[ {eyebrow} ]
									</p>
								) : null}
								{title ? <ProseHeading level={2}>{title}</ProseHeading> : null}
							</header>
						) : null}

						{hasContent(children) ? (
							<div
								mix={[
									vstack({ gap: 6, align: align === "center" ? "center" : "stretch" }),
									blocksUseGap(),
									/* A centered band carries a statement, so its body is set to a measure one reads at a glance. */
									align === "center"
										? [
												maxIs("40rem"),
												text("lg"),
												leading("relaxed"),
												balance(),
												fg("neutral"),
												/* A row of buttons that wraps stays centered under the statement too. */
												when('& [data-slot="actions"]', raw({ justifyContent: "center" })),
											]
										: [],
								]}
							>
								{children}
							</div>
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
