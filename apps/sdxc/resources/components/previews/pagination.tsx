/**
 * Live preview island for `Pagination`. A pager is only legible once there are more pages
 * than fit, so the preview is a twelve-page result set: previous and next controls that
 * disable at the ends, page one and page twelve always present, the neighbours of the
 * current page, and an ellipsis standing in for each stretch the window leaves out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ChevronLeftIcon, ChevronRightIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Pagination } from "@sdxc/ui";
import { clientEntry, on } from "remix/ui";

import { pageWindow } from "~/app/services/page-window";

/** Pages the result set has, which is what decides where the ellipses fall. */
const TOTAL = 12;

/** The source the page shows, matching the markup below. */
const CODE = `let page = 4;

function goTo(next: number) {
	page = Math.min(TOTAL, Math.max(1, next));
	void handle.update();
}

<Pagination aria-label="Search results pages">
	<Pagination.List>
		<Pagination.Item>
			<Pagination.Button
				aria-label="Previous page"
				disabled={page === 1}
				mix={[on<HTMLButtonElement, "click">("click", () => goTo(page - 1))]}
			>
				<ChevronLeftIcon />
			</Pagination.Button>
		</Pagination.Item>

		{pageWindow(page, TOTAL).map((item) =>
			item.kind === "gap" ? (
				<Pagination.Item key={"gap-" + item.after}>
					<Pagination.Link aria-disabled="true">…</Pagination.Link>
				</Pagination.Item>
			) : (
				<Pagination.Item key={item.page}>
					<Pagination.Link
						href={"?page=" + item.page}
						aria-current={item.page === page ? "page" : undefined}
						mix={[
						on<HTMLAnchorElement, "click">("click", (event) => {
							event.preventDefault();
							goTo(item.page);
						}),
					]}
					>
						{item.page}
					</Pagination.Link>
				</Pagination.Item>
			),
		)}

		<Pagination.Item>
			<Pagination.Button
				aria-label="Next page"
				disabled={page === TOTAL}
				mix={[on<HTMLButtonElement, "click">("click", () => goTo(page + 1))]}
			>
				<ChevronRightIcon />
			</Pagination.Button>
		</Pagination.Item>
	</Pagination.List>
</Pagination>`;

/** A twelve-page pager, hydrated so the window and its ellipses move as pages change. */
export const PaginationPreview = clientEntry(
	"/resources/components/previews/pagination.tsx#PaginationPreview",
	function PaginationPreview(handle: Handle) {
		let page = 4;

		/** Moves to a page, clamped, so the ends stay reachable but never overshot. */
		function goTo(next: number) {
			page = Math.min(TOTAL, Math.max(1, next));
			void handle.update();
		}

		return () => (
			<div mix={[vstack({ gap: 3, align: "center" })]}>
				<Pagination aria-label="Search results pages">
					<Pagination.List>
						<Pagination.Item>
							<Pagination.Button
								aria-label="Previous page"
								disabled={page === 1}
								mix={[
									on<HTMLButtonElement, "click">("click", () => {
										goTo(page - 1);
									}),
								]}
							>
								<ChevronLeftIcon />
							</Pagination.Button>
						</Pagination.Item>

						{pageWindow(page, TOTAL).map((item) =>
							item.kind === "gap" ? (
								<Pagination.Item key={`gap-${item.after}`}>
									<Pagination.Link aria-disabled="true">…</Pagination.Link>
								</Pagination.Item>
							) : (
								<Pagination.Item key={item.page}>
									<Pagination.Link
										href={`?page=${item.page}`}
										aria-current={item.page === page ? "page" : undefined}
										mix={[
											on<HTMLAnchorElement, "click">("click", (event) => {
												event.preventDefault();
												goTo(item.page);
											}),
										]}
									>
										{item.page}
									</Pagination.Link>
								</Pagination.Item>
							),
						)}

						<Pagination.Item>
							<Pagination.Button
								aria-label="Next page"
								disabled={page === TOTAL}
								mix={[
									on<HTMLButtonElement, "click">("click", () => {
										goTo(page + 1);
									}),
								]}
							>
								<ChevronRightIcon />
							</Pagination.Button>
						</Pagination.Item>
					</Pagination.List>
				</Pagination>

				<p mix={[m(0), text("xs"), fg("neutral.muted")]}>
					{`Page ${page} of ${TOTAL} · 284 results`}
				</p>
			</div>
		);
	},
);

export default { code: CODE, render: () => <PaginationPreview /> };
