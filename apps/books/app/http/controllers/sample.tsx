/**
 * Sample-chapter controller. GET renders the offer and its email field; POST subscribes the
 * address and answers with the chapter itself. The chapter is the response to the POST and
 * is stored nowhere, so reloading the page asks for an address again — the gate the whole
 * page exists for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { getClientIP } from "@pkg/get-client-ip";
import { renderToRemix } from "@pkg/markdown/client";
import { Markdown } from "@pkg/markdown/server";
import { isFailure, isSuccess } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { INVALID_EMAIL_MESSAGE, SubscribeSchema } from "~/app/http/validators/subscribe";
import { readAttribution } from "~/app/lib/attribution";
import { seo } from "~/app/lib/seo";
import { Buttondown, ButtondownError } from "~/app/services/buttondown";
import { subscribe } from "~/app/services/subscribe";
import chapterSource from "~/resources/content/sample.md?raw";
import DocumentLayout from "~/resources/layouts/document";
import SampleView from "~/resources/views/sample";
import routes from "~/routes/web";

/** The page's title and its own description: it offers a chapter, it does not sell a book. */
const TITLE = "Read a free sample chapter";
const DESCRIPTION =
	"Read a chapter of the React Router OAuth2 Handbook for free: OAuth2 in simple terms.";

/**
 * Copy for the two provider rejections a visitor can act on. Anything else gets the generic
 * message — the provider's own error text is written for API consumers, not for readers.
 */
const BLOCKED_MESSAGE =
	"My upstream provider is blocking you for some reason.\nPlease try with another email address and sorry for the inconvenience.";
const INVALID_MESSAGE = "Invalid email address. \nPlease try with another email address.";
const GENERIC_MESSAGE = "Something went wrong, please try again.";

/**
 * The parsed chapter, memoized after the first request that needs it.
 *
 * Parsing cannot happen at module load, even though the file is bundled and never changes:
 * the Workers runtime forbids asynchronous I/O, timers, and random values in global scope,
 * and the Markdown transform does enough of that to make the whole script fail to deploy —
 * as a validation error at upload time, not as a runtime fault. So the work is deferred to
 * the first reader and kept for every reader after them, which is the same one-parse-per
 * isolate the module-scope version was after.
 */
let chapter: ReturnType<Markdown<ReturnType<typeof chapterSchema>>["parse"]> | undefined;

/** The chapter carries no frontmatter, and the parser requires a schema regardless. */
function chapterSchema() {
	return s.object({});
}

/**
 * Parses the chapter, or returns the parse already done in this isolate.
 *
 * @returns The parse result, success or failure.
 */
function readChapter() {
	chapter ??= new Markdown({ frontmatter: chapterSchema() }).parse(chapterSource);
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
 * Renders the unlocked chapter.
 *
 * The document is marked `noindex`: it is the same URL as the form, reachable only by
 * posting to it, and letting a crawler index one of the two states would advertise gated
 * content it cannot reach.
 *
 * @param ctx - The request context, for its URL and renderer.
 * @returns The rendered HTML response, or the form again if the chapter cannot be parsed.
 */
function renderChapter(ctx: RequestContext) {
	let parsed = readChapter();

	if (isFailure(parsed)) {
		// Unreachable short of a malformed bundled file, but the reader is already subscribed
		// at this point, so the honest answer is the page they came from and not a 500.
		ctx.logger.error("sample_parse_failed", { error: parsed.error.message });
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
				chapter={renderToRemix(parsed.data.content)}
			/>
		</DocumentLayout>,
	);
}

/** GET /sample — the offer and the email field that unlocks the chapter. */
export const index = createAction(routes.sample.index, (ctx) => renderForm(ctx));

/** POST /sample — subscribes the reader and answers with the chapter. */
export const action = createAction(routes.sample.action, async (ctx) => {
	let log = ctx.logger;
	let validation = await validate(ctx.formData, SubscribeSchema);

	if (isFailure(validation)) {
		log.info("sample_validation_failed", { issue: INVALID_EMAIL_MESSAGE });
		return renderForm(ctx, { error: INVALID_EMAIL_MESSAGE, status: 400 });
	}

	let payload = validation.data;
	let buttondown = getServiceContainer().get(Buttondown);
	let result = await subscribe(buttondown, payload, getClientIP(ctx.request));

	if (isSuccess(result)) {
		log.info("sample_unlocked", { email: payload.email, subscriber: result.data });
		return renderChapter(ctx);
	}

	let error = result.error;

	if (error instanceof ButtondownError) {
		if (error.code === "subscriber_blocked") {
			log.info("subscriber_blocked", { email: payload.email });
			return renderForm(ctx, { error: BLOCKED_MESSAGE, status: 400 });
		}

		if (error.code === "email_invalid") {
			log.info("sample_email_invalid", { email: payload.email });
			return renderForm(ctx, { error: INVALID_MESSAGE, status: 400 });
		}

		/**
		 * An address already on the list still gets the chapter. Someone who subscribed last
		 * month is exactly the reader this page is for, and the provider only calls it an error
		 * because nothing was created.
		 */
		if (error.code === "email_already_exists") {
			log.info("sample_already_subscribed", { email: payload.email });
			return renderChapter(ctx);
		}
	}

	log.error("sample_subscribe_error", { email: payload.email, error: error.message });
	return renderForm(ctx, { error: GENERIC_MESSAGE, status: 400 });
});
