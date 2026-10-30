/**
 * The about-the-author band: a 3:4 portrait beside a chapter statement, bio, credentials,
 * byline with signature and social links, and an optional intro-video card, so a visitor
 * meets the real person behind a course, book or library before deciding to buy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { PlayIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container, vstack } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, text, weight } from "@sdxc/u/typography";

import { MarketingHeader } from "../components/marketing-header.js";
import { MarketingSection } from "../components/marketing-section.js";
import { displayHeading } from "../styles/marketing.js";

/** Container the band's split and the portrait's phone cap query. */
const CONTAINER = "ui-marketing-author-band";

/** The inset hairline that keeps a photo's edge visible on a matching background. */
const IMAGE_OUTLINE = "1px solid var(--ui-image-outline, rgb(0 0 0 / 0.1))";

/** Corner radius of the portrait and the video card. */
const RADIUS = "var(--ui-marketing-radius-surface, 1rem)";

/**
 * Prop types for {@link AuthorBand}.
 */
export namespace AuthorBand {
	/** One social profile link in the byline. */
	export interface SocialLink {
		/** The profile URL. */
		href: string;
		/** The network's name, such as "GitHub"; it is the link's accessible name. */
		label: string;
		/** The network's glyph, drawn in `currentColor` at 1.25rem. */
		icon: RemixNode;
	}

	/** The intro video the band links to. */
	export interface Video {
		/** A still from the video: an `<img>` or inline SVG, cropped to 16:9. */
		thumbnail: RemixNode;
		/** The video's title, overlaid on the still and repeated in the caption. */
		title: string;
		/** The runtime as a reader expects it, such as "2:13". */
		duration: string;
		/** Where the video plays. */
		href: string;
	}

	/**
	 * Props accepted by {@link AuthorBand}.
	 */
	export interface Props extends Omit<MarketingSection.Props, "children" | "title" | "align"> {
		/** The author's photo or illustration: an `<img>` or inline SVG, cropped to 3:4. */
		portrait: RemixNode;
		/** A short label above the title, such as "About the author". */
		eyebrow?: RemixNode;
		/** The band's statement, rendered at chapter display size through the ambient heading depth. */
		title: RemixNode;
		/** The bio; `<strong>` fragments draw in the heading ink. */
		description?: RemixNode;
		/** The author's name in the byline. */
		name: RemixNode;
		/** The author's role or credential line, such as "Type designer, Lisbon". */
		jobTitle?: RemixNode;
		/** Proof points under the bio, usually a `CheckList`. */
		credentials?: RemixNode;
		/** Profile links shown as icon buttons in the byline. */
		social?: readonly SocialLink[];
		/** A handwritten signature as inline SVG drawn in `currentColor`, set above the name. */
		signature?: RemixNode;
		/** An intro video card under the byline. */
		video?: Video;
	}
}

/**
 * Renders the portrait and the copy column: one column on a phone with the portrait capped
 * at 20rem, then a 5/7 split from the `lg` container with both columns starting at the
 * same top edge.
 *
 * @param handle Runtime handle carrying the band's props.
 * @returns The render function producing the band's markup.
 * @example
 * <AuthorBand
 * 	portrait={<img src={portrait} alt="Odile Varga at her drafting table" />}
 * 	eyebrow={t("author.eyebrow")}
 * 	title={t("author.title")}
 * 	description={t("author.bio")}
 * 	name="Odile Varga"
 * 	jobTitle={t("author.role")}
 * />
 */
export function AuthorBand(handle: Handle<AuthorBand.Props>) {
	return () => {
		let {
			credentials,
			description,
			eyebrow,
			mix,
			name,
			portrait,
			jobTitle,
			signature,
			social,
			title,
			video,
			...rest
		} = handle.props;

		return (
			<MarketingSection {...rest} mix={mix}>
				<div data-slot="author-band" mix={[container(CONTAINER), raw({ inlineSize: "100%" })]}>
					<div data-slot="author-band-layout" mix={[layout()]}>
						<figure data-slot="author-band-portrait" mix={[portraitFrame()]}>
							{portrait}
						</figure>
						<div data-slot="author-band-copy" mix={[vstack({ gap: 8, align: "stretch" })]}>
							<MarketingHeader
								eyebrow={eyebrow}
								description={description}
								mix={[raw({ "--ui-marketing-header-end": "0" })]}
							>
								{title}
							</MarketingHeader>
							{credentials ? <div data-slot="author-band-credentials">{credentials}</div> : null}
							<div data-slot="author-band-byline" mix={[vstack({ gap: 3, align: "start" })]}>
								{signature ? (
									<div data-slot="author-band-signature" mix={[signatureFrame()]}>
										{signature}
									</div>
								) : null}
								<p mix={[m(0), vstack({ gap: 0.5, align: "start" })]}>
									<span mix={[text("lg"), weight("semibold"), fg("neutral.emphasis")]}>{name}</span>
									{jobTitle ? (
										<span mix={[text("sm"), fg("neutral.muted")]}>{jobTitle}</span>
									) : null}
								</p>
								{social?.length ? (
									<ul data-slot="author-band-social" mix={[socialList()]}>
										{social.map((link) => (
											<li key={link.href}>
												<a href={link.href} aria-label={link.label} title={link.label}>
													{link.icon}
												</a>
											</li>
										))}
									</ul>
								) : null}
							</div>
							{video ? <VideoCard {...video} /> : null}
						</div>
					</div>
				</div>
			</MarketingSection>
		);
	};
}

/**
 * The band's grid in one rule: a single column on a phone, then a 5/7 split from the
 * `lg` container, both columns pinned to the top so the portrait and the eyebrow start
 * on one line.
 */
