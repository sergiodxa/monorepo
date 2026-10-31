/**
 * The catalogue: every book this site sells, keyed by the slug its pages live under
 * (`/react-router-oauth2`). A second book is a second record here plus its copy in
 * `resources/content/books/`; the routes and controllers already serve any slug listed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Discounts, Product } from "~/config/products";

/** The facts the funnel needs about one book: what it is, what it sells, and how it upgrades. */
export interface Book {
	/** The path segment every page of the book lives under, published in links; never renamed. */
	slug: BookSlug;
	/** The full title, set as the landing's `<title>` and in structured data. */
	title: string;
	/** One sentence for search results and link previews. */
	description: string;
	/** Printed length of the book, quoted on the landing and in structured data. */
	pages: number;
	/** The packages on sale, flagship first: the order the pricing band lists them. */
	packages: readonly [Product, ...Product[]];
	/** The package a reader starts from, and the discounted one they can upgrade to. */
	upgrade?: { from: Product; to: Product; discount: Discounts };
	/** The free chapter behind the email gate, when the book offers one. */
	sample?: { title: string; filename: string };
}

/** Every slug in the catalogue; adding a book adds its slug here first. */
export type BookSlug = "react-router-oauth2";

/** The books on sale, by slug. */
export const BOOKS: Record<BookSlug, Book> = {
	"react-router-oauth2": {
		slug: "react-router-oauth2",
		title: "React Router OAuth2 Handbook",
		description:
			"A practical guide to implementing secure OAuth2 authentication in React Router and Remix applications.",
		pages: 47,
		packages: [Product.Complete, Product.Essentials],
		upgrade: { from: Product.Essentials, to: Product.Complete, discount: Discounts.UPGRADE },
		sample: { title: "OAuth2 in Simple Terms", filename: "oauth2-handbook-sample.epub" },
	},
};

/**
 * The book the site's own pages lead to: where the homepage sends a new subscriber, and
 * where every URL from before books had their own path now redirects.
 */
export const FEATURED_BOOK: Book = BOOKS["react-router-oauth2"];

/**
 * Looks a book up by the slug a URL carries.
 *
 * @param slug - The `:book` segment of the request path.
 * @returns The book, or `undefined` for a slug the catalogue does not list, which a page answers with its 404.
 */
export function findBook(slug: string): Book | undefined {
	return Object.hasOwn(BOOKS, slug) ? BOOKS[slug as BookSlug] : undefined;
}

/**
 * Finds the book a package belongs to, so a failed checkout returns the buyer to its page.
 *
 * @param product - The package being bought.
 * @returns The first book listing the package, or `undefined` when none does.
 */
export function findBookSelling(product: Product): Book | undefined {
	return Object.values(BOOKS).find((book) => book.packages.includes(product));
}
