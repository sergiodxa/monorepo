/**
 * Centered eyebrow badge + heading + lead paragraph at the top of a marketing page
 * section. Every marketing page/section repeats this same three-part shape, so it's
 * centralized here instead of composing it by hand at each call site. Its heading
 * renders through `@pkg/r3-ui`'s `Heading` (fixed at `level={2}` — every marketing
 * page nests its sections below its own `<h1>` hero) instead of a bare `<h2>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Heading } from "@pkg/r3-ui";
import { css } from "remix/ui";

namespace SectionHeader {
	export interface Props {
		badge?: string;
		title: RemixNode;
		description?: RemixNode;
	}
}

/** Centered wrapper capping the badge/heading/lead paragraph at 640px wide. */
const marketingSectionHeader = css({
	textAlign: "center",
	maxWidth: 640,
	margin: "0 auto 40px",
});

/**
 * The section's own heading size: bold, 30px by default and 36px at ≥640px,
 * with tight `-0.025em` tracking throughout — layered on top of `Heading`'s
 * own fixed emphasis size, which this section wants larger.
 */
const marketingSectionTitle = css({
	fontSize: "1.875rem",
	lineHeight: "2.25rem",
	letterSpacing: "-0.025em",
	margin: "0 0 16px",
	"@media (min-width: 640px)": { fontSize: "2.25rem", lineHeight: "2.5rem" },
});

/**
 * Small pill badge used above hero/section headings: a brand-tinted outline
 * chip, padding `2px 10px`.
 */
const marketingBadge = css({
	display: "inline-flex",
	alignItems: "center",
	padding: "2px 10px",
	borderRadius: 999,
	fontSize: "0.75rem",
	fontWeight: 600,
	border: "1px solid var(--ui-primary-border)",
	background: "var(--ui-primary-bg-tint)",
	color: "var(--ui-primary-fg)",
	marginBottom: 16,
});

/**
 * Hero/section supporting paragraph: 18px, muted color, `1.625` line-height,
 * capped at 576px wide.
 */
const marketingLead = css({
	fontSize: "1.125rem",
	color: "var(--ui-neutral-fg)",
	margin: "0 auto 24px",
	maxWidth: 576,
	lineHeight: 1.625,
});

/** Renders an optional {@link SectionHeader.Props.badge}, an `<h2>` title (through `Heading`), and an optional lead paragraph. */
export default function SectionHeader(handle: Handle<SectionHeader.Props>) {
	return () => (
		<div mix={[marketingSectionHeader]}>
			{handle.props.badge && <span mix={[marketingBadge]}>{handle.props.badge}</span>}
			<Heading level={2} mix={[marketingSectionTitle]}>
				{handle.props.title}
			</Heading>
			{handle.props.description && <p mix={[marketingLead]}>{handle.props.description}</p>}
		</div>
	);
}
