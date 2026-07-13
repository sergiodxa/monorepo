/**
 * Centered eyebrow badge + heading + lead paragraph at the top of a marketing page
 * section. Every marketing page/section repeats this same three-part shape, so it's
 * centralized here instead of composing it by hand at each call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

namespace SectionHeader {
	export interface Props {
		badge?: string;
		title: RemixNode;
		description?: RemixNode;
	}
}

/**
 * Centered heading block at the top of a marketing section. Styles its bare
 * `<h2>` directly (rather than requiring a separate heading mixin at each call
 * site): bold, 30px by default and 36px at ≥640px, with tight `-0.025em`
 * tracking throughout.
 */
const marketingSectionHeader = css({
	textAlign: "center",
	maxWidth: 640,
	margin: "0 auto 40px",
	"& h2": {
		fontSize: "1.875rem",
		fontWeight: 700,
		lineHeight: "2.25rem",
		letterSpacing: "-0.025em",
		margin: "0 0 16px",
		color: "oklch(0.24 0.005 145)",
	},
	"@media (min-width: 640px)": {
		"& h2": { fontSize: "2.25rem", lineHeight: "2.5rem" },
	},
	"@media (prefers-color-scheme: dark)": {
		"& h2": { color: "oklch(0.98 0.005 145)" },
	},
});

/**
 * Small pill badge used above hero/section headings: a brand-green outline
 * chip, padding `2px 10px`.
 */
const marketingBadge = css({
	display: "inline-flex",
	alignItems: "center",
	padding: "2px 10px",
	borderRadius: 999,
	fontSize: "0.75rem",
	fontWeight: 600,
	border: "1px solid oklch(0.92 0.08 142)",
	background: "oklch(0.98 0.02 142)",
	color: "oklch(0.6 0.16 142)",
	marginBottom: 16,
	"@media (prefers-color-scheme: dark)": {
		borderColor: "oklch(0.42 0.12 142)",
		background: "oklch(0.24 0.06 142)",
		color: "oklch(0.78 0.16 142)",
	},
});

/**
 * Hero/section supporting paragraph: 18px, muted color, `1.625` line-height,
 * capped at 576px wide.
 */
const marketingLead = css({
	fontSize: "1.125rem",
	color: "oklch(0.52 0.01 145)",
	margin: "0 auto 24px",
	maxWidth: 576,
	lineHeight: 1.625,
	"@media (prefers-color-scheme: dark)": { color: "oklch(0.73 0.01 145)" },
});

/** Renders an optional {@link SectionHeader.Props.badge}, an `<h2>` title, and an optional lead paragraph. */
export default function SectionHeader(handle: Handle<SectionHeader.Props>) {
	return () => (
		<div mix={[marketingSectionHeader]}>
			{handle.props.badge && <span mix={[marketingBadge]}>{handle.props.badge}</span>}
			<h2>{handle.props.title}</h2>
			{handle.props.description && <p mix={[marketingLead]}>{handle.props.description}</p>}
		</div>
	);
}
