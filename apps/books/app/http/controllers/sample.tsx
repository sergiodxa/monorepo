/**
 * A book's sample-chapter page at `/:book/sample`. GET renders the offer and its email field;
 * POST subscribes the address and answers with the chapter itself. A slug the catalogue does
 * not list, or a book without a free chapter, is a 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { toCampaign } from "@sdxc/attribution";
import { toPlainText } from "@sdxc/markdown/plain";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure, isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";
import type { Book } from "~/config/books";

import defaultHandler from "~/app/http/controllers/default-handler";
import {
	INVALID_EMAIL_MESSAGE,
	SubscribeSchema,
	screenSubscriberEmail,
} from "~/app/http/validators/subscribe";
import { seo } from "~/app/initializers/seo";
import { CHAPTER_FILE, readAnchoredChapter } from "~/app/services/sample-chapter";
import { signSampleLink } from "~/app/services/sample-link";
import { subscribe } from "~/app/services/subscribe";
import { findBook } from "~/config/books";
import { BOOK_COPY } from "~/resources/content/books";
import DocumentLayout from "~/resources/layouts/document";
import ChapterView from "~/resources/views/book/chapter";
import SampleOffer from "~/resources/views/book/sample-offer";
import BookFooter from "~/resources/views/site/footer";
import BookHeader from "~/resources/views/site/header";
import routes from "~/routes/web";

/** The `:book` segment the page is addressed by. */
const PARAMS = s.object({ book: s.string() });

/** Words a reader gets through in a minute of technical prose, for the chapter's reading time. */
const WORDS_PER_MINUTE = 230;

/** A book this page can serve: one the catalogue lists, with a free chapter. */
type SampledBook = Book & { sample: NonNullable<Book["sample"]> };

/**
 * Resolves the request's `:book` to a book with a free chapter.
 *
 * @param ctx - The request context, for its params.
 * @returns The book, or `undefined` when the slug is unknown or the book has no sample.
 */
function findSampledBook(ctx: AppContext): SampledBook | undefined {
	let book = findBook(s.parse(PARAMS, ctx.params).book);
	if (!book?.sample) return undefined;
	return { ...book, sample: book.sample };
}

/**
 * Wraps a page of the book in its header and footer, inside the document.
 *
 * @param ctx - The request context, for its assets and URL.
 * @param book - The book whose pages the header and footer link.
 * @param options - The page's title, its `noindex` robots tag when it holds the chapter, and its main content.
 * @returns The document to render.
 */
function bookDocument(
	ctx: AppContext,
	book: SampledBook,
	options: { title: string; robots?: string; children: RemixNode },
) {
	let copy = BOOK_COPY[book.slug];
	let slug = { book: book.slug };
	let landing = routes.book.href(slug);

	return (
		<DocumentLayout
			assets={ctx.assets}
			title={options.title}
			description={`Read “${book.sample.title}”, a chapter of the ${book.title}, for free.`}
			canonical={seo.canonical(ctx.url)}
			robots={options.robots}
		>
			<BookHeader landing={landing} title={copy.shortTitle} sample />
			{options.children}
			<BookFooter
				landing={landing}
				title={copy.shortTitle}
				tagline={book.description}
				sample={routes.sample.index.href(slug)}
				upgrade={book.upgrade ? routes.upgrade.index.href(slug) : undefined}
			/>
		</DocumentLayout>
	);
}

/**
 * Copy for the two provider rejections a visitor can act on. Anything else gets the generic
 * message, since the provider's own error text is written for API consumers.
 */
const BLOCKED_MESSAGE =
	"My upstream provider is blocking you for some reason.\nPlease try with another email address and sorry for the inconvenience.";
const INVALID_MESSAGE = "Invalid email address. \nPlease try with another email address.";
const GENERIC_MESSAGE = "Something went wrong, please try again.";

/**
 * Renders the page in its locked state: the offer, the email field, and any error.
 *
 * @param ctx - The request context, for its URL and renderer.
 * @param options - `error` shows a failure under the email field, and `status` lets the form endpoint answer 400 while still returning the page. `confirmEmail` is the address a typo suggestion was shown for, prefilled so resubmitting it keeps it.
 * @returns The rendered HTML response.
 */
function renderForm(
	ctx: AppContext,
	book: SampledBook,
	options: { error?: string; status?: number; confirmEmail?: string } = {},
) {
	return ctx.render(
		bookDocument(ctx, book, {
			title: `Read “${book.sample.title}” free — ${book.title}`,
			children: (
				<SampleOffer
					copy={BOOK_COPY[book.slug]}
					action={routes.sample.action.href({ book: book.slug })}
					confirmEmail={options.confirmEmail}
					error={options.error}
				/>
			),
		}),
		options.status ? { status: options.status } : undefined,
	);
}

