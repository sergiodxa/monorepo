/**
 * The shop's other ways in and the help it offers: the artists and each artist's page, a frames
 * and sizes guide that hangs every size on the same wall, search results with a "did you mean",
 * the shipping help page, and the form for writing a review.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { LinkButton } from "@sdxc/ui/link-button";
import { RatingInput } from "@sdxc/ui/rating-input";

import type { Artist, Poster } from "./data";
import type { Visitor } from "./state";

import { FramedArt, PosterArt, RoomArt } from "./art";
import { didYouMean, searchPosters, suggest } from "./catalog";
import {
	ARTISTS,
	FRAMES,
	FREE_SHIPPING_FROM,
	OVERSIZE_FEE,
	POSTERS,
	SHIPPING,
	SIZES,
	actionHref,
	findPoster,
	href,
	money,
	sizeName,
} from "./data";
import { EYEBROW, Gutter, PageTitle, PosterGrid, WALL } from "./parts";

/** Every artist with a framed print of their best-known poster. */
export function ArtistsPage() {
	return () => (
		<Gutter>
			<PageTitle
				eyebrow="Artists"
				lead="Eight independent illustrators and designers. Every sale pays them a third of the price."
			>
				The people behind the posters
			</PageTitle>
			<ul
				mix={[
					raw({
						listStyle: "none",
						margin: "0",
						padding: "0",
						display: "grid",
						gap: "clamp(1rem, 3vw, 2rem)",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(16rem, 100%), 1fr))",
					}),
				]}
			>
				{ARTISTS.map((artist) => {
					let posters = POSTERS.filter((poster) => poster.artist === artist.id);
					let lead = [...posters].sort((a, b) => a.featured - b.featured)[0]!;
					return (
						<li>
							<a
								href={href(`artists/${artist.id}`)}
								mix={[
									raw({
										display: "grid",
										gap: "0.625rem",
										color: "inherit",
										textDecoration: "none",
									}),
									when("&:hover strong", raw({ textDecoration: "underline" })),
								]}
							>
								<span
									mix={[
										raw({
											display: "grid",
											placeItems: "center",
											aspectRatio: "1",
											padding: "14% 22%",
											backgroundColor: WALL,
											borderRadius: "var(--ui-radius-md)",
										}),
									]}
								>
									<FramedArt poster={lead} frame="black" mount />
								</span>
								<strong mix={[raw({ fontWeight: "600", fontSize: "1.0625rem" })]}>
									{artist.name}
								</strong>
								<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
									{artist.city} · {posters.length} posters
								</span>
							</a>
						</li>
					);
				})}
			</ul>
		</Gutter>
	);
}

/** One artist: their bio and every poster of theirs. */
export function ArtistPage(handle: Handle<{ artist: Artist; visitor: Visitor }>) {
	return () => {
		let { artist, visitor } = handle.props;
		let posters = POSTERS.filter((poster) => poster.artist === artist.id).sort(
			(a, b) => a.featured - b.featured,
		);
		return (
			<Gutter>
				<PageTitle eyebrow={`Artist · ${artist.city}`} lead={artist.bio}>
					{artist.name}
				</PageTitle>
				<PosterGrid
					posters={posters}
					wish={visitor.wish}
					back={`artists/${artist.id}`}
					label={`Posters by ${artist.name}`}
				/>
			</Gutter>
		);
	};
}

/**
 * The frames and sizes guide: each frame finish, and every size of one poster hung above the
 * same sofa, drawn to scale, so sizes compare at a glance.
 */
