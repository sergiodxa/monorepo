/**
 * The copy every book's pages are written from, keyed by the same slug as the catalogue in
 * `config/books.ts`. One landing, sample and upgrade template renders any record, so a new
 * book is a new entry here rather than a new view; the type makes a missing entry an error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import type { BookSlug } from "~/config/books";
import type { Product } from "~/config/products";

import { REACT_ROUTER_OAUTH2 } from "~/resources/content/books/react-router-oauth2";

export namespace BookCopy {
	/** One claim in the "what's inside" band: a title and the sentence that sells it. */
	export interface Claim {
		title: string;
		body: string;
	}

	/** One step of the flow the book teaches: its name, and its line of code or a quieter note. */
	export interface Step {
		title: string;
		code?: string;
		detail?: string;
	}

	/** The flow the book teaches, as the diagram plays one run of it. */
	export interface Diagram {
		label: string;
		trigger: { title: string; detail?: string };
		steps: readonly Step[];
		outcome: string;
		footnote?: string;
	}

	/** One entry of the table of contents: its number, title, and what it covers. */
	export interface ContentsLesson {
		number: string;
		title: string;
		/** One or two lines, shown when a reader opens the entry. */
		summary: string;
	}

	/** A chapter, or the appendices, as one part of the table of contents. */
	export interface ContentsPart {
		title: string;
		/** Whether the part is the free chapter, so each entry carries a "Free" badge. */
		free?: boolean;
		lessons: readonly ContentsLesson[];
	}

	/** The whole table of contents, titled by what it counts. */
	export interface Contents {
		title: string;
		parts: readonly ContentsPart[];
	}

	/** A code sample taken from the book, as one tab of the band's code stage. */
	export interface Sample {
		label: string;
		language: string;
		code: string;
	}

	/** What the pricing band says about one package; the price itself is read from billing. */
	export interface Package {
		name: string;
		description: string;
		features: readonly string[];
		action: string;
	}

	/** A reader's quote, published with their name, role and photo. */
	export interface Quote {
		quote: RemixNode;
		name: string;
		role: RemixNode;
		photo: string;
	}

	/** The author band: who wrote the book, with the links their bio points at. */
	export interface Author {
		title: string;
		bio: RemixNode;
		credentials: readonly string[];
		name: string;
		jobTitle: string;
		photo: string;
		links: readonly { href: string; label: string; icon: RemixNode }[];
	}

	/** The first page of the free chapter, set on the sample band as the book prints it. */
	export interface SamplePage {
		runningHead: string;
		title: string;
		opening: string;
		subhead: string;
		continuation: string;
	}
}

/** Everything a book's pages say, aside from the facts in its catalogue record and its prices. */
export interface BookCopy {
	/** The drawn cover, shown flat beside the hero and on the homepage and forms. */
	Cover: () => () => RemixNode;
	/** The wordmark in the header and footer. */
	shortTitle: string;
	hero: { eyebrow: string; title: RemixNode; description: RemixNode };
	quote?: BookCopy.Quote;
	sample: { title: string; description: RemixNode; page: BookCopy.SamplePage };
	/** The book's table of contents, with its band's lead. */
	contents: BookCopy.Contents & { description: RemixNode };
	flow: {
		title: string;
		description: RemixNode;
		diagram: BookCopy.Diagram;
		/** What the flow guarantees, as checked claims beside the diagram. */
		guarantees: readonly string[];
	};
	/** What the book holds; the title counts its pages, and the code is quoted from it. */
	inside: {
		title: (pages: number) => string;
		description: RemixNode;
		claims: readonly BookCopy.Claim[];
		samples: readonly BookCopy.Sample[];
	};
	author: BookCopy.Author;
	pricing: { title: string; description: RemixNode };
	packages: Partial<Record<Product, BookCopy.Package>>;
	upgrade: { title: string; description: string; action: string };
	faq: readonly (readonly [question: string, answer: string])[];
	closing: { title: string; description: string };
}

/** The copy for each book in the catalogue. */
export const BOOK_COPY: Record<BookSlug, BookCopy> = {
	"react-router-oauth2": REACT_ROUTER_OAUTH2,
};
