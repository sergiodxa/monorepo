/**
 * Inkwell's media library: a drop zone that uploads with a plain form, the files as a grid
 * or a list chosen in the address, and an attachment sheet opened by `?item=<id>` holding the
 * file's facts and its alt text and caption.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { LayoutGridIcon, ListIcon, UploadIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { tabularNums, text, truncate, weight } from "@sdxc/u/typography";
import { Button, Link, LinkButton, TextField } from "@sdxc/ui";
import { setParamHref } from "@sdxc/ui/app";
import { DetailSheet } from "@sdxc/ui/app/detail-sheet";
import { DropZone } from "@sdxc/ui/app/drop-zone";
import { GridList } from "@sdxc/ui/app/grid-list";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { Skeleton } from "@sdxc/ui/app/skeleton";
import { PropertyList } from "@sdxc/ui/property-list";
import { RelativeTime } from "@sdxc/ui/relative-time";

import type { MediaItem, Swatch } from "~/resources/views/demo-apps/inkwell/data";

import DemoAppFrame from "~/resources/views/demo-apps/frame";
import { findAuthor, MEDIA, minutesBefore, POSTS } from "~/resources/views/demo-apps/inkwell/data";
import { FieldShape, TextBar } from "~/resources/views/demo-apps/inkwell/placeholders";
import {
	action,
	Byline,
	href,
	Initials,
	SerifTitle,
	SLUG,
} from "~/resources/views/demo-apps/inkwell/shell";

/** The attachment sheet's strings. */
const SHEET_LABELS: DetailSheet.Labels = {
	close: "Close attachment",
	copyLink: "Copy link",
	linkCopied: "Link copied",
	previous: "Previous file",
	next: "Next file",
	position: "File",
};

/** The alt text field's description. */
const ALT_HELP = "What a reader who can't see the image needs to know.";

/** The line closing the attachment sheet, saying how far a change reaches. */
const ATTACHMENT_NOTE = "Changes apply wherever the file appears.";

/** Kilobytes in a megabyte, for the file sizes the library prints. */
const KB_PER_MB = 1000;

/**
 * A file size as the library prints it: kilobytes under a megabyte, megabytes with one
 * decimal above.
 *
 * @param bytes The file's size.
 * @returns The size with its unit.
 */
export function fileSize(bytes: number): string {
	let kb = bytes / 1000;
	return kb < KB_PER_MB ? `${Math.round(kb)} KB` : `${(kb / KB_PER_MB).toFixed(1)} MB`;
}

/** Props accepted by {@link SwatchArt}. */
interface SwatchArtProps {
	swatch: Swatch;
	/** Unique within the page, so each swatch's gradient keeps its own id. */
	id: string;
}

