/**
 * Hangwell's home: a poster hung to scale above a sofa as the hero, the styles as drawn tiles,
 * best sellers and new posters on shelves, the frame and size story, an artist to meet, the
 * posters the visitor looked at last, and the studio's promises.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { LinkButton } from "@sdxc/ui/link-button";

import type { Visitor } from "./state";

import { FramedArt, PosterArt, RoomArt } from "./art";
import { collectionPosters } from "./catalog";
import { ARTISTS, POSTERS, STYLES, findPoster, findSize, href } from "./data";
import { EYEBROW, Gutter, Shelf, WALL } from "./parts";

/** The home screen. */
export default function Home(handle: Handle<{ visitor: Visitor }>) {
	return () => {
		let { visitor } = handle.props;
		let hero = findPoster("ninefold-sun")!;
		let bestSellers = [...POSTERS].sort((a, b) => a.featured - b.featured).slice(0, 8);
		let newest = [...POSTERS].sort((a, b) => b.added - a.added).slice(0, 8);
		let recent = visitor.recent
			.map((id) => findPoster(id))
			.filter((poster) => poster !== undefined);
		let artist = ARTISTS[1]!;
		let byArtist = POSTERS.filter((poster) => poster.artist === artist.id);
		return (
			<>
				<section mix={[raw({ backgroundColor: WALL })]}>
					<Gutter>
						<div
							mix={[
								raw({
									display: "grid",
									gap: "clamp(1.5rem, 4vw, 3rem)",
									alignItems: "center",
									paddingBlock: "clamp(2rem, 6vw, 5rem)",
									"@media (min-width: 56rem)": {
										gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)",
									},
								}),
							]}
						>
							<div mix={[raw({ display: "grid", gap: "1.25rem", justifyItems: "start" })]}>
								<p mix={[raw(EYEBROW)]}>Printed to order in Porto</p>
								<h1
									mix={[
										raw({
											margin: "0",
											fontSize: "clamp(2.25rem, 6vw, 4.25rem)",
											fontWeight: "500",
											letterSpacing: "-0.035em",
											lineHeight: "1",
											textWrap: "balance",
										}),
									]}
								>
									Art worth a nail in the wall.
								</h1>
								<p
									mix={[
										raw({
											margin: "0",
											fontSize: "1.125rem",
											color: "var(--ui-neutral-fg-muted)",
											maxInlineSize: "30rem",
											textWrap: "pretty",
										}),
									]}
								>
									Posters by eight independent artists. Download the print file, get it printed on
									heavy matte paper, or have it framed by hand in oak or walnut.
								</p>
								<div mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.75rem" })]}>
									<LinkButton href={href("shop")} color="brand" size="lg">
										Shop all posters
									</LinkButton>
									<LinkButton href={href(`p/${hero.id}`)} variant="outline" size="lg">
										See {hero.title}
									</LinkButton>
								</div>
							</div>
							<a
								href={href(`p/${hero.id}?format=framed&size=70x100&frame=walnut&image=room`)}
								aria-label={`${hero.title}, framed in walnut at 70 × 100 cm above a sofa`}
								mix={[
									raw({ display: "block", borderRadius: "var(--ui-radius-lg)", overflow: "clip" }),
								]}
							>
								<RoomArt
									poster={hero}
									size={findSize("70x100")!}
									frame="walnut"
									label={`${hero.title} hung above a sofa`}
								/>
							</a>
						</div>
					</Gutter>
				</section>
				<Gutter>
					<Promises />
					<section
						aria-labelledby="hw-styles"
						mix={[raw({ display: "grid", gap: "1rem", paddingBlock: "clamp(1.5rem, 4vw, 3rem)" })]}
					>
						<h2
							id="hw-styles"
							mix={[
								raw({
									margin: "0",
									fontSize: "clamp(1.25rem, 2.5vw, 1.625rem)",
									fontWeight: "500",
								}),
							]}
						>
							Shop by style
						</h2>
						<ul
							mix={[
								raw({
									listStyle: "none",
									margin: "0",
									padding: "0",
									display: "grid",
									gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
									gap: "clamp(0.75rem, 2vw, 1.25rem)",
									"@media (min-width: 40rem)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
									"@media (min-width: 72rem)": { gridTemplateColumns: "repeat(6, minmax(0, 1fr))" },
								}),
							]}
						>
							{STYLES.map((style) => {
								let first = collectionPosters(style)[0]!;
								return (
									<li>
										<a
											href={href(`shop/${style.id}`)}
											mix={[
												raw({
													display: "grid",
													gap: "0.625rem",
													color: "inherit",
													textDecoration: "none",
													"&:hover > span:first-child": { scale: "1.02" },
												}),
											]}
										>
											<span
												mix={[
													raw({
														display: "grid",
														placeItems: "center",
														aspectRatio: "1",
														padding: "16%",
														backgroundColor: WALL,
														borderRadius: "var(--ui-radius-md)",
														transition: "scale 200ms ease",
													}),
												]}
											>
												<span
													mix={[
														raw({
															inlineSize: first.orientation === "portrait" ? "72%" : "100%",
															filter: "drop-shadow(0 6px 10px oklch(0.2 0.01 60 / 0.16))",
														}),
													]}
												>
													<PosterArt poster={first} />
												</span>
											</span>
											<span mix={[raw({ fontWeight: "500" })]}>{style.name}</span>
										</a>
									</li>
								);
							})}
						</ul>
					</section>
					<Shelf
						id="hw-best"
						title="Best sellers"
						posters={bestSellers}
						wish={visitor.wish}
						back=""
						link={{ href: href("shop"), label: "Shop all" }}
					/>
					<SizeStory />
					<Shelf
						id="hw-new"
						title="New in"
						posters={newest}
						wish={visitor.wish}
						back=""
						link={{ href: href("shop?sort=newest"), label: "See what's new" }}
					/>
					<section
						aria-labelledby="hw-artist"
						mix={[
							raw({
								display: "grid",
								gap: "1.5rem",
								alignItems: "center",
								paddingBlock: "clamp(1.5rem, 4vw, 3rem)",
								"@media (min-width: 56rem)": {
									gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
								},
							}),
						]}
					>
						<div
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
									gap: "1rem",
									padding: "clamp(1rem, 3vw, 2rem)",
									backgroundColor: WALL,
									borderRadius: "var(--ui-radius-lg)",
								}),
							]}
						>
							{byArtist.slice(0, 2).map((poster) => (
								<FramedArt
									poster={poster}
									frame={poster.id === "port-anselm" ? "black" : "oak"}
									mount
								/>
							))}
						</div>
						<div mix={[raw({ display: "grid", gap: "0.75rem", justifyItems: "start" })]}>
							<p mix={[raw(EYEBROW)]}>Meet the artist</p>
							<h2
								id="hw-artist"
								mix={[
									raw({
										margin: "0",
										fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
										fontWeight: "500",
										letterSpacing: "-0.02em",
									}),
								]}
							>
								{artist.name}, {artist.city}
							</h2>
							<p
								mix={[
									raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", maxInlineSize: "32rem" }),
								]}
							>
								{artist.bio}
							</p>
							<LinkButton href={href(`artists/${artist.id}`)} variant="outline">
								See all {byArtist.length} posters
							</LinkButton>
						</div>
					</section>
					<Shelf
						id="hw-recent"
						title="Recently viewed"
						posters={recent}
						wish={visitor.wish}
						back=""
					/>
				</Gutter>
			</>
		);
	};
}

