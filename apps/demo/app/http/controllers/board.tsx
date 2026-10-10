/**
 * The board's two actions: the listing every visitor lands on, and the submission that
 * publishes a position. The posting model drops the cached listing and queues the
 * confirmation email once the row is stored, so the visitor is redirected without waiting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import type { Posting } from "~/database/schema";

import { PostingSchema } from "~/app/http/validators/posting";
import { cache, LISTING_KEY, LISTING_TTL } from "~/app/lib/cache";
import { turnstileSiteKey } from "~/app/lib/captcha";
import DocumentLayout from "~/resources/layouts/document";
import BoardView from "~/resources/views/board";
import routes from "~/routes/web";

/** How many positions one page of the board shows. */
const PAGE_SIZE = 50;

/** The open positions, from the cache when it has them and from the database otherwise. */
async function openPostings(ctx: RequestContext): Promise<Posting[]> {
	let listing = await cache.fetch(LISTING_KEY, () => ctx.models.postings.listOpen(PAGE_SIZE), {
		ttl: LISTING_TTL,
	});

	return isFailure(listing) ? [] : listing.data;
}

/**
 * Renders the board.
 *
 * @param error Why the last submission was refused; its presence reopens the submit form.
 */
async function renderBoard(ctx: RequestContext, error?: string): Promise<Response> {
	let postings = await openPostings(ctx);

	return ctx.render(
		<DocumentLayout title={ctx.intl.t("board.title")} locale={ctx.locale} hydrates>
			<BoardView intl={ctx.intl} postings={postings} siteKey={turnstileSiteKey()} error={error} />
		</DocumentLayout>,
		{ status: error ? 400 : 200 },
	);
}

/** GET / — the open positions, newest first. */
export const index = createAction(routes.board.index, (ctx) => renderBoard(ctx));

/**
 * POST / — publishes a position and mails its contact a confirmation. A plain function
 * rather than a `createAction`, because the route declares middleware of its own and an
 * action object's `handler` has to be one.
 */
export async function action(ctx: RequestContext): Promise<Response> {
	let submission = await validate(ctx.formData, PostingSchema);
	if (isFailure(submission)) return await renderBoard(ctx, ctx.intl.t("form.invalid"));

	let posting = await ctx.models.postings.create(submission.data);
	if (isFailure(posting)) return await renderBoard(ctx, ctx.intl.t("form.invalid"));

	ctx.log.set({ posting: { id: posting.data.id } });

	return redirect(routes.board.index.href(), { status: redirect.Status.SeeOther });
}
