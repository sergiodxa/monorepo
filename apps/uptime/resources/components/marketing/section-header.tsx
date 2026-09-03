/**
 * Centered eyebrow badge + heading + lead paragraph at the top of a
 * marketing page section. Every marketing page/section repeats this same
 * three-part shape, centralized here for reuse. Its heading renders through
 * `@sdxc/ui`'s `Heading`, fixed at `level={2}` since every marketing page
 * nests its sections below its own `<h1>` hero.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { inlineFlex, items } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, maxWidth, mbe, p } from "@sdxc/u/size";
import { fontSize, leading, text, textAlign, tracking, weight } from "@sdxc/u/typography";
import { Heading } from "@sdxc/ui";

namespace SectionHeader {
	export interface Props {
		badge?: string;
		title: RemixNode;
		description?: RemixNode;
	}
}

/**
 * Renders an optional {@link SectionHeader.Props.badge}, an `<h2>` title
 * (through `Heading`), and an optional lead paragraph. The title's size is
 * set directly here, overriding `Heading`'s own fixed size for this section.
 */
export default function SectionHeader(handle: Handle<SectionHeader.Props>) {
	return () => (
		<div mix={[textAlign("center"), m(0, "auto", 10, "auto"), maxWidth("640px")]}>
			{handle.props.badge && (
				<span
					mix={[
						inlineFlex(),
						items("center"),
						p(0.5, 2.5),
						rounded("999px"),
						fontSize("xs"),
						weight(600),
						border({ color: "brand", width: 1 }),
						bg("brand.tint"),
						fg("brand"),
						mbe(4),
					]}
				>
					{handle.props.badge}
				</span>
			)}
			<Heading
				level={2}
				mix={[
					text("3xl"),
					tracking("tight"),
					m(0, 0, 4, 0),
					media("(min-width: 640px)", text("4xl")),
				]}
			>
				{handle.props.title}
			</Heading>
			{handle.props.description && (
				<p
					mix={[
						fontSize("lg"),
						leading(1.625),
						fg("neutral"),
						m(0, "auto", 6, "auto"),
						maxWidth("576px"),
					]}
				>
					{handle.props.description}
				</p>
			)}
		</div>
	);
}