function layout() {
	return combine([
		raw({
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr)",
			alignItems: "start",
			gap: "2.5rem",
		}),
		at(
			"lg",
			CONTAINER,
			raw({ gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)", columnGap: "4rem" }),
		),
	]);
}

/**
 * The portrait's frame: 3:4 at the surface radius with an inset hairline over the photo's
 * edge, full width capped at 20rem on a phone and filling its column from `lg`.
 */
function portraitFrame() {
	return combine([
		raw({
			margin: "0",
			inlineSize: "100%",
			maxInlineSize: "20rem",
			aspectRatio: "3 / 4",
			borderRadius: RADIUS,
			overflow: "hidden",
			backgroundColor: "var(--ui-neutral-bg-tint)",
			outline: IMAGE_OUTLINE,
			outlineOffset: "-1px",
		}),
		at("lg", CONTAINER, raw({ maxInlineSize: "none" })),
		when(
			"& > :is(img, svg, picture, video)",
			raw({ display: "block", inlineSize: "100%", blockSize: "100%", objectFit: "cover" }),
		),
	]);
}

/** The signature's frame: 8rem wide in the heading ink, scaling the SVG to fit. */
function signatureFrame() {
	return combine([
		raw({ inlineSize: "8rem", color: "var(--ui-neutral-fg-emphasis)" }),
		when("& > svg", raw({ display: "block", inlineSize: "100%", blockSize: "auto" })),
	]);
}

/**
 * The social row: each link a 2.75rem square, so every icon has a 44px hit area, with the
 * row pulled back by the icon's inset so the first glyph lines up with the name above.
 */
function socialList() {
	return combine([
		raw({
			listStyle: "none",
			margin: "0",
			marginInlineStart: "-0.75rem",
			padding: "0",
			display: "flex",
			flexWrap: "wrap",
		}),
		when(
			"& a",
			raw({
				display: "grid",
				placeItems: "center",
				inlineSize: "2.75rem",
				blockSize: "2.75rem",
				borderRadius: "0.5rem",
				color: "var(--ui-neutral-fg-muted)",
			}),
		),
		when("& a:is(:hover, :focus-visible)", raw({ color: "var(--ui-neutral-fg-emphasis)" })),
		when("& a > svg", raw({ inlineSize: "1.25rem", blockSize: "1.25rem" })),
	]);
}

/**
 * The intro video as a 16:9 linked still: the title over a dark fade at the foot, a round
 * play button in the centre, and a caption with the runtime under the card.
 *
 * @param handle Runtime handle carrying the video's details.
 * @returns The render function producing the card and its caption.
 */
function VideoCard(handle: Handle<AuthorBand.Video>) {
	return () => {
		let { duration, href, thumbnail, title } = handle.props;

		return (
			<figure
				data-slot="author-band-video"
				mix={[m(0), vstack({ gap: 2, align: "stretch" }), raw({ maxInlineSize: "24rem" })]}
			>
				<a href={href} mix={[videoLink()]}>
					{thumbnail}
					<span
						data-slot="author-band-video-play"
						aria-hidden="true"
						mix={[
							raw({
								position: "absolute",
								insetBlockStart: "50%",
								insetInlineStart: "50%",
								translate: "-50% -50%",
								zIndex: "1",
								display: "grid",
								placeItems: "center",
								inlineSize: "3.5rem",
								blockSize: "3.5rem",
								borderRadius: "9999px",
								backgroundColor: "rgb(255 255 255 / 0.92)",
								color: "rgb(0 0 0 / 0.85)",
								boxShadow: "0 4px 16px rgb(0 0 0 / 0.25)",
							}),
							when(
								"& > svg",
								raw({
									inlineSize: "1.5rem",
									blockSize: "1.5rem",
									marginInlineStart: "0.1875rem",
									fill: "currentColor",
								}),
							),
						]}
					>
						<PlayIcon />
					</span>
					<span
						data-slot="author-band-video-title"
						mix={[
							raw({ "--ui-neutral-fg-emphasis": "#fff" }),
							displayHeading(3),
							raw({
								position: "absolute",
								insetInline: "1rem",
								insetBlockEnd: "0.875rem",
								zIndex: "1",
								textShadow: "0 1px 2px rgb(0 0 0 / 0.4)",
							}),
						]}
					>
						{title}
					</span>
				</a>
				<figcaption mix={[text("sm"), leading("snug"), fg("neutral.muted")]}>
					{title} ({duration})
				</figcaption>
			</figure>
		);
	};
}

/**
 * The video link's frame: a 16:9 still at the surface radius with the inset hairline, and a
 * fade from transparent to 55% black over its lower part so the white title reads on any frame.
 */
function videoLink() {
	return combine([
		raw({
			position: "relative",
			display: "block",
			aspectRatio: "16 / 9",
			borderRadius: RADIUS,
			overflow: "hidden",
			backgroundColor: "var(--ui-neutral-bg-tint)",
			textDecoration: "none",
			outlineOffset: "2px",
		}),
		when(
			"& > :is(img, svg, picture):first-child",
			raw({
				display: "block",
				inlineSize: "100%",
				blockSize: "100%",
				objectFit: "cover",
			}),
		),
		when(
			"&::after",
			raw({
				content: '""',
				position: "absolute",
				inset: "0",
				borderRadius: "inherit",
				backgroundImage: "linear-gradient(transparent 40%, rgb(0 0 0 / 0.55))",
				boxShadow: `inset 0 0 0 1px var(--ui-image-outline, rgb(0 0 0 / 0.1))`,
			}),
		),
		when(
			'& > [data-slot="author-band-video-play"]',
			motionSafe(raw({ transition: "scale 200ms" })),
		),
		when(
			'&:is(:hover, :focus-visible) > [data-slot="author-band-video-play"]',
			raw({ scale: "1.06" }),
		),
	]);
}
