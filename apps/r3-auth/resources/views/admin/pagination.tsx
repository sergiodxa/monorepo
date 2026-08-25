/**
 * The page control both admin listings share. Every destination is a plain link the
 * server already resolved, and the current page is the `aria-current` attribute — so
 * paging works with the browser's own navigation and needs no script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { justify } from "@pkg/u/layout";
import { mbs } from "@pkg/u/size";
import { Pagination } from "@pkg/ui";

import type { AdminView } from "~/app/http/view-models/admin";

namespace ListPagination {
	export interface Props {
		pagination: AdminView.Pagination;
	}
}

/**
 * Renders the page links, or nothing when there is only one page.
 *
 * Previous and next render as inert, non-navigating links at the ends of the range,
 * keeping the control's shape stable as the page count changes.
 */
export default function ListPagination(handle: Handle<ListPagination.Props>) {
	return () => {
		let { pagination } = handle.props;
		if (!pagination.visible) return null;

		return (
			<Pagination aria-label={pagination.label} mix={[mbs(4), justify("center")]}>
				<Pagination.List>
					<Pagination.Item>
						{pagination.previous.href ? (
							<Pagination.Link href={pagination.previous.href}>
								{pagination.previous.label}
							</Pagination.Link>
						) : (
							<Pagination.Link aria-disabled="true">{pagination.previous.label}</Pagination.Link>
						)}
					</Pagination.Item>

					{pagination.pages.map((page) => (
						<Pagination.Item key={page.number}>
							<Pagination.Link href={page.href} aria-current={page.current ? "page" : undefined}>
								{String(page.number)}
							</Pagination.Link>
						</Pagination.Item>
					))}

					<Pagination.Item>
						{pagination.next.href ? (
							<Pagination.Link href={pagination.next.href}>{pagination.next.label}</Pagination.Link>
						) : (
							<Pagination.Link aria-disabled="true">{pagination.next.label}</Pagination.Link>
						)}
					</Pagination.Item>
				</Pagination.List>
			</Pagination>
		);
	};
}