/** A file drawn as a small painting from its two inks and motif, standing in for the photo. */
export function SwatchArt(handle: Handle<SwatchArtProps>) {
	return () => {
		let { swatch, id } = handle.props;
		let gradient = `${id}-ink`;
		let ink = "oklch(0.98 0.01 85 / 0.55)";
		return (
			<svg
				viewBox="0 0 160 120"
				preserveAspectRatio="xMidYMid slice"
				aria-hidden="true"
				mix={[raw({ display: "block", inlineSize: "100%", blockSize: "100%" })]}
			>
				<defs>
					<linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stop-color={swatch.from} />
						<stop offset="1" stop-color={swatch.to} />
					</linearGradient>
				</defs>
				<rect width="160" height="120" fill={`url(#${gradient})`} />
				{swatch.motif === "sun" ? (
					<>
						<circle cx="80" cy="78" r="26" fill={ink} />
						<rect y="84" width="160" height="36" fill={swatch.from} opacity="0.85" />
					</>
				) : null}
				{swatch.motif === "hills" ? (
					<>
						<path d="M0 86 Q40 56 80 80 T160 72 V120 H0Z" fill={ink} />
						<path d="M0 100 Q50 80 100 98 T160 92 V120 H0Z" fill={swatch.from} opacity="0.7" />
					</>
				) : null}
				{swatch.motif === "waves" ? (
					<g fill="none" stroke={ink} stroke-width="3">
						<path d="M0 50 Q20 40 40 50 T80 50 T120 50 T160 50" />
						<path d="M0 70 Q20 60 40 70 T80 70 T120 70 T160 70" />
						<path d="M0 90 Q20 80 40 90 T80 90 T120 90 T160 90" />
					</g>
				) : null}
				{swatch.motif === "grid" ? (
					<g fill={ink}>
						{[0, 1, 2, 3, 4].flatMap((col) =>
							[0, 1, 2].map((row) => (
								<rect x={22 + col * 25} y={22 + row * 27} width="17" height="19" rx="2" />
							)),
						)}
					</g>
				) : null}
				{swatch.motif === "rings" ? (
					<g fill="none" stroke={ink} stroke-width="2.5">
						<circle cx="80" cy="60" r="14" />
						<circle cx="80" cy="60" r="28" />
						<circle cx="80" cy="60" r="42" />
					</g>
				) : null}
				{swatch.motif === "stripes" ? (
					<g fill={ink}>
						<rect x="20" y="20" width="120" height="8" rx="2" />
						<rect x="20" y="40" width="120" height="8" rx="2" />
						<rect x="20" y="60" width="120" height="8" rx="2" />
						<rect x="20" y="80" width="120" height="8" rx="2" />
					</g>
				) : null}
			</svg>
		);
	};
}

/** Props accepted by {@link MediaScreen}. */
interface MediaScreenProps {
	/** The library's address with the toast and open item already dropped. */
	listUrl: URL;
	layout: "grid" | "list";
	/** The file the attachment sheet holds, when the address names one. */
	item: MediaItem | null;
	now: Date;
}

/**
 * The library. The grid/list choice and the open file live in the address, so a link opens
 * the same view, and the sheet steps through the files without closing.
 */
export function MediaScreen(handle: Handle<MediaScreenProps>) {
	return () => {
		let { listUrl, layout, item, now } = handle.props;
		let layoutHref = (value: "grid" | "list") =>
			setParamHref(listUrl, "view", value === "grid" ? null : value);
		let itemHref = (entry: MediaItem) => setParamHref(listUrl, "item", entry.id);

		return (
			<div mix={[vstack({ gap: 4, align: "stretch" })]}>
				<PageHeader
					title={<SerifTitle>Media</SerifTitle>}
					description={`${MEDIA.length} files, shared by every post and page.`}
					actions={
						<nav aria-label="Layout" mix={[hstack({ gap: 1, align: "center" })]}>
							<LinkButton
								href={layoutHref("grid")}
								aria-current={layout === "grid" ? "page" : undefined}
								variant={layout === "grid" ? "surface" : "ghost"}
								color="neutral"
								size="sm"
							>
								<LayoutGridIcon size={16} aria-hidden="true" />
								Grid
							</LinkButton>
							<LinkButton
								href={layoutHref("list")}
								aria-current={layout === "list" ? "page" : undefined}
								variant={layout === "list" ? "surface" : "ghost"}
								color="neutral"
								size="sm"
							>
								<ListIcon size={16} aria-hidden="true" />
								List
							</LinkButton>
						</nav>
					}
				/>
				<form
					method="post"
					action={action("media")}
					enctype="multipart/form-data"
					mix={[vstack({ gap: 3, align: "stretch" })]}
				>
					<DropZone name="files" accept="image/png, image/jpeg, image/webp" multiple>
						<UploadIcon size={20} aria-hidden="true" />
						<span mix={[vstack({ gap: 0.5, align: "center" })]}>
							<span mix={[weight("semibold"), fg("neutral.emphasis")]}>
								Drop images here, or click to choose
							</span>
							<span mix={[text("xs"), fg("neutral.muted")]}>
								PNG, JPEG or WebP · up to 20 MB each
							</span>
						</span>
					</DropZone>
					<div>
						<Button type="submit" size="sm" variant="outline" color="neutral">
							Upload files
						</Button>
					</div>
				</form>
				<GridList aria-label="Media library" layout={layout === "grid" ? "grid" : "stack"}>
					{MEDIA.map((entry) => (
						<GridList.Item
							id={`media-${entry.id}`}
							aria-selected={entry.id === item?.id ? "true" : undefined}
						>
							<MediaTile entry={entry} layout={layout} href={itemHref(entry)} now={now} />
						</GridList.Item>
					))}
				</GridList>
				{item === null ? null : <AttachmentSheet item={item} listUrl={listUrl} />}
			</div>
		);
	};
}

