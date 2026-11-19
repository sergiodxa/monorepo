/**
 * A poster's page: a gallery with zoom and a full-screen viewer, the format, size, frame and
 * mount pickers whose every option is a link to that variant (swapped in the `buy` frame, so
 * the page keeps its scroll), price and stock for the variant, a delivery date, a size guide,
 * details, reviews (filtered and sorted in their own frame), questions, and shelves of more.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ChevronDownIcon, RulerIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { HeadingScope } from "@sdxc/ui";
import { Breadcrumbs } from "@sdxc/ui/breadcrumbs";
import { FulfilmentNote } from "@sdxc/ui/commerce/fulfilment-note";
import { Price } from "@sdxc/ui/commerce/price";
import { ProductGallery } from "@sdxc/ui/commerce/product-gallery";
import { QuestionList } from "@sdxc/ui/commerce/question-list";
import { VariantPicker } from "@sdxc/ui/commerce/variant-picker";
import { Dialog } from "@sdxc/ui/dialog";
import { Lightbox } from "@sdxc/ui/lightbox";
import { LinkButton } from "@sdxc/ui/link-button";
import { Rating } from "@sdxc/ui/rating";
import { ReviewCard } from "@sdxc/ui/review-card";
import { SectionBar } from "@sdxc/ui/section-bar";
import { RatingBreakdown } from "@sdxc/ui/travel/rating-breakdown";
import { Frame } from "remix/component";

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import type { Poster, Review, Variant } from "./data";
import type { Visitor } from "./state";

import { DetailArt, FramedArt, PosterArt, RoomArt } from "./art";
import {
	CURRENCY,
	DEFAULT_VARIANT,
	FRAMES,
	LOCALE,
	MOUNT_PRICE,
	POSTERS,
	SHIPPING,
	SIZES,
	SLUG,
	STYLES,
	actionHref,
	availability,
	findArtist,
	findFrame,
	findSize,
	href,
	listPrice,
	money,
	questionsFor,
	ratingOf,
	reviewsFor,
	salePrice,
	sizeName,
	variantName,
} from "./data";
import { EYEBROW, Gutter, Shelf, WALL, WishButton } from "./parts";
import { RecentLive } from "./recent-live";
import { MAX_RECENT, RECENT_COOKIE, validVariant } from "./state";

/** The frame the variant pickers swap, holding the gallery and the buy box. */
export const BUY_FRAME = "hw-buy";

/** The frame the review filters swap. */
export const REVIEWS_FRAME = "hw-reviews";

/** How many reviews a page of them shows. */
const REVIEWS_PAGE = 4;

/** Each format's name in the picker. */
const FORMAT_NAMES: Record<Variant["format"], string> = {
	digital: "Print file",
	print: "Print",
	framed: "Framed",
};

/** The size guide dialog's id. */
const SIZE_GUIDE = "hw-size-guide";

/** The lightbox's id. */
const LIGHTBOX = "hw-lightbox";

/**
 * Reads the variant a product page shows from its address. Anything missing falls back to the
 * default for that format, so `?format=print` alone opens a 50 × 70 print.
 */
export function readVariant(params: URLSearchParams): Variant {
	let format = params.get("format");
	if (format === "digital") return { format: "digital", size: null, frame: null, mount: false };
	let size = findSize(params.get("size") ?? "")?.id ?? DEFAULT_VARIANT.size;
	if (format === "print") return { format: "print", size, frame: null, mount: false };
	let frame = findFrame(params.get("frame") ?? "")?.id ?? DEFAULT_VARIANT.frame;
	let variant: Variant = { format: "framed", size, frame, mount: params.get("mount") === "1" };
	return validVariant(variant) ? variant : DEFAULT_VARIANT;
}

/** The address of a poster's page on one variant, with the gallery image it opens on. */
export function variantHref(poster: Poster, variant: Variant, image?: string): string {
	let params = new URLSearchParams({ format: variant.format });
	if (variant.size !== null) params.set("size", variant.size);
	if (variant.frame !== null) params.set("frame", variant.frame);
	if (variant.mount) params.set("mount", "1");
	if (image !== undefined) params.set("image", image);
	return href(`p/${poster.id}?${params}`);
}

/** Adds working days to a time, skipping Saturdays and Sundays. */
export function addWorkingDays(from: number, days: number): Date {
	let date = new Date(from);
	let left = days;
	while (left > 0) {
		date.setUTCDate(date.getUTCDate() + 1);
		let weekday = date.getUTCDay();
		if (weekday !== 0 && weekday !== 6) left -= 1;
	}
	return date;
}