export function FramesPage(handle: Handle<{ url: URL }>) {
	return () => {
		let poster: Poster =
			findPoster(handle.props.url.searchParams.get("poster") ?? "") ??
			findPoster("monsoon-leaves")!;
		return (
			<Gutter>
				<PageTitle
					eyebrow="Frames & sizes"
					lead="Every frame is solid wood or painted wood, 20 mm deep, with glass and a cord fitted. Prints also come unframed, or as a file."
				>
					Pick a size you'll love on the wall
				</PageTitle>
				<section
					aria-labelledby="hw-sizes"
					mix={[raw({ display: "grid", gap: "1rem", paddingBlockEnd: "2.5rem" })]}
				>
					<h2 id="hw-sizes" mix={[raw({ margin: "0", fontSize: "1.375rem", fontWeight: "500" })]}>
						Every size above a 210 cm sofa
					</h2>
					<ul
						mix={[
							raw({
								listStyle: "none",
								margin: "0",
								padding: "0",
								display: "grid",
								gap: "1rem",
								gridTemplateColumns: "repeat(auto-fit, minmax(min(18rem, 100%), 1fr))",
							}),
						]}
					>
						{SIZES.map((size) => (
							<li mix={[raw({ display: "grid", gap: "0.5rem" })]}>
								<span
									mix={[
										raw({
											display: "block",
											borderRadius: "var(--ui-radius-md)",
											overflow: "clip",
										}),
									]}
								>
									<RoomArt
										poster={poster}
										size={size}
										frame="oak"
										label={`${poster.title} at ${sizeName(size, poster.orientation)} above a sofa`}
									/>
								</span>
								<strong mix={[raw({ fontWeight: "600" })]}>
									{sizeName(size, poster.orientation)}
								</strong>
								<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
									{size.fits} Print from {money(size.print)}, framed from {money(size.framed)}.
								</span>
							</li>
						))}
					</ul>
				</section>
				<section aria-labelledby="hw-finishes" mix={[raw({ display: "grid", gap: "1rem" })]}>
					<h2
						id="hw-finishes"
						mix={[raw({ margin: "0", fontSize: "1.375rem", fontWeight: "500" })]}
					>
						Four finishes
					</h2>
					<ul
						mix={[
							raw({
								listStyle: "none",
								margin: "0",
								padding: "0",
								display: "grid",
								gap: "1rem",
								gridTemplateColumns: "repeat(auto-fit, minmax(min(11rem, 45%), 1fr))",
							}),
						]}
					>
						{FRAMES.map((frame) => (
							<li mix={[raw({ display: "grid", gap: "0.5rem" })]}>
								<span
									mix={[
										raw({
											display: "grid",
											placeItems: "center",
											padding: "12% 22%",
											backgroundColor: WALL,
											borderRadius: "var(--ui-radius-md)",
										}),
									]}
								>
									<FramedArt poster={poster} frame={frame.id} />
								</span>
								<strong mix={[raw({ fontWeight: "600" })]}>{frame.name}</strong>
								<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
									{frame.surcharge === 0
										? "Included in the framed price"
										: `+${money(frame.surcharge)}`}
								</span>
							</li>
						))}
					</ul>
					<LinkButton href={href(`p/${poster.id}`)} color="brand">
						Choose a size for {poster.title}
					</LinkButton>
				</section>
			</Gutter>
		);
	};
}

