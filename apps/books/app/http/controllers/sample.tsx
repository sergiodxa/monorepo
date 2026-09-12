/**
 * Sample-chapter controller. GET renders the offer and its email field; POST subscribes the
 * address and answers with the chapter itself. The chapter is the response to the POST and
 * is stored nowhere, so reloading the page asks for an address again — the gate the whole
 * page exists for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { RequestContext } from "remix/router";

import { getClientIP } from "@sdxc/get-client-ip";
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure, isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { INVALID_EMAIL_MESSAGE, SubscribeSchema } from "~/app/http/validators/subscribe";
import { readAttribution } from "~/app/lib/attribution";
import { buttondown } from "~/app/lib/buttondown";
import { seo } from "~/app/lib/seo";
import { ButtondownError } from "~/app/services/buttondown";
import { subscribe } from "~/app/services/subscribe";
import chapterSource from "~/resources/content/sample.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import SampleView from "~/resources/views/sample";
import routes from "~/routes/web";

/** The page's own title and description, accurate to the chapter this route actually delivers. */
const TITLE = "Read a free sample chapter";
const DESCRIPTION =
	"Read a chapter of the React Router OAuth2 Handbook for free: OAuth2 in simple terms.";

/**
 * Copy for the two provider rejections a visitor can act on. Anything else gets the generic
 * message, since the provider's own error text is written for API consumers.
 */
const BLOCKED_MESSAGE =
	"My upstream provider is blocking you for some reason.\nPlease try with another email address and sorry for the inconvenience.";
const INVALID_MESSAGE = "Invalid email address. \nPlease try with another email address.";
const GENERIC_MESSAGE = "Something went wrong, please try again.";

/** Logged beside a failure's line so a malformed chapter names the file to open. */
const CHAPTER_FILE = "resources/content/sample.md";

/** The chapter opens straight into prose, so the block it may carry is an empty one. */
const MARKDOWN_OPTIONS = { frontmatter: s.object({}) } satisfies Markdown.Options;

/**
 * The chapter, parsed and painted once per isolate.
 *
 * The first request that needs it does the work, because the Workers global scope
 * is reserved for imports and deploy validation holds a module-load parse to that.
 */
let chapter: Result<Markdown.Document, Markdown.ParseError | Markdown.WalkError> | undefined;

/**
 * Reads and paints the chapter, or hands back the work already done in this isolate.
 *
 * @returns The painted document, or the failure that stopped it.
 */
function readChapter() {
	if (chapter) return chapter;

	let parsed = Markdown.parse(chapterSource, MARKDOWN_OPTIONS);

	if (isFailure(parsed)) {
		chapter = parsed;
		return chapter;
	}

	chapter = Markdown.walk(parsed.data.document, highlight);
	return chapter;
}

/**
 * Renders the page in its locked state: the offer, the email field, and any error.
 *
 * @param ctx - The request context, for its URL and renderer.
 * @param options - `error` shows a failure under the email field, and `status` lets the form
 * endpoint answer 400 while still returning the page.
 * @returns The rendered HTML response.
 */
function renderForm(ctx: RequestContext, options: { error?: string; status?: number } = {}) {
	return ctx.render(
		<DocumentLayout title={TITLE} description={DESCRIPTION} canonical={seo.canonical(ctx.url)}>
			<SampleView
				action={routes.sample.action.href()}
				attribution={readAttribution(ctx.url.searchParams)}
				error={options.error}
			/>
		</DocumentLayout>,
		options.status ? { status: options.status } : undefined,
	);
}

/**
 * Marked `noindex`: this URL is shared with the form and reached only by
 * posting to it, so a search listing for either state would surface
 * content that belongs behind that gate.
 *
 * @param ctx - The request context, for its URL and renderer.
 * @returns The rendered HTML response, or the form again for a parse failure.
 */
function renderChapter(ctx: RequestContext) {
	let parsed = readChapter();

	if (isFailure(parsed)) {
		/**
		 * Reachable only when the bundled chapter itself is malformed. The reader is already
		 * subscribed, so the response stays the familiar form, with the error shown inline,
		 * while the log keeps the file and the line an author has to open.
		 */
		ctx.log.fail(parsed.error, {
			chapter: { file: CHAPTER_FILE, line: parsed.error.position?.start.line },
		});
		return renderForm(ctx, { error: GENERIC_MESSAGE, status: 500 });
	}

	return ctx.render(
		<DocumentLayout
			title={TITLE}
			description={DESCRIPTION}
			canonical={seo.canonical(ctx.url)}
			robots={seo.robotsTag({ index: false, follow: true })}
		>
			<SampleView
				action={routes.sample.action.href()}
				attribution={readAttribution(ctx.url.searchParams)}
				chapter={toRemix(parsed.data)}
			/>
		</DocumentLayout>,
	);
}

/** GET /sample — the offer and the email field that unlocks the chapter. */
export const index = createAction(routes.sample.index, (ctx) => renderForm(ctx));

/** POST /sample — subscribes the reader and answers with the chapter. */
export const action = createAction(routes.sample.action, async (ctx) => {
	let log = ctx.log;
	let validation = await validate(ctx.formData, SubscribeSchema);

	if (isFailure(validation)) {
		log.note("subscribe.validation_failed");
		return renderForm(ctx, { error: INVALID_EMAIL_MESSAGE, status: 400 });
	}

	let payload = validation.data;
	let result = await subscribe(buttondown(), payload, getClientIP(ctx.request));

	if (isSuccess(result)) {
		log.set({ sample: { unlocked: true } });
		return renderChapter(ctx);
	}

	let error = result.error;

	if (error instanceof ButtondownError) {
		if (error.code === "subscriber_blocked") {
			log.set({ subscribe: { result: "rejected", code: error.code } });
			return renderForm(ctx, { error: BLOCKED_MESSAGE, status: 400 });
		}

		if (error.code === "email_invalid") {
			log.set({ subscribe: { result: "rejected", code: error.code } });
			return renderForm(ctx, { error: INVALID_MESSAGE, status: 400 });
		}

		/**
		 * An address already on the list still gets the chapter. Someone who subscribed last
		 * month is exactly the reader this page is for, and the provider only calls it an error
		 * because nothing was created.
		 */
		if (error.code === "email_already_exists") {
			log.set({ subscribe: { result: "already-subscribed" }, sample: { unlocked: true } });
			return renderChapter(ctx);
		}
	}

	log.fail(error);
	return renderForm(ctx, { error: GENERIC_MESSAGE, status: 400 });
});
