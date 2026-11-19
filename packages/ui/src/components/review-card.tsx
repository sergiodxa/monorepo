/**
 * One customer review: the stars, a title and the words, then who wrote it and when, a
 * verified mark, what they bought, any photos, and room for a "Was this helpful?" form. Reviews
 * stack in a list separated by hairlines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { CircleCheckIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";

import { Rating } from "./rating.js";

/** Prop types for {@link ReviewCard}. */
export namespace ReviewCard {
	/** Props accepted by {@link ReviewCard}; the host is an `<article>`. */
	export interface Props extends Omit<TagProps<"article">, "children" | "title"> {
		author: RemixNode;
		/** The stars the reviewer gave, out of five. */
		rating: number;
		title?: RemixNode;
		body: RemixNode;
		/** When it was written, such as a `<time>` or a relative date. */
		date: RemixNode;
		/** The mark of a confirmed purchase, such as "Verified buyer"; shown with a check. */
		verified?: RemixNode;
		/** What the reviewer bought, such as "Size: 50×70 · Oak frame". */
		meta?: RemixNode;
		/** Photos the reviewer added, laid out by the caller. */
		media?: RemixNode;
		/** A slot at the end of the footer, such as a POST form voting the review helpful. */
		helpful?: RemixNode;
	}
}

/**
 * Renders the review as an `<article>`: small stars and the title on top, the body in reading
 * size, photos beneath, and a wrapping footer row of author, date, verified mark and purchase
 * with the helpful slot pushed to the end.
 *
 * @example
 * <ReviewCard author="Maya R." rating={5} title="Better in person" body="The paper is heavy and the colours are rich." date="2 weeks ago" verified="Verified buyer" meta="50×70 · Oak frame" />
 */
export function ReviewCard(handle: Handle<ReviewCard.Props>) {
	return () => {
		let { author, body, date, helpful, media, meta, mix, rating, title, verified, ...rest } =
			handle.props;
		return (
			<article
				{...rest}
				data-slot="review-card"
				mix={mergeMix(
					[
						raw({
							display: "grid",
							gap: "0.625rem",
							paddingBlock: "1.25rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
							color: "var(--ui-neutral-fg)",
						}),
					],
					mix,
				)}
			>
				<div mix={[raw({ display: "grid", gap: "0.375rem" })]}>
					<Rating value={rating} size="sm" />
					{title === undefined ? null : (
						<p
							data-slot="review-card-title"
							mix={[
								raw({
									margin: "0",
									fontSize: "1rem",
									fontWeight: "650",
									lineHeight: "1.35",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{title}
						</p>
					)}
				</div>
				<div
					data-slot="review-card-body"
					mix={[
						raw({
							fontSize: "0.9375rem",
							lineHeight: "1.6",
							"& > p": { margin: "0" },
							"& > p + p": { marginBlockStart: "0.75em" },
						}),
					]}
				>
					{body}
				</div>
				{media === undefined ? null : <div data-slot="review-card-media">{media}</div>}
				<footer
					data-slot="review-card-footer"
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							columnGap: "0.75rem",
							rowGap: "0.375rem",
							fontSize: "0.8125rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					<span mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}>
						{author}
					</span>
					<span>{date}</span>
					{verified === undefined ? null : (
						<span
							data-slot="review-card-verified"
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.25rem",
									color: "var(--ui-success-fg)",
									"& > svg": { inlineSize: "0.875rem", blockSize: "0.875rem" },
								}),
							]}
						>
							<CircleCheckIcon aria-hidden="true" />
							{verified}
						</span>
					)}
					{meta === undefined ? null : <span data-slot="review-card-meta">{meta}</span>}
					{helpful === undefined ? null : (
						<span data-slot="review-card-helpful" mix={[raw({ marginInlineStart: "auto" })]}>
							{helpful}
						</span>
					)}
				</footer>
			</article>
		);
	};
}