/** The studio's promises in one quiet row. */
function Promises() {
	return () => (
		<ul
			mix={[
				raw({
					listStyle: "none",
					margin: "0",
					padding: "1.25rem 0",
					display: "grid",
					gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
					gap: "1rem",
					borderBlockEnd: "1px solid var(--ui-neutral-border)",
					fontSize: "0.875rem",
					"@media (min-width: 56rem)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
					"& strong": { display: "block", fontWeight: "600" },
					"& span": { color: "var(--ui-neutral-fg-muted)" },
				}),
			]}
		>
			<li>
				<strong>Printed to order</strong>
				<span>Pigment inks on 230 gsm matte paper.</span>
			</li>
			<li>
				<strong>Framed by hand</strong>
				<span>Oak, walnut, black or white, with real glass.</span>
			</li>
			<li>
				<strong>Free shipping over €75</strong>
				<span>Tracked, in a tube or a flat box.</span>
			</li>
			<li>
				<strong>30-day returns</strong>
				<span>On prints and frames. Files download instantly.</span>
			</li>
		</ul>
	);
}

/** The three formats side by side: a file, a print and the same print framed. */
function SizeStory() {
	return () => {
		let poster = findPoster("fern-study")!;
		return (
			<section
				aria-labelledby="hw-formats"
				mix={[raw({ display: "grid", gap: "1.5rem", paddingBlock: "clamp(1.5rem, 4vw, 3rem)" })]}
			>
				<div mix={[raw({ display: "grid", gap: "0.5rem", maxInlineSize: "40rem" })]}>
					<p mix={[raw(EYEBROW)]}>One poster, three ways</p>
					<h2
						id="hw-formats"
						mix={[
							raw({
								margin: "0",
								fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
								fontWeight: "500",
								letterSpacing: "-0.02em",
							}),
						]}
					>
						Download it, print it, or hang it today.
					</h2>
				</div>
				<ol
					mix={[
						raw({
							listStyle: "none",
							margin: "0",
							padding: "0",
							display: "grid",
							gap: "1rem",
							"@media (min-width: 40rem)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
						}),
					]}
				>
					{[
						{
							title: "Print file",
							text: "A PDF and a JPEG, ready for your own printer or a print shop. Yours in seconds.",
							art: <PosterArt poster={poster} />,
							href: href(`p/${poster.id}?format=digital`),
						},
						{
							title: "Print",
							text: "Printed on heavy matte paper and sent in a tube. Four sizes, A4 to 70 × 100.",
							art: <FramedArt poster={poster} frame={null} />,
							href: href(`p/${poster.id}?format=print&size=a3`),
						},
						{
							title: "Framed",
							text: "In oak, walnut, black or white, with glass and a cord already fitted.",
							art: <FramedArt poster={poster} frame="oak" mount />,
							href: href(`p/${poster.id}?format=framed&size=50x70&frame=oak&mount=1`),
						},
					].map((step) => (
						<li>
							<a
								href={step.href}
								mix={[
									raw({
										display: "grid",
										gap: "0.75rem",
										color: "inherit",
										textDecoration: "none",
										padding: "1.25rem",
										borderRadius: "var(--ui-radius-lg)",
										border: "1px solid var(--ui-neutral-border)",
										blockSize: "100%",
										boxSizing: "border-box",
									}),
								]}
							>
								<span
									mix={[
										raw({
											display: "grid",
											placeItems: "center",
											aspectRatio: "4 / 3",
											backgroundColor: WALL,
											borderRadius: "var(--ui-radius-md)",
											padding: "1rem 25%",
										}),
									]}
								>
									{step.art}
								</span>
								<strong mix={[raw({ fontWeight: "600" })]}>{step.title}</strong>
								<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", fontSize: "0.9375rem" })]}>
									{step.text}
								</span>
							</a>
						</li>
					))}
				</ol>
			</section>
		);
	};
}
