/**
 * One position, complete. It is the address the listing's control points at and the address
 * the dialog's frame is filled from, and it is the only handler that parses a posting's
 * Markdown, so the work is done once for the one posting somebody asked to read.
 *
 * A frame asks for the detail alone and is answered with the detail alone; everybody else
 * gets a whole document that stands on its own with no script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";
import { vstack } from "@sdxc/u/layout";
import { fontSize } from "@sdxc/u/typography";
import { Empty, Heading, HeadingScope, LinkButton, Separator, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import PositionDetail from "~/resources/components/position-detail";
import DocumentLayout from "~/resources/layouts/document";
import { isFrameRequest } from "~/routes/frames";
import routes from "~/routes/web";

/** The one segment this route carries, which names the posting being read. */
const Params = s.object({ id: s.string() });

/** GET /positions/:id — one position, as a page or as the fragment a frame asks for. */
export default createAction(routes.position, async (ctx) => {
	let { id } = s.parse(Params, ctx.params);

	let posting = await ctx.models.postings.find(id);

	if (posting === null) {
		let missing = (
			<Empty>
				<Empty.Title>{ctx.intl.t("notFound.title")}</Empty.Title>
				<Empty.Description>{ctx.intl.t("notFound.description")}</Empty.Description>
				<Empty.Action>
					<LinkButton href={routes.board.index.href()} size="sm">
						{ctx.intl.t("notFound.back")}
					</LinkButton>
				</Empty.Action>
			</Empty>
		);

		if (isFrameRequest(ctx.request)) return ctx.render(missing, { status: 404 });

		return ctx.render(
			<DocumentLayout title={ctx.intl.t("notFound.title")} locale={ctx.locale}>
				<HeadingScope level={1}>{missing}</HeadingScope>
			</DocumentLayout>,
			{ status: 404 },
		);
	}

	/**
	 * Parsed here, which is the one place on the board that parses anything: a description
	 * that will not parse is shown as the author wrote it rather than failing the page.
	 */
	let parsed = Markdown.parse(posting.description);

	let detail = (
		<PositionDetail
			posting={posting}
			intl={ctx.intl}
			description={isFailure(parsed) ? null : parsed.data.document}
		/>
	);

	/**
	 * The dialog this lands in already carries the position's title, its company and the
	 * chrome around them, so the fragment is the detail and nothing else.
	 */
	if (isFrameRequest(ctx.request)) return ctx.render(detail);

	return ctx.render(
		<DocumentLayout title={`${posting.title} — ${posting.company}`} locale={ctx.locale}>
			<div mix={[vstack({ gap: 8 })]}>
				<header mix={[vstack({ gap: 4 })]}>
					<div mix={[vstack({ gap: 2 })]}>
						<Heading level={1} mix={[fontSize("3xl")]}>
							{posting.title}
						</Heading>
						<Text mix={[fontSize("base")]}>{posting.company}</Text>
					</div>
					<div>
						<LinkButton href={routes.board.index.href()} variant="outline" color="neutral">
							{ctx.intl.t("posting.back")}
						</LinkButton>
					</div>
				</header>

				<Separator />

				<HeadingScope level={2}>{detail}</HeadingScope>
			</div>
		</DocumentLayout>,
	);
});
