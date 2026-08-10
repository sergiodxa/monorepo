/**
 * Centered eyebrow badge + heading + lead paragraph at the top of a marketing page
 * section. Every marketing page/section repeats this same three-part shape, so it's
 * centralized here instead of composing it by hand at each call site. Its heading
 * renders through `@pkg/ui`'s `Heading` (fixed at `level={2}` — every marketing
 * page nests its sections below its own `<h1>` hero) instead of a bare `<h2>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { inlineFlex, items } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { m, maxWidth, mbe, p } from "@pkg/u/size";
import { fontSize, leading, text, textAlign, tracking, weight } from "@pkg/u/typography";
import { Heading } from "@pkg/ui";

namespace SectionHeader {
	export interface Props {
		badge?: string;
		title: RemixNode;
		description?: RemixNode;
	}
}

/** Renders an optional {@link SectionHeader.Props.badge}, an `<h2>` title (through `Heading`), and an optional lead paragraph. */
export default function SectionHeader(handle: Handle<SectionHeader.Props>) {
	return () => (
		<div
			// Centered wrapper capping the badge/heading/lead paragraph at 640px wide.
			mix={[textAlign("center"), m(0, "auto", 10, "auto"), maxWidth("640px")]}
		>
			{handle.props.badge && (
				// Small pill badge above hero/section headings: a brand-tinted outline chip.
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
				// The section's own heading size: bold, 30px by default and 36px at ≥640px,
				// with tight `-0.025em` tracking throughout — layered on top of `Heading`'s
				// own fixed emphasis size, which this section wants larger.
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
				// Hero/section supporting paragraph: 18px, muted color, `1.625` line-height,
				// capped at 576px wide.
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