/**
 * Marked `noindex`: this URL is shared with the form and reached only by
 * posting to it, so a search listing for either state would surface
 * content that belongs behind that gate.
 *
 * @param ctx - The request context, for its URL and renderer.
 * @param book - The book whose chapter the address unlocked.
 * @returns The rendered HTML response, or the form again for a parse failure.
 */
async function renderChapter(ctx: AppContext, book: SampledBook) {
	let parsed = readAnchoredChapter();

	if (isFailure(parsed)) {
		/**
		 * Reachable only when the bundled chapter itself is malformed. The reader is already
		 * subscribed, so the response stays the familiar form, with the error shown inline,
		 * while the log keeps the file and the line an author has to open.
		 */
		ctx.log.fail(parsed.error, {
			chapter: { file: CHAPTER_FILE, line: parsed.error.position?.start.line },
		});
		return renderForm(ctx, book, { error: GENERIC_MESSAGE, status: 500 });
	}

	/**
	 * The download link is minted here, on the page the address unlocked, so the file sits
	 * behind the same gate. Signing failing leaves the reader the chapter itself, without
	 * the link, rather than taking the page away.
	 */
	let download = await signSampleLink();
	if (isFailure(download)) ctx.log.fail(download.error, { sample: { download: "unsigned" } });

	let { document, sections } = parsed.data;
	let words = toPlainText(document).split(/\s+/).filter(Boolean).length;
	let body = {
		...document,
		children: document.children.filter((node) => !(node.type === "heading" && node.level === 1)),
	};

	return ctx.render(
		bookDocument(ctx, book, {
			title: `${book.sample.title} — ${book.title}`,
			robots: seo.robotsTag({ index: false, follow: true }),
			children: (
				<ChapterView
					bookTitle={BOOK_COPY[book.slug].shortTitle}
					title={book.sample.title}
					chapter={toRemix(body)}
					sections={sections}
					minutes={Math.max(1, Math.round(words / WORDS_PER_MINUTE))}
					download={isSuccess(download) ? download.data : undefined}
					filename={book.sample.filename}
					pricing={`${routes.book.href({ book: book.slug })}#pricing`}
				/>
			),
		}),
	);
}

/** GET /:book/sample — the offer and the email field that unlocks the chapter. */
export const index = createAction(routes.sample.index, (ctx) => {
	let book = findSampledBook(ctx);
	if (!book) return defaultHandler(ctx);
	return renderForm(ctx, book);
});

/** POST /:book/sample — subscribes the reader and answers with the chapter. */
export const action = createAction(routes.sample.action, async (ctx) => {
	let book = findSampledBook(ctx);
	if (!book) return defaultHandler(ctx);

	let log = ctx.log;
	let validation = await validate(ctx.formData, SubscribeSchema);

	if (isFailure(validation)) {
		log.note("subscribe.validation_failed");
		return renderForm(ctx, book, { error: INVALID_EMAIL_MESSAGE, status: 400 });
	}

	let payload = validation.data;
	let screened = screenSubscriberEmail(payload);

	if (isFailure(screened)) {
		log.set({ subscribe: { result: "rejected", code: screened.error.reason } });
		return renderForm(ctx, book, {
			error: screened.error.message,
			status: 400,
			confirmEmail: screened.error.reason === "typo" ? payload.email.address : undefined,
		});
	}

	/**
	 * An address already on the list unlocks the chapter too: someone who subscribed last
	 * month is exactly the reader this page is for.
	 */
	let result = await subscribe(ctx.newsletter, payload, {
		attribution: toCampaign(ctx.attribution.last ?? ctx.attribution.first, ctx.url),
		ip: ctx.ip,
	});

	if (isSuccess(result)) {
		log.set({ sample: { unlocked: true } });
		return await renderChapter(ctx, book);
	}

	let error = result.error;

	if (error.code === "suppressed") {
		log.set({ subscribe: { result: "rejected", code: error.code } });
		return renderForm(ctx, book, { error: BLOCKED_MESSAGE, status: 400 });
	}

	if (error.code === "invalid_address") {
		log.set({ subscribe: { result: "rejected", code: error.code } });
		return renderForm(ctx, book, { error: INVALID_MESSAGE, status: 400 });
	}

	log.fail(error);
	return renderForm(ctx, book, { error: GENERIC_MESSAGE, status: 400 });
});