/** A day written like "Tue 24 Nov". */
export function shortDay(date: Date): string {
	return new Intl.DateTimeFormat(LOCALE, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "Europe/Lisbon",
	}).format(date);
}

/** The images the gallery shows for a variant: what you'd hang first, then the room and a detail. */
function galleryImages(poster: Poster, variant: Variant) {
	let size = findSize(variant.size ?? "50x70") ?? SIZES[2]!;
	let images: { id: string; alt: string; art: RemixNode }[] = [];
	if (variant.format === "framed") {
		images.push({
			id: "framed",
			alt: `${poster.title} in a ${findFrame(variant.frame ?? "")?.name ?? "oak"} frame`,
			art: <FramedArt poster={poster} frame={variant.frame} mount={variant.mount} />,
		});
	}
	images.push({
		id: "print",
		alt: `${poster.title}, the print on its own`,
		art: <PosterArt poster={poster} />,
	});
	if (variant.format !== "digital") {
		images.push({
			id: "room",
			alt: `${poster.title} at ${sizeName(size, poster.orientation)} above a 210 cm sofa`,
			art: (
				<RoomArt
					poster={poster}
					size={size}
					frame={variant.format === "framed" ? variant.frame : null}
					mount={variant.mount}
					label={`${poster.title} at ${sizeName(size, poster.orientation)} above a 210 cm sofa`}
				/>
			),
		});
	}
	images.push({
		id: "detail",
		alt: `A close look at the paper and ink of ${poster.title}`,
		art: <DetailArt poster={poster} />,
	});
	return images;
}

namespace BuyBox {
	export interface Props {
		poster: Poster;
		variant: Variant;
		image: string | null;
		visitor: Visitor;
		now: number;
		back: string;
	}
}

/**
 * The gallery and the buy box, which the variant links swap as one frame so the picture, the
 * price, the stock and the button always describe the same variant.
 */