/** Search results: posters first, then matching artists and collections, or a way forward. */
export function SearchPage(handle: Handle<{ query: string; visitor: Visitor }>) {
	return () => {
		let { query, visitor } = handle.props;
		let trimmed = query.trim();
		let posters = searchPosters(trimmed);
		let others = suggest(trimmed).filter((entry) => entry.kind !== "poster");
		let typo = posters.length === 0 ? didYouMean(trimmed) : null;
		return (
			<Gutter>
				<PageTitle
					eyebrow="Search"
					lead={
						trimmed === ""
							? "Search by title, artist, colour, style or room."
							: `${posters.length} ${posters.length === 1 ? "poster" : "posters"}`
					}
				>
					{trimmed === "" ? "What are you looking for?" : `“${trimmed}”`}
				</PageTitle>
				<form
					method="get"
					action={href("search")}
					role="search"
					mix={[
						raw({
							display: "flex",
							gap: "0.5rem",
							maxInlineSize: "36rem",
							marginBlockEnd: "1.5rem",
							"@media (min-width: 56rem)": { display: "none" },
						}),
					]}
				>
					<label
						htmlFor="hw-search-page"
						mix={[
							raw({
								position: "absolute",
								inlineSize: "1px",
								blockSize: "1px",
								overflow: "hidden",
								clipPath: "inset(50%)",
							}),
						]}
					>
						Search posters
					</label>
					<input
						id="hw-search-page"
						type="search"
						name="q"
						value={trimmed}
						placeholder="Search posters"
						mix={[
							raw({
								flex: "1",
								minInlineSize: "0",
								blockSize: "3rem",
								paddingInline: "1rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "999px",
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
								blockSize: "3rem",
								paddingInline: "1.25rem",
								border: "0",
								borderRadius: "999px",
								font: "inherit",
								fontWeight: "600",
								color: "var(--ui-bg)",
								backgroundColor: "var(--ui-neutral-fg-emphasis)",
								cursor: "pointer",
							}),
						]}
					>
						Search
					</button>
				</form>
				{others.length === 0 ? null : (
					<nav
						aria-label="Matching artists and collections"
						mix={[
							raw({ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBlockEnd: "1.5rem" }),
						]}
					>
						{others.map((entry) => (
							<a
								href={href(entry.kind === "artist" ? `artists/${entry.id}` : `shop/${entry.id}`)}
								mix={[
									raw({
										display: "inline-flex",
										gap: "0.375rem",
										alignItems: "baseline",
										paddingInline: "0.875rem",
										blockSize: "2.25rem",
										lineHeight: "2.25rem",
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "999px",
										color: "inherit",
										textDecoration: "none",
									}),
								]}
							>
								<span>{entry.label}</span>
								<span mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
									{entry.detail}
								</span>
							</a>
						))}
					</nav>
				)}
				{posters.length > 0 ? (
					<PosterGrid
						posters={posters}
						wish={visitor.wish}
						back={`search?q=${encodeURIComponent(trimmed)}`}
						label={`Results for ${trimmed}`}
					/>
				) : null}
				{posters.length === 0 && trimmed === "" ? (
					<PosterGrid
						posters={[...POSTERS].sort((a, b) => a.featured - b.featured).slice(0, 8)}
						wish={visitor.wish}
						back="search"
						label="Popular posters"
					/>
				) : null}
				{posters.length > 0 || trimmed === "" ? null : (
					<div mix={[raw({ display: "grid", gap: "0.75rem", paddingBlock: "2rem" })]}>
						<p mix={[raw({ margin: "0", fontSize: "1.125rem" })]}>
							Nothing matches “{trimmed}”.
							{typo === null ? null : (
								<>
									{" "}
									Did you mean{" "}
									<a
										href={href(`search?q=${encodeURIComponent(typo)}`)}
										mix={[raw({ color: "inherit", fontWeight: "600" })]}
									>
										{typo}
									</a>
									?
								</>
							)}
						</p>
						<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
							Try a colour like “ochre”, a room like “kitchen”, or browse everything.
						</p>
						<LinkButton href={href("shop")} variant="outline">
							Browse all posters
						</LinkButton>
					</div>
				)}
			</Gutter>
		);
	};
}

/** How shipping works, with the prices from the same table checkout uses. */
export function ShippingHelp() {
	return () => (
		<Gutter narrow>
			<PageTitle eyebrow="Help">Shipping and delivery</PageTitle>
			<div
				mix={[
					raw({
						display: "grid",
						gap: "1.25rem",
						maxInlineSize: "40rem",
						lineHeight: "1.6",
						"& p": { margin: "0" },
					}),
				]}
			>
				<p>
					Prints are made to order and ship rolled in a tube. Frames are made by hand and ship flat.
					Print files download as soon as you check out.
				</p>
				<table
					mix={[
						raw({
							borderCollapse: "collapse",
							"& th, & td": {
								textAlign: "start",
								padding: "0.625rem 1rem 0.625rem 0",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
							},
						}),
					]}
				>
					<thead>
						<tr>
							<th scope="col">Method</th>
							<th scope="col">Working days</th>
							<th scope="col">Price</th>
						</tr>
					</thead>
					<tbody>
						{SHIPPING.map((method) => (
							<tr>
								<th scope="row">{method.name}</th>
								<td>
									{method.days[0] === method.days[1]
										? method.days[0]
										: `${method.days[0]}–${method.days[1]}`}
								</td>
								<td>{method.price === 0 ? "Free" : money(method.price)}</td>
							</tr>
						))}
					</tbody>
				</table>
				<p>
					Standard shipping is free once the prints and frames in your bag reach{" "}
					{money(FREE_SHIPPING_FROM)}. A 70 × 100 frame ships as an oversize parcel for{" "}
					{money(OVERSIZE_FEE)} more. Framing adds two to three working days.
				</p>
				<p mix={[raw({ ...EYEBROW, textTransform: "none", letterSpacing: "0" })]}>
					This is a demo store: nothing ships.
				</p>
			</div>
		</Gutter>
	);
}

