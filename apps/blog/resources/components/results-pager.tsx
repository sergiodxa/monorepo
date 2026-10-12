/**
 * The numbered pager under a paged listing: previous and next links around every page number
 * worth showing, the current one marked for assistive technology. The `/search` results and
 * every topic page page their lists with it, so paging reads the same everywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { flexWrap } from "@sdxc/u/layout";
import { mbs } from "@sdxc/u/size";
import { Pagination } from "@sdxc/ui";

import type { SearchViewModel } from "~/app/http/view-models/search";

/** What the pager draws: the links, and the name the navigation landmark is announced by. */
interface ResultsPagerProps {
	pager: SearchViewModel.Pager;
	label: string;
}

/** Renders the pager; a gap renders as a disabled ellipsis between page numbers. */
export function ResultsPager(handle: Handle<ResultsPagerProps>) {
	return () => {
		let { pager, label } = handle.props;

		return (
			<Pagination aria-label={label} mix={[mbs(4)]}>
				<Pagination.List mix={[flexWrap("wrap")]}>
					{pager.prev ? (
						<Pagination.Item>
							<Pagination.Link href={pager.prev} rel="prev">
								Previous
							</Pagination.Link>
						</Pagination.Item>
					) : null}
					{pager.items.map((item, index) =>
						item.type === "gap" ? (
							<Pagination.Item key={`gap-${index}`}>
								<Pagination.Link aria-disabled="true">…</Pagination.Link>
							</Pagination.Item>
						) : (
							<Pagination.Item key={`page-${item.page}`}>
								<Pagination.Link
									href={item.href}
									aria-current={item.current ? "page" : undefined}
									aria-label={`Page ${item.page}`}
								>
									{item.page}
								</Pagination.Link>
							</Pagination.Item>
						),
					)}
					{pager.next ? (
						<Pagination.Item>
							<Pagination.Link href={pager.next} rel="next">
								Next
							</Pagination.Link>
						</Pagination.Item>
					) : null}
				</Pagination.List>
			</Pagination>
		);
	};
}