export function BuyBox(handle: Handle<BuyBox.Props>) {
	return () => {
		let { back, image, now, poster, variant, visitor } = handle.props;
		let artist = findArtist(poster.artist);
		let rating = ratingOf(poster);
		let images = galleryImages(poster, variant);
		let current = images.find((entry) => entry.id === image)?.id ?? images[0]!.id;
		let price = salePrice(poster, variant);
		let list = listPrice(poster, variant);
		let stock = availability(poster, variant);
		let size = findSize(variant.size ?? "");
		let link = (next: Variant) => variantHref(poster, next, image ?? undefined);
		let framedFrom = salePrice(poster, {
			format: "framed",
			size: "a4",
			frame: "oak",
			mount: false,
		});
		let printFrom = salePrice(poster, { format: "print", size: "a4", frame: null, mount: false });
		let shipping = SHIPPING[0]!;
		let arrives =
			variant.format === "digital"
				? "Download it as soon as you check out."
				: `Order today, arrives ${shortDay(addWorkingDays(now, shipping.days[0] + (variant.format === "framed" ? 2 : 0)))} – ${shortDay(addWorkingDays(now, shipping.days[1] + (variant.format === "framed" ? 3 : 0)))}.`;
		let saved = visitor.wish.includes(poster.id);
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gap: "clamp(1.5rem, 4vw, 3.5rem)",
						"@media (min-width: 56rem)": {
							gridTemplateColumns: "minmax(0, 7fr) minmax(20rem, 5fr)",
							alignItems: "start",
						},
					}),
				]}
			>
				<div
					mix={[
						raw({
							minInlineSize: "0",
							"@media (min-width: 56rem)": { position: "sticky", insetBlockStart: "5rem" },
						}),
					]}
				>
					<ProductGallery
						images={images.map((entry) => ({
							id: entry.id,
							alt: entry.alt,
							media: entry.art,
							href: variantHref(poster, variant, entry.id),
						}))}
						current={current}
						background={WALL}
						ratio="4 / 5"
						lightbox={LIGHTBOX}
						labels={{ zoom: "View full screen", image: "Image {n} of {total}" }}
					/>
					<Lightbox
						id={LIGHTBOX}
						label={`${poster.title} images`}
						photos={images.map((entry) => ({
							alt: entry.alt,
							caption: entry.alt,
							art: <span style="display:block;inline-size:min(80vw,70vh)">{entry.art}</span>,
						}))}
					/>
				</div>
				<div mix={[raw({ display: "grid", gap: "1.25rem", alignContent: "start" })]}>
					<div mix={[raw({ display: "grid", gap: "0.5rem" })]}>
						<a
							href={href(`artists/${poster.artist}`)}
							mix={[
								raw({ ...EYEBROW, textDecoration: "none" }),
								when("&:hover", raw({ color: "var(--ui-neutral-fg)" })),
							]}
						>
							{artist?.name}
						</a>
						<h1
							mix={[
								raw({
									margin: "0",
									fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
									fontWeight: "500",
									letterSpacing: "-0.025em",
									lineHeight: "1.05",
								}),
							]}
						>
							{poster.title}
						</h1>
						<a
							href="#reviews"
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.5rem",
									color: "inherit",
									textDecoration: "none",
									fontSize: "0.875rem",
								}),
							]}
						>
							<Rating value={rating.average} size="sm" />
							<span mix={[raw({ textDecoration: "underline", textUnderlineOffset: "0.2em" })]}>
								{rating.average.toFixed(1)} · {rating.count} reviews
							</span>
						</a>
					</div>
					<div data-variant-price="">
						<Price
							amount={price}
							currency={CURRENCY}
							locale={LOCALE}
							size="lg"
							compareAt={poster.sale === undefined ? undefined : list}
							installments={price >= 6000 ? 3 : undefined}
						/>
						<p
							mix={[
								raw({
									margin: "0.25rem 0 0",
									fontSize: "0.8125rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							VAT included.
						</p>
					</div>
					<VariantPicker target={BUY_FRAME}>
						<VariantPicker.Axis label="Format" value={FORMAT_NAMES[variant.format]}>
							<VariantPicker.Choice
								variant="card"
								href={link({
									format: "framed",
									size: variant.size ?? "50x70",
									frame: variant.frame ?? "oak",
									mount: variant.mount,
								})}
								selected={variant.format === "framed"}
								label="Framed"
								detail={`From ${money(framedFrom)}`}
								note="Ready to hang"
							/>
							<VariantPicker.Choice
								variant="card"
								href={link({
									format: "print",
									size: variant.size ?? "50x70",
									frame: null,
									mount: false,
								})}
								selected={variant.format === "print"}
								label="Print"
								detail={`From ${money(printFrom)}`}
								note="Ships in a tube"
							/>
							<VariantPicker.Choice
								variant="card"
								href={link({ format: "digital", size: null, frame: null, mount: false })}
								selected={variant.format === "digital"}
								label="Print file"
								detail={money(
									salePrice(poster, { format: "digital", size: null, frame: null, mount: false }),
								)}
								note="Instant download"
							/>
						</VariantPicker.Axis>
						{variant.format === "digital" ? null : (
							<VariantPicker.Axis
								label="Size"
								value={size === undefined ? undefined : sizeName(size, poster.orientation)}
								aside={
									<button
										type="button"
										command="show-modal"
										commandfor={SIZE_GUIDE}
										mix={[
											raw({
												display: "inline-flex",
												alignItems: "center",
												gap: "0.25rem",
												padding: "0",
												border: "0",
												background: "none",
												font: "inherit",
												fontSize: "0.875rem",
												color: "inherit",
												textDecoration: "underline",
												textUnderlineOffset: "0.2em",
												cursor: "pointer",
												"& svg": { inlineSize: "1rem", blockSize: "1rem" },
											}),
										]}
									>
										<RulerIcon />
										Size guide
									</button>
								}
							>
								{SIZES.map((option) => {
									let next: Variant = { ...variant, size: option.id };
									let open = availability(poster, next);
									return (
										<VariantPicker.Choice
											href={link(next)}
											selected={variant.size === option.id}
											unavailable={!open.available}
											label={sizeName(option, poster.orientation)}
										/>
									);
								})}
							</VariantPicker.Axis>
						)}
						{variant.format !== "framed" ? null : (
							<VariantPicker.Axis label="Frame" value={findFrame(variant.frame ?? "")?.name}>
								{FRAMES.map((frame) => (
									<VariantPicker.Swatch
										href={link({ ...variant, frame: frame.id })}
										name={
											frame.surcharge === 0
												? frame.name
												: `${frame.name} (+${money(frame.surcharge)})`
										}
										color={frame.color}
										selected={variant.frame === frame.id}
									/>
								))}
							</VariantPicker.Axis>
						)}
						{variant.format !== "framed" ? null : (
							<VariantPicker.Axis label="Mount" value={variant.mount ? "White mount" : "No mount"}>
								<VariantPicker.Choice
									href={link({ ...variant, mount: false })}
									selected={!variant.mount}
									label="No mount"
								/>
								<VariantPicker.Choice
									href={link({ ...variant, mount: true })}
									selected={variant.mount}
									label="White mount"
									detail={`+${money(MOUNT_PRICE)}`}
								/>
							</VariantPicker.Axis>
						)}
					</VariantPicker>
					{stock.available ? (
						<form
							method="post"
							action={actionHref("cart/add")}
							mix={[raw({ display: "grid", gap: "0.75rem" })]}
						>
							<input type="hidden" name="poster" value={poster.id} />
							<input type="hidden" name="format" value={variant.format} />
							<input type="hidden" name="size" value={variant.size ?? ""} />
							<input type="hidden" name="frame" value={variant.frame ?? ""} />
							<input type="hidden" name="mount" value={variant.mount ? "1" : "0"} />
							<input type="hidden" name="back" value={back} />
							{stock.left === null ? null : (
								<p
									role="status"
									mix={[
										raw({
											margin: "0",
											fontWeight: "600",
											color: "var(--ui-color-brand-700, oklch(0.5 0.17 30))",
										}),
									]}
								>
									Only {stock.left} left in this size and frame
								</p>
							)}
							<div mix={[raw({ display: "flex", gap: "0.5rem" })]}>
								<button
									type="submit"
									mix={[
										raw({
											flex: "1",
											blockSize: "3.25rem",
											border: "0",
											borderRadius: "var(--ui-cta-radius)",
											font: "inherit",
											fontSize: "1.0625rem",
											fontWeight: "600",
											color: "var(--ui-bg)",
											backgroundColor: "var(--ui-neutral-fg-emphasis)",
											cursor: "pointer",
										}),
										when(
											"&:hover",
											raw({ backgroundColor: "var(--ui-color-brand-700, oklch(0.5 0.17 30))" }),
										),
										when(
											"&:focus-visible",
											raw({ outline: "2px solid var(--ui-color-brand-600)", outlineOffset: "2px" }),
										),
									]}
								>
									Add to bag · {money(price)}
								</button>
								<WishButton poster={poster} saved={saved} back={back} variant="inline" />
							</div>
						</form>
					) : (
						<form
							method="post"
							action={actionHref(`p/${poster.id}/notify`)}
							mix={[
								raw({
									display: "grid",
									gap: "0.5rem",
									padding: "1rem",
									borderRadius: "var(--ui-radius-md)",
									border: "1px solid var(--ui-neutral-border)",
								}),
							]}
						>
							<input type="hidden" name="back" value={back} />
							<p mix={[raw({ margin: "0", fontWeight: "600" })]}>Sold out in this size and frame</p>
							<p
								mix={[
									raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" }),
								]}
							>
								Pick another size above, or we'll email you when it's framed again.
							</p>
							<label htmlFor="hw-notify" mix={[raw({ fontSize: "0.875rem", fontWeight: "500" })]}>
								Email
							</label>
							<div mix={[raw({ display: "flex", gap: "0.5rem" })]}>
								<input
									id="hw-notify"
									type="email"
									name="email"
									required
									autocomplete="email"
									mix={[
										raw({
											flex: "1",
											minInlineSize: "0",
											blockSize: "2.75rem",
											paddingInline: "0.75rem",
											border: "1px solid var(--ui-neutral-border)",
											borderRadius: "var(--ui-cta-radius)",
											font: "inherit",
											backgroundColor: "var(--ui-bg)",
											color: "inherit",
										}),
									]}
								/>
								<button
									type="submit"
									mix={[
										raw({
											blockSize: "2.75rem",
											paddingInline: "1rem",
											border: "0",
											borderRadius: "var(--ui-cta-radius)",
											font: "inherit",
											fontWeight: "600",
											color: "var(--ui-bg)",
											backgroundColor: "var(--ui-neutral-fg-emphasis)",
											cursor: "pointer",
										}),
									]}
								>
									Notify me
								</button>
							</div>
						</form>
					)}
					<div mix={[raw({ display: "grid", gap: "0.5rem", fontSize: "0.9375rem" })]}>
						<FulfilmentNote kind={variant.format === "digital" ? "download" : "ships"}>
							{arrives}
						</FulfilmentNote>
						<p
							mix={[
								raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", fontSize: "0.875rem" }),
							]}
						>
							{variant.format === "digital"
								? "Print files can't be returned once downloaded."
								: "Free standard shipping over €75 · 30-day returns."}
						</p>
						<p
							mix={[
								raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", fontSize: "0.875rem" }),
							]}
						>
							{variantName(poster, variant)}
						</p>
					</div>
					<Details poster={poster} />
				</div>
			</div>
		);
	};
}

/** The description, paper and frame specs, and delivery, as disclosures. */
function Details(handle: Handle<{ poster: Poster }>) {
	return () => {
		let { poster } = handle.props;
		let artist = findArtist(poster.artist);
		let items = [
			{
				title: "About this poster",
				body: (
					<p>
						{poster.blurb} Drawn by {artist?.name} in {artist?.city}. {artist?.bio}
					</p>
				),
				open: true,
			},
			{
				title: "Paper, print and frame",
				body: (
					<ul>
						<li>230 gsm acid-free matte paper, pigment inks rated for 100 years indoors.</li>
						<li>Frames in solid oak or walnut, or painted black or white, 20 mm deep.</li>
						<li>Real glass up to 50 × 70; shatterproof acrylic at 70 × 100.</li>
						<li>The print file is a PDF and a JPEG, sized for up to 70 × 100 at 300 dpi.</li>
					</ul>
				),
				open: false,
			},
			{
				title: "Shipping and returns",
				body: (
					<p>
						Prints ship rolled in a tube in 3–5 working days, frames flat in 5–8. Standard shipping
						is free over €75. Return prints and frames within 30 days; print files can't be returned
						once downloaded.
					</p>
				),
				open: false,
			},
		];
		return (
			<div mix={[raw({ borderBlockStart: "1px solid var(--ui-neutral-border)" })]}>
				{items.map((item) => (
					<details
						open={item.open}
						mix={[
							raw({
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
								"& > summary": {
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									paddingBlock: "1rem",
									cursor: "pointer",
									listStyle: "none",
									fontWeight: "500",
								},
								"& > summary::-webkit-details-marker": { display: "none" },
								"& > summary svg": {
									inlineSize: "1.125rem",
									blockSize: "1.125rem",
									transition: "rotate 150ms",
								},
								"&[open] > summary svg": { rotate: "180deg" },
								"& p, & ul": {
									margin: "0 0 1rem",
									color: "var(--ui-neutral-fg-muted)",
									lineHeight: "1.6",
								},
								"& ul": { paddingInlineStart: "1.25rem" },
							}),
						]}
					>
						<summary>
							{item.title}
							<ChevronDownIcon />
						</summary>
						{item.body}
					</details>
				))}
			</div>
		);
	};
}

/** The size guide: every size in centimetres and inches, and what it suits. */
function SizeGuide(handle: Handle<{ poster: Poster }>) {
	return () => {
		let { poster } = handle.props;
		let inches = (cm: number) => (cm / 2.54).toFixed(1);
		return (
			<HeadingScope level={2}>
				<Dialog id={SIZE_GUIDE} aria-labelledby={`${SIZE_GUIDE}-title`}>
					<Dialog.Header>
						<Dialog.Title id={`${SIZE_GUIDE}-title`}>Size guide</Dialog.Title>
						<Dialog.Close commandfor={SIZE_GUIDE} aria-label="Close size guide" />
					</Dialog.Header>
					<div
						mix={[
							raw({ display: "grid", gap: "1rem", padding: "0 1.5rem 1.5rem", overflowX: "auto" }),
						]}
					>
						<table
							mix={[
								raw({
									borderCollapse: "collapse",
									inlineSize: "100%",
									fontSize: "0.9375rem",
									"& th, & td": {
										textAlign: "start",
										padding: "0.5rem 0.75rem 0.5rem 0",
										borderBlockEnd: "1px solid var(--ui-neutral-border)",
										verticalAlign: "top",
									},
									"& td:nth-child(2), & td:nth-child(3)": {
										fontVariantNumeric: "tabular-nums",
										whiteSpace: "nowrap",
									},
								}),
							]}
						>
							<thead>
								<tr>
									<th scope="col">Size</th>
									<th scope="col">Print, cm</th>
									<th scope="col">Print, in</th>
									<th scope="col">Suits</th>
								</tr>
							</thead>
							<tbody>
								{SIZES.map((size) => (
									<tr>
										<th scope="row">{sizeName(size, poster.orientation)}</th>
										<td>
											{size.width} × {size.height}
										</td>
										<td>
											{inches(size.width)} × {inches(size.height)}
										</td>
										<td>{size.fits}</td>
									</tr>
								))}
							</tbody>
						</table>
						<p
							mix={[
								raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", fontSize: "0.875rem" }),
							]}
						>
							A frame adds 2 cm on every side, a mount another 5. Above a sofa, aim for a print
							about two thirds of the sofa's width. The room view in the gallery shows each size to
							scale.
						</p>
						<a
							href={href(`frames?poster=${poster.id}`)}
							mix={[raw({ color: "inherit", fontWeight: "500" })]}
						>
							Compare every size on a wall
						</a>
					</div>
				</Dialog>
			</HeadingScope>
		);
	};
}

/** The reviews the address asks for: filtered by stars, sorted, and how many pages. */
export function readReviewQuery(params: URLSearchParams) {
	let stars = Number(params.get("stars"));
	let sort = params.get("review_sort");
	return {
		stars: Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : null,
		sort: sort === "helpful" || sort === "lowest" ? sort : "newest",
		pages: Math.min(Math.max(Number.parseInt(params.get("reviews_page") ?? "1", 10) || 1, 1), 10),
	};
}

/** How long ago a review was written, in words. */
function reviewAge(days: number): string {
	if (days === 1) return "Yesterday";
	return days < 31 ? `${days} days ago` : `${Math.round(days / 30)} months ago`;
}

namespace Reviews {
	export interface Props {
		poster: Poster;
		url: URL;
	}
}

/** The reviews: the rating breakdown (each bar filters), a sort, the cards and "Show more". */
export function Reviews(handle: Handle<Reviews.Props>) {
	return () => {
		let { poster, url } = handle.props;
		let all = reviewsFor(poster);
		let rating = ratingOf(poster);
		let query = readReviewQuery(url.searchParams);
		let link = (changes: Record<string, string | null>) => {
			let params = new URLSearchParams(url.searchParams);
			params.delete("toast");
			for (let [key, value] of Object.entries(changes)) {
				if (value === null) params.delete(key);
				else params.set(key, value);
			}
			return `${href(`p/${poster.id}`)}?${params}#reviews`;
		};
		let compare: Record<string, (a: Review, b: Review) => number> = {
			newest: (a, b) => a.daysAgo - b.daysAgo,
			helpful: (a, b) => b.helpful - a.helpful,
			lowest: (a, b) => a.rating - b.rating || a.daysAgo - b.daysAgo,
		};
		let shown = all
			.filter((review) => query.stars === null || review.rating === query.stars)
			.sort(compare[query.sort]);
		let page = shown.slice(0, query.pages * REVIEWS_PAGE);
		let recommend = Math.round(
			(all.filter((review) => review.rating >= 4).length / all.length) * 100,
		);
		let target = { "data-rmx-target": REVIEWS_FRAME, "data-rmx-reset-scroll": "false" as const };
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gap: "2rem",
						"@media (min-width: 56rem)": {
							gridTemplateColumns: "18rem minmax(0, 1fr)",
							alignItems: "start",
						},
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "1rem",
							"@media (min-width: 56rem)": { position: "sticky", insetBlockStart: "8rem" },
						}),
					]}
				>
					<RatingBreakdown
						score={rating.average}
						display={rating.average.toFixed(1)}
						count={`${rating.count} reviews`}
						outOf="out of 5"
					>
						<RatingBreakdown.Group kind="stars">
							{[5, 4, 3, 2, 1].map((stars) => {
								let count = all.filter((review) => review.rating === stars).length;
								return (
									<RatingBreakdown.Bar
										label={`${stars} stars`}
										value={count}
										max={all.length}
										display={String(count)}
									/>
								);
							})}
						</RatingBreakdown.Group>
					</RatingBreakdown>
					<p
						mix={[raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						{recommend}% would recommend it to a friend.
					</p>
					<nav
						aria-label="Filter reviews by stars"
						mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.375rem" })]}
					>
						{[null, 5, 4, 3, 2, 1].map((stars) => (
							<a
								href={link({ stars: stars === null ? null : String(stars), reviews_page: null })}
								{...target}
								aria-current={query.stars === stars ? "true" : undefined}
								mix={[
									raw({
										paddingInline: "0.75rem",
										blockSize: "2rem",
										display: "inline-flex",
										alignItems: "center",
										borderRadius: "999px",
										border: "1px solid var(--ui-neutral-border)",
										color: "inherit",
										textDecoration: "none",
										fontSize: "0.875rem",
										"&[aria-current]": {
											backgroundColor: "var(--ui-neutral-fg-emphasis)",
											color: "var(--ui-bg)",
											borderColor: "transparent",
										},
									}),
								]}
							>
								{stars === null ? "All" : `${stars} ★`}
							</a>
						))}
					</nav>
					<LinkButton href={href(`p/${poster.id}/review`)} variant="outline">
						Write a review
					</LinkButton>
				</div>
				<div mix={[raw({ display: "grid", gap: "1rem" })]}>
					<nav
						aria-label="Sort reviews"
						mix={[raw({ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.875rem" })]}
					>
						{[
							{ id: "newest", label: "Newest" },
							{ id: "helpful", label: "Most helpful" },
							{ id: "lowest", label: "Lowest rated" },
						].map((sort) => (
							<a
								href={link({ review_sort: sort.id, reviews_page: null })}
								{...target}
								aria-current={query.sort === sort.id ? "true" : undefined}
								mix={[
									raw({
										color: "var(--ui-neutral-fg-muted)",
										textDecoration: "none",
										"&[aria-current]": {
											color: "var(--ui-neutral-fg-emphasis)",
											fontWeight: "600",
											textDecoration: "underline",
											textUnderlineOffset: "0.35em",
										},
									}),
								]}
							>
								{sort.label}
							</a>
						))}
					</nav>
					{page.length === 0 ? (
						<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
							No {query.stars}-star reviews yet.
						</p>
					) : (
						page.map((review) => (
							<ReviewCard
								author={`${review.author} · ${review.city}`}
								rating={review.rating}
								title={review.title}
								body={review.body}
								date={reviewAge(review.daysAgo)}
								verified="Verified buyer"
								meta={variantName(poster, review.variant)}
								helpful={
									<form
										method="post"
										action={actionHref(`p/${poster.id}/helpful`)}
										data-rmx-target={REVIEWS_FRAME}
									>
										<input type="hidden" name="review" value={review.id} />
										<input type="hidden" name="back" value={`p/${poster.id}`} />
										<button
											type="submit"
											mix={[
												raw({
													padding: "0.25rem 0.625rem",
													border: "1px solid var(--ui-neutral-border)",
													borderRadius: "999px",
													background: "none",
													font: "inherit",
													fontSize: "0.8125rem",
													color: "inherit",
													cursor: "pointer",
												}),
											]}
										>
											Helpful ({review.helpful})
										</button>
									</form>
								}
							/>
						))
					)}
					{shown.length > page.length ? (
						<a
							href={link({ reviews_page: String(query.pages + 1) })}
							{...target}
							mix={[raw({ justifySelf: "start", color: "inherit", fontWeight: "500" })]}
						>
							Show more reviews ({shown.length - page.length})
						</a>
					) : null}
				</div>
			</div>
		);
	};
}

namespace ProductPage {
	export interface Props {
		poster: Poster;
		url: URL;
		visitor: Visitor;
		back: string;
	}
}

/** A poster's whole page. */
export default function ProductPage(handle: Handle<ProductPage.Props>) {
	return () => {
		let { back, poster, url, visitor } = handle.props;
		let style = STYLES.find((entry) => entry.id === poster.style)!;
		let questions = questionsFor(poster);
		let rating = ratingOf(poster);
		let byArtist = POSTERS.filter(
			(other) => other.artist === poster.artist && other.id !== poster.id,
		);
		let alike = POSTERS.filter(
			(other) => other.style === poster.style && other.artist !== poster.artist,
		);
		let recent = visitor.recent
			.filter((id) => id !== poster.id)
			.map((id) => POSTERS.find((other) => other.id === id))
			.filter((other) => other !== undefined);
		let source = `${url.pathname}${url.search}`;
		return (
			<>
				<Gutter>
					<div mix={[raw({ paddingBlock: "1rem" })]}>
						<Breadcrumbs aria-label="Breadcrumb">
							<Breadcrumbs.List>
								<Breadcrumbs.Item>
									<Breadcrumbs.Link href={href("shop")}>Shop</Breadcrumbs.Link>
								</Breadcrumbs.Item>
								<Breadcrumbs.Item>
									<Breadcrumbs.Link href={href(`shop/${style.id}`)}>{style.name}</Breadcrumbs.Link>
								</Breadcrumbs.Item>
								<Breadcrumbs.Item aria-current="page">{poster.title}</Breadcrumbs.Item>
							</Breadcrumbs.List>
						</Breadcrumbs>
					</div>
					<Frame name={BUY_FRAME} src={source} />
				</Gutter>
				<div mix={[raw({ marginBlockStart: "clamp(2rem, 6vw, 4rem)" })]}>
					<SectionBar
						id="hw-product-sections"
						label="On this page"
						top="4rem"
						items={[
							{ id: "reviews", label: "Reviews", count: rating.count },
							{ id: "questions", label: "Questions", count: questions.length },
							{ id: "more", label: "More like this" },
						]}
					/>
				</div>
				<Gutter>
					<section
						id="reviews"
						aria-labelledby="reviews-title"
						mix={[
							raw({
								display: "grid",
								gap: "1.5rem",
								paddingBlock: "2rem",
								scrollMarginBlockStart: "8rem",
							}),
						]}
					>
						<h2
							id="reviews-title"
							mix={[
								raw({ margin: "0", fontSize: "clamp(1.375rem, 3vw, 1.875rem)", fontWeight: "500" }),
							]}
						>
							Reviews
						</h2>
						<Frame name={REVIEWS_FRAME} src={source} />
					</section>
					<section
						id="questions"
						aria-labelledby="questions-title"
						mix={[
							raw({
								display: "grid",
								gap: "1.5rem",
								paddingBlock: "2rem",
								scrollMarginBlockStart: "8rem",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						<h2
							id="questions-title"
							mix={[
								raw({ margin: "0", fontSize: "clamp(1.375rem, 3vw, 1.875rem)", fontWeight: "500" }),
							]}
						>
							Questions and answers
						</h2>
						<QuestionList
							labels={{ answers: "{n} answers" }}
							questions={questions.map((question) => ({
								id: question.id,
								question: question.question,
								meta: `Asked ${question.daysAgo} days ago`,
								answers: question.answers.map((answer) => ({
									id: `${question.id}-${answer.id}`,
									author: answer.author,
									badge: answer.staff ? "Hangwell" : "Buyer",
									body: answer.body,
									meta: `${answer.helpful} found this helpful`,
								})),
							}))}
						/>
						<form
							method="post"
							action={actionHref(`p/${poster.id}/ask`)}
							mix={[raw({ display: "grid", gap: "0.5rem", maxInlineSize: "36rem" })]}
						>
							<input type="hidden" name="back" value={`p/${poster.id}`} />
							<label htmlFor="hw-ask" mix={[raw({ fontWeight: "500" })]}>
								Ask about this poster
							</label>
							<textarea
								id="hw-ask"
								name="question"
								required
								minlength={10}
								maxlength={300}
								rows={3}
								placeholder="Will the colours fade in a sunny room?"
								mix={[
									raw({
										font: "inherit",
										padding: "0.75rem",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "var(--ui-radius-md)",
										backgroundColor: "var(--ui-bg)",
										color: "inherit",
										resize: "vertical",
									}),
								]}
							/>
							<button
								type="submit"
								mix={[
									raw({
										justifySelf: "start",
										blockSize: "2.75rem",
										paddingInline: "1.25rem",
										border: "1px solid var(--ui-neutral-fg-emphasis)",
										borderRadius: "var(--ui-cta-radius)",
										background: "none",
										font: "inherit",
										fontWeight: "600",
										color: "inherit",
										cursor: "pointer",
									}),
								]}
							>
								Send question
							</button>
						</form>
					</section>
					<div
						id="more"
						mix={[
							raw({
								scrollMarginBlockStart: "8rem",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						<Shelf
							id="hw-artist-more"
							title={`More by ${findArtist(poster.artist)?.name}`}
							posters={byArtist}
							wish={visitor.wish}
							back={back}
							link={{ href: href(`artists/${poster.artist}`), label: "See the artist" }}
						/>
						<Shelf
							id="hw-alike"
							title={`More ${style.name.toLowerCase()} posters`}
							posters={alike}
							wish={visitor.wish}
							back={back}
							link={{ href: href(`shop/${style.id}`), label: `Shop ${style.name}` }}
						/>
						<Shelf
							id="hw-recent"
							title="Recently viewed"
							posters={recent}
							wish={visitor.wish}
							back={back}
						/>
					</div>
				</Gutter>
				<SizeGuide poster={poster} />
				<RecentLive
					poster={poster.id}
					cookie={RECENT_COOKIE}
					path={demoAppCookiePath(SLUG)}
					limit={MAX_RECENT}
				/>
			</>
		);
	};
}
