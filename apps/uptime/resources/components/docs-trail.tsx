/**
 * The trail above a documentation page's title: the docs root, the section and the page.
 * It wraps whole steps on a narrow screen, and a phone drops the page's own step, since
 * the title directly below names it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { hidden } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { Breadcrumbs } from "@sdxc/ui";

/** Widths at which the page's own step leaves the trail to the title below it. */
const PHONE = "(max-width: 29.9375rem)";

namespace DocsTrail {
	export interface Props {
		/** The trail's landmark name. */
		label: string;
		root: { label: string; href: string };
		/** The section the page is filed under, which has no page of its own to link to. */
		section?: string;
		page: string;
	}
}

/** Renders the docs root as a link, then the section and the page as plain steps. */
export default function DocsTrail(handle: Handle<DocsTrail.Props>) {
	return () => {
		let { label, page, root, section } = handle.props;

		return (
			<Breadcrumbs aria-label={label}>
				<Breadcrumbs.List mix={[raw({ flexWrap: "wrap", rowGap: "0.25rem" })]}>
					<Breadcrumbs.Item mix={[raw({ whiteSpace: "nowrap" })]}>
						<Breadcrumbs.Link href={root.href}>{root.label}</Breadcrumbs.Link>
					</Breadcrumbs.Item>
					{section ? (
						<Breadcrumbs.Item mix={[raw({ whiteSpace: "nowrap" })]}>
							<Breadcrumbs.Link mix={[raw({ textDecoration: "none" })]}>{section}</Breadcrumbs.Link>
						</Breadcrumbs.Item>
					) : null}
					<Breadcrumbs.Item mix={[media(PHONE, hidden())]}>
						<Breadcrumbs.Link aria-current="page">{page}</Breadcrumbs.Link>
					</Breadcrumbs.Item>
				</Breadcrumbs.List>
			</Breadcrumbs>
		);
	};
}