namespace ReviewForm {
	export interface Props {
		poster: Poster;
		errors?: Record<string, string>;
		values?: Record<string, string>;
	}
}

/** Writing a review: stars, a title, the review and a name, each kept on an error. */
export function ReviewForm(handle: Handle<ReviewForm.Props>) {
	return () => {
		let { errors = {}, poster, values = {} } = handle.props;
		let input = raw({
			blockSize: "3rem",
			paddingInline: "0.875rem",
			border: "1px solid var(--ui-neutral-border)",
			borderRadius: "var(--ui-radius-md)",
			font: "inherit",
			backgroundColor: "var(--ui-bg)",
			color: "inherit",
			"&[aria-invalid]": { borderColor: "oklch(0.55 0.2 25)" },
		});
		let error = (name: string) =>
			errors[name] === undefined ? null : (
				<p
					id={`hw-review-${name}-error`}
					mix={[raw({ margin: "0", fontSize: "0.8125rem", color: "oklch(0.5 0.2 25)" })]}
				>
					{errors[name]}
				</p>
			);
		return (
			<Gutter narrow>
				<PageTitle eyebrow={poster.title}>Write a review</PageTitle>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "2rem",
							"@media (min-width: 48rem)": { gridTemplateColumns: "12rem minmax(0, 1fr)" },
						}),
					]}
				>
					<span
						mix={[
							raw({
								display: "block",
								padding: "1rem",
								backgroundColor: WALL,
								borderRadius: "var(--ui-radius-md)",
								alignSelf: "start",
							}),
						]}
					>
						<PosterArt poster={poster} label={poster.title} />
					</span>
					<form
						method="post"
						action={actionHref(`p/${poster.id}/review`)}
						novalidate
						mix={[
							raw({
								display: "grid",
								gap: "1rem",
								maxInlineSize: "36rem",
								"& label": { fontSize: "0.875rem", fontWeight: "500" },
							}),
						]}
					>
						<RatingInput
							name="rating"
							required
							value={Number(values.rating) || undefined}
							legend="Your rating"
							labels={[
								"1 star, poor",
								"2 stars, fair",
								"3 stars, good",
								"4 stars, very good",
								"5 stars, excellent",
							]}
						/>
						{error("rating")}
						<label htmlFor="hw-review-title">Title</label>
						<input
							id="hw-review-title"
							name="title"
							value={values.title ?? ""}
							maxlength={80}
							mix={[input]}
						/>
						<label htmlFor="hw-review-body">Your review</label>
						<textarea
							id="hw-review-body"
							name="body"
							rows={5}
							required
							aria-invalid={errors.body === undefined ? undefined : "true"}
							aria-describedby={errors.body === undefined ? undefined : "hw-review-body-error"}
							mix={[
								raw({
									font: "inherit",
									padding: "0.75rem",
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "var(--ui-radius-md)",
									backgroundColor: "var(--ui-bg)",
									color: "inherit",
									"&[aria-invalid]": { borderColor: "oklch(0.55 0.2 25)" },
								}),
							]}
							defaultValue={values.body ?? ""}
						/>
						{error("body")}
						<label htmlFor="hw-review-name">Name shown with the review</label>
						<input
							id="hw-review-name"
							name="name"
							value={values.name ?? "Maya"}
							required
							autocomplete="name"
							aria-invalid={errors.name === undefined ? undefined : "true"}
							mix={[input]}
						/>
						{error("name")}
						<div mix={[raw({ display: "flex", gap: "1rem", alignItems: "center" })]}>
							<button
								type="submit"
								mix={[
									raw({
										blockSize: "3rem",
										paddingInline: "1.5rem",
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
								Send review
							</button>
							<a href={`${href(`p/${poster.id}`)}#reviews`} mix={[raw({ color: "inherit" })]}>
								Cancel
							</a>
						</div>
					</form>
				</div>
			</Gutter>
		);
	};
}
