/**
 * Live example island for `SharedElement` on a book's own page. The cover carries the
 * same `id` as the one in the shelf list, and the island swaps the two views inside
 * `document.startViewTransition()`, so the cover morphs between its row and the header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { hstack, vstack } from "@sdxc/u/layout";
import { bs, is, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Button, SharedElement, Text } from "@sdxc/ui";
import { clientEntry, css, on } from "remix/component";

/** The book whose page the example opens on. */
const BOOK = {
	slug: "standards",
	title: "Built on Standards",
	author: "Ana Torres",
};

/** The source the page shows, matching the markup below. */
const CODE = `let onBookPage = true;

function go(toBookPage: boolean) {
	onBookPage = toBookPage;
	if (typeof document.startViewTransition !== "function") return void handle.update();
	document.startViewTransition(() => handle.update());
}

onBookPage ? (
	<div mix={[vstack({ gap: 3, align: "stretch" }), is("22rem")]}>
		<SharedElement
			id={\`cover-\${book.slug}\`}
			mix={[
				is("8rem"),
				bs("11rem"),
				rounded("lg"),
				bg("brand.tint"),
				fg("brand"),
				p(3),
				weight("semibold"),
				css({ display: "grid", placeItems: "center", textAlign: "center" }),
			]}
		>
			{book.title}
		</SharedElement>
		<Text>{book.title}, by {book.author}</Text>
		<div mix={[hstack({ gap: 2, align: "center" })]}>
			<Button variant="outline" size="sm" mix={[on<HTMLButtonElement, "click">("click", () => go(false))]}>
				Back to the shelf
			</Button>
		</div>
	</div>
) : (
	<div mix={[vstack({ gap: 3, align: "stretch" }), is("22rem")]}>
		<Button
			variant="ghost"
			mix={[hstack({ gap: 3, align: "center" }), on<HTMLButtonElement, "click">("click", () => go(true))]}
		>
			<SharedElement
				id={\`cover-\${book.slug}\`}
				mix={[
					is("2rem"),
					bs("2.75rem"),
					rounded("sm"),
					bg("brand.tint"),
					fg("brand"),
					text("xs"),
					css({ display: "grid", placeItems: "center" }),
				]}
			>
				B
			</SharedElement>
			{book.title}
		</Button>
	</div>
)`;

/** A book page whose cover morphs into its shelf row and back, hydrated so it runs. */
export const BookPage = clientEntry(import.meta.url, function BookPage(handle: Handle) {
	let onBookPage = true;

	/** Swaps the two views inside a transition, so the shared id has something to morph. */
	function go(toBookPage: boolean) {
		onBookPage = toBookPage;
		if (typeof document.startViewTransition !== "function") return void handle.update();
		document.startViewTransition(() => handle.update());
	}

	return () => {
		let id = `example-shared-element-book-page-cover-${BOOK.slug}`;

		if (onBookPage) {
			return (
				<div mix={[vstack({ gap: 3, align: "stretch" }), is("22rem")]}>
					<SharedElement
						id={id}
						mix={[
							is("8rem"),
							bs("11rem"),
							rounded("lg"),
							bg("brand.tint"),
							fg("brand"),
							p(3),
							weight("semibold"),
							css({ display: "grid", placeItems: "center", textAlign: "center" }),
						]}
					>
						{BOOK.title}
					</SharedElement>
					<Text>
						{BOOK.title}, by {BOOK.author}
					</Text>
					<div mix={[hstack({ gap: 2, align: "center" })]}>
						<Button
							variant="outline"
							size="sm"
							mix={[on<HTMLButtonElement, "click">("click", () => go(false))]}
						>
							Back to the shelf
						</Button>
					</div>
				</div>
			);
		}

		return (
			<div mix={[vstack({ gap: 3, align: "stretch" }), is("22rem")]}>
				<Button
					variant="ghost"
					mix={[
						hstack({ gap: 3, align: "center" }),
						on<HTMLButtonElement, "click">("click", () => go(true)),
					]}
				>
					<SharedElement
						id={id}
						mix={[
							is("2rem"),
							bs("2.75rem"),
							rounded("sm"),
							bg("brand.tint"),
							fg("brand"),
							text("xs"),
							css({ display: "grid", placeItems: "center" }),
						]}
					>
						B
					</SharedElement>
					{BOOK.title}
				</Button>
			</div>
		);
	};
});

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "On the book's own page",
	code: CODE,
	render: () => <BookPage />,
};