/** Props accepted by {@link MediaTile}. */
interface MediaTileProps {
	entry: MediaItem;
	layout: "grid" | "list";
	href: string;
	now: Date;
}

/** One file in the library: its swatch, name and size, linking to its attachment sheet. */
function MediaTile(handle: Handle<MediaTileProps>) {
	return () => {
		let { entry, layout, href: itemHref, now } = handle.props;
		let isGrid = layout === "grid";
		return (
			<a
				href={itemHref}
				mix={[
					raw({
						display: "grid",
						gap: isGrid ? "0.5rem" : "0.75rem",
						gridTemplateColumns: isGrid ? "minmax(0, 1fr)" : "4rem minmax(0, 1fr) auto",
						alignItems: "center",
						inlineSize: "100%",
						color: "inherit",
						textDecoration: "none",
					}),
				]}
			>
				<span
					mix={[
						rounded("md"),
						raw({
							display: "block",
							overflow: "hidden",
							aspectRatio: "4 / 3",
							boxShadow: "inset 0 0 0 1px oklch(0 0 0 / 0.08)",
						}),
					]}
				>
					<SwatchArt swatch={entry.swatch} id={`tile-${entry.id}`} />
				</span>
				<span mix={[vstack({ gap: 0, align: "stretch" }), raw({ minInlineSize: "0" })]}>
					<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis"), truncate()]}>
						{entry.name}
					</span>
					<span mix={[text("xs"), fg("neutral.muted"), tabularNums(), truncate()]}>
						{`${entry.width} × ${entry.height} · ${fileSize(entry.bytes)}`}
					</span>
				</span>
				{isGrid ? null : (
					<span mix={[text("xs"), fg("neutral.muted"), raw({ whiteSpace: "nowrap" })]}>
						<RelativeTime
							date={minutesBefore(now, entry.uploadedMinutesAgo)}
							now={now}
							locale="en-US"
							local
						/>
					</span>
				)}
			</a>
		);
	};
}

/** Props accepted by {@link AttachmentSheet}. */
interface AttachmentSheetProps {
	item: MediaItem;
	listUrl: URL;
}

/**
 * One file's sheet. Its header and footer answer with the library; the file's picture, facts
 * and fields stream in as a frame read from the file's id and the library's layout.
 */
function AttachmentSheet(handle: Handle<AttachmentSheetProps>) {
	return () => {
		let { item, listUrl } = handle.props;
		let index = MEDIA.findIndex((entry) => entry.id === item.id);
		let at = (offset: number) => {
			let neighbour = MEDIA[index + offset];
			return neighbour === undefined ? null : setParamHref(listUrl, "item", neighbour.id);
		};
		let closeHref = setParamHref(listUrl, "item", null);
		let list = listUrl.searchParams.get("view") === "list";

		return (
			<DetailSheet
				id="attachment"
				title={item.name}
				description={item.type}
				closeHref={closeHref}
				position={{ index: index + 1, total: MEDIA.length, previousHref: at(-1), nextHref: at(1) }}
				labels={SHEET_LABELS}
				footer={
					<div mix={[hstack({ gap: 2, align: "center" })]}>
						<Button type="submit" form="attachment-form" color="brand" size="sm">
							Save details
						</Button>
						<LinkButton href={closeHref} variant="ghost" color="neutral" size="sm">
							Cancel
						</LinkButton>
					</div>
				}
			>
				<DemoAppFrame
					app={SLUG}
					part={`media/${item.id}/attachment${list ? "?view=list" : ""}`}
					fallback={<AttachmentPlaceholder />}
				/>
			</DetailSheet>
		);
	};
}

