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

import { toCampaign } from "@sdxc/attribution";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure, isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import {
	INVALID_EMAIL_MESSAGE,
	SubscribeSchema,
	screenSubscriberEmail,
} from "~/app/http/validators/subscribe";
import { CHAPTER_FILE, readChapter } from "~/app/lib/sample-chapter";
import { signSampleLink } from "~/app/lib/sample-link";
import { seo } from "~/app/lib/seo";
import { subscribe } from "~/app/services/subscribe";
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

/**
 * Renders the page in its locked state: the offer, the email field, and any error.
 *
 * @param ctx - The request context, for its URL and renderer.
 * @param options - `error` shows a failure under the email field, and `status` lets the form
 * endpoint answer 400 while still returning the page. `confirmEmail` is the address a typo
 * suggestion was shown for, prefilled so resubmitting it keeps it.
 * @returns The rendered HTML response.
 */
function renderForm(
	ctx: RequestContext,
	options: { error?: string; status?: number; confirmEmail?: string } = {},
) {
	return ctx.render(
		<DocumentLayout title={TITLE} description={DESCRIPTION} canonical={seo.canonical(ctx.url)}>
			<SampleView
				action={routes.sample.action.href()}
				confirmEmail={options.confirmEmail}
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
async function renderChapter(ctx: RequestContext) {
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

	/**
	 * The download link is minted here, on the page the address unlocked, so the file sits
	 * behind the same gate. Signing failing leaves the reader the chapter itself, without
	 * the link, rather than taking the page away.
	 */
	let download = await signSampleLink();
	if (isFailure(download)) ctx.log.fail(download.error, { sample: { download: "unsigned" } });

	return ctx.render(
		<DocumentLayout
			title={TITLE}
			description={DESCRIPTION}
			canonical={seo.canonical(ctx.url)}
			robots={seo.robotsTag({ index: false, follow: true })}
		>
			<SampleView
				action={routes.sample.action.href()}
				chapter={toRemix(parsed.data)}
				download={isSuccess(download) ? download.data : undefined}
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
	let screened = screenSubscriberEmail(payload);

	if (isFailure(screened)) {
		log.set({ subscribe: { result: "rejected", code: screened.error.reason } });
		return renderForm(ctx, {
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
		return await renderChapter(ctx);
	}

	let error = result.error;

	if (error.code === "suppressed") {
		log.set({ subscribe: { result: "rejected", code: error.code } });
		return renderForm(ctx, { error: BLOCKED_MESSAGE, status: 400 });
	}

	if (error.code === "invalid_address") {
		log.set({ subscribe: { result: "rejected", code: error.code } });
		return renderForm(ctx, { error: INVALID_MESSAGE, status: 400 });
	}

	log.fail(error);
	return renderForm(ctx, { error: GENERIC_MESSAGE, status: 400 });
});
