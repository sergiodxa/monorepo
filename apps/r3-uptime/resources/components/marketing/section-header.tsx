/**
 * Centered eyebrow badge + heading + lead paragraph at the top of a marketing page
 * section. Every marketing page/section repeats this same three-part shape, so it's
 * centralized here instead of composing {@link s.marketingSectionHeader} by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import * as s from "~/resources/styles";

namespace SectionHeader {
	export interface Props {
		badge?: string;
		title: RemixNode;
		description?: RemixNode;
	}
}

/** Renders an optional {@link SectionHeader.Props.badge}, an `<h2>` title, and an optional lead paragraph. */
export default function SectionHeader(handle: Handle<SectionHeader.Props>) {
	return () => (
		<div mix={[s.marketingSectionHeader]}>
			{handle.props.badge && <span mix={[s.marketingBadge]}>{handle.props.badge}</span>}
			<h2>{handle.props.title}</h2>
			{handle.props.description && <p mix={[s.marketingLead]}>{handle.props.description}</p>}
		</div>
	);
}