/** Props accepted by {@link AttachmentDetails}. */
interface AttachmentDetailsProps {
	item: MediaItem;
	/** The library's layout, which a save lands back on. */
	view: "grid" | "list";
	now: Date;
}

/** One file's picture, its facts and the post it appears in, and the alt text and caption readers get. */
export function AttachmentDetails(handle: Handle<AttachmentDetailsProps>) {
	return () => {
		let { item, view, now } = handle.props;
		let post = POSTS.find((candidate) => candidate.id === item.postId);
		return (
			<div mix={[vstack({ gap: 5, align: "stretch" })]}>
				<div mix={[rounded("lg"), raw({ overflow: "hidden", aspectRatio: "4 / 3" })]}>
					<SwatchArt swatch={item.swatch} id={`sheet-${item.id}`} />
				</div>
				<PropertyList>
					<PropertyList.Item label="Dimensions">
						<span mix={[tabularNums()]}>{`${item.width} × ${item.height} px`}</span>
					</PropertyList.Item>
					<PropertyList.Item label="Size">{fileSize(item.bytes)}</PropertyList.Item>
					<PropertyList.Item label="Uploaded by">
						<Byline author={findAuthor(item.authorId)} />
					</PropertyList.Item>
					<PropertyList.Item label="Uploaded">
						<RelativeTime
							date={minutesBefore(now, item.uploadedMinutesAgo)}
							now={now}
							locale="en-US"
							local
						/>
					</PropertyList.Item>
					<PropertyList.Item label="Used in" empty="Not used yet">
						{post === undefined ? null : <Link href={href(`posts/${post.id}`)}>{post.title}</Link>}
					</PropertyList.Item>
				</PropertyList>
				<form
					id="attachment-form"
					method="post"
					action={action(`media/${item.id}`)}
					mix={[vstack({ gap: 4, align: "stretch" })]}
				>
					<input type="hidden" name="back" value={view === "list" ? "list" : ""} />
					<TextField label="Alt text" name="alt" defaultValue={item.alt} description={ALT_HELP} />
					<TextField
						label="Caption"
						name="caption"
						defaultValue={item.caption}
						placeholder="No caption"
					/>
				</form>
				<p mix={[m(0), text("xs"), fg("neutral.muted")]}>{ATTACHMENT_NOTE}</p>
			</div>
		);
	};
}

/**
 * The attachment sheet's body while it loads: the picture's box, the facts' labels with a bar
 * for each value (the uploader's behind a blank initials chip, so the row takes the byline's
 * baseline in any font), and the fields' labels over boxes at their controls' height.
 */
export function AttachmentPlaceholder() {
	return () => (
		<div aria-hidden="true" mix={[vstack({ gap: 5, align: "stretch" })]}>
			<Skeleton mix={[rounded("lg"), raw({ blockSize: "auto", aspectRatio: "4 / 3" })]} />
			<PropertyList>
				{["Dimensions", "Size", "Uploaded by", "Uploaded", "Used in"].map((label, index) => (
					<PropertyList.Item label={label}>
						{label === "Uploaded by" ? (
							<span mix={[hstack({ gap: 2, align: "center" })]}>
								<Initials author={{ initials: "\u00a0", name: "" }} />
								<span>
									<TextBar width="7rem" />
								</span>
							</span>
						) : (
							<span>
								<TextBar width={index % 2 === 0 ? "7rem" : "5rem"} />
							</span>
						)}
					</PropertyList.Item>
				))}
			</PropertyList>
			<div mix={[vstack({ gap: 4, align: "stretch" })]}>
				<FieldShape label="Alt text" gap="0.5rem" description={ALT_HELP} />
				<FieldShape label="Caption" gap="0.5rem" />
			</div>
			<p mix={[m(0), text("xs"), fg("neutral.muted")]}>{ATTACHMENT_NOTE}</p>
		</div>
	);
}
