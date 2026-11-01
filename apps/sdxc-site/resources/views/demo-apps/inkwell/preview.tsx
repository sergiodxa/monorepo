/**
 * A post as Lantern Review's readers would see it, outside the editor's frame: a thin bar
 * that says it is a preview and leads back, then the article set in the publication's serif
 * at a reading measure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowLeftIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { Badge, LinkButton } from "@sdxc/ui";

import type { Post } from "~/resources/views/demo-apps/inkwell/data";

import { findAuthor, MEDIA, postDate, PUBLICATION } from "~/resources/views/demo-apps/inkwell/data";
import { SwatchArt } from "~/resources/views/demo-apps/inkwell/media";
import { STATUS_LABEL } from "~/resources/views/demo-apps/inkwell/posts-query";
import { href, Initials, mark } from "~/resources/views/demo-apps/inkwell/shell";

/** Props accepted by {@link PreviewScreen}. */
interface PreviewScreenProps {
	post: Post;
	now: Date;
}

/** The reading view of one post, with its lead image when the library holds one for it. */
export function PreviewScreen(handle: Handle<PreviewScreenProps>) {
	return () => {
		let { post, now } = handle.props;
		let author = findAuthor(post.authorId);
		let lead = MEDIA.find((item) => item.postId === post.id);
		let date = postDate(post, now).toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
			timeZone: "UTC",
		});

		return (
			<div mix={[vstack({ gap: 0, align: "stretch" }), raw({ minBlockSize: "100dvh" })]}>
				<header
					mix={[
						hstack({ gap: 3, align: "center" }),
						raw({
							position: "sticky",
							insetBlockStart: "0",
							zIndex: "2",
							padding: "0.625rem 1rem",
							backgroundColor: "var(--ui-brand-bg-solid)",
							color: "var(--ui-brand-fg-on-solid, white)",
							flexWrap: "wrap",
						}),
					]}
				>
					<LinkButton href={href(`posts/${post.id}`)} variant="surface" color="neutral" size="sm">
						<ArrowLeftIcon size={16} aria-hidden="true" />
						Back to editor
					</LinkButton>
					<span mix={[text("sm"), raw({ flex: "1 1 12rem" })]}>
						{post.status === "published"
							? "Preview of the last saved version."
							: `Preview · ${STATUS_LABEL[post.status]}, hidden from readers until it goes live.`}
					</span>
				</header>
				<article
					mix={[
						vstack({ gap: 6, align: "stretch" }),
						raw({
							inlineSize: "100%",
							maxInlineSize: "42rem",
							marginInline: "auto",
							padding: "3rem 1.25rem 5rem",
							boxSizing: "border-box",
						}),
					]}
				>
					<p
						mix={[
							hstack({ gap: 2, align: "center" }),
							m(0),
							font("serif"),
							weight("semibold"),
							fg("neutral.muted"),
						]}
					>
						{mark(20)}
						{PUBLICATION.name}
					</p>
					<header mix={[vstack({ gap: 3, align: "stretch" })]}>
						<span mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
							{post.tags.map((tag) => (
								<Badge variant="outline" color="brand">
									{tag}
								</Badge>
							))}
						</span>
						<h1
							mix={[
								m(0),
								font("serif"),
								fg("neutral.emphasis"),
								raw({
									fontSize: "clamp(2rem, 1.5rem + 2.5vw, 3.25rem)",
									lineHeight: "1.08",
									letterSpacing: "-0.02em",
									fontWeight: "600",
									textWrap: "balance",
								}),
							]}
						>
							{post.title}
						</h1>
						<p
							mix={[
								m(0),
								font("serif"),
								fg("neutral.muted"),
								raw({ fontSize: "1.25rem", fontStyle: "italic" }),
							]}
						>
							{post.excerpt}
						</p>
						<p mix={[hstack({ gap: 2, align: "center" }), m(0), text("sm"), fg("neutral.muted")]}>
							<Initials author={author} />
							{`${author.name} · ${date}`}
						</p>
					</header>
					{lead === undefined ? null : (
						<figure mix={[m(0), vstack({ gap: 2, align: "stretch" })]}>
							<div mix={[rounded("lg"), raw({ overflow: "hidden", aspectRatio: "3 / 2" })]}>
								<SwatchArt swatch={lead.swatch} id={`preview-${lead.id}`} />
							</div>
							{lead.caption === "" ? null : (
								<figcaption mix={[text("sm"), fg("neutral.muted")]}>{lead.caption}</figcaption>
							)}
						</figure>
					)}
					<div mix={[vstack({ gap: 5, align: "stretch" })]}>
						{post.body.map((paragraph) => (
							<p
								mix={[
									m(0),
									font("serif"),
									fg("neutral.emphasis"),
									raw({ fontSize: "1.1875rem", lineHeight: "1.75", textWrap: "pretty" }),
								]}
							>
								{paragraph}
							</p>
						))}
					</div>
				</article>
			</div>
		);
	};
}
