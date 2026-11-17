/**
 * Vesper's grids: series and films filtered by a genre chip kept in the address, one genre's
 * page, search, and My List. Each is a heading, its filters and a poster grid, with an empty
 * state that says why it is empty and where to go instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { SearchIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { LinkButton } from "@sdxc/ui";

import type { Genre, Title } from "./data";
import type { Viewer } from "./state";

import { GENRES, TRENDING, findTitle, href, searchTitles, visibleTitles } from "./data";
import { Blank, Chips, Gutter, PosterGrid, ScreenHeading } from "./parts";

namespace Catalogue {
	export interface Props {
		viewer: Viewer;
		kind: "series" | "film";
		/** The genre chip applied, from the address. */
		genre: Genre | undefined;
	}
}

/** Every series or every film, narrowed by the genre in the address. */
export function Catalogue(handle: Handle<Catalogue.Props>) {
	return () => {
		let { genre, kind, viewer } = handle.props;
		let page = kind === "series" ? "series" : "films";
		let all = visibleTitles(viewer.profile).filter((title) => title.kind === kind);
		let shown = genre === undefined ? all : all.filter((title) => title.genres.includes(genre.id));
		let heading = kind === "series" ? "Series" : "Films";
		let offered = GENRES.filter((entry) => all.some((title) => title.genres.includes(entry.id)));
		return (
			<>
				<ScreenHeading title={heading}>
					<Chips
						label={`Filter ${heading.toLowerCase()} by genre`}
						chips={[
							{ label: "All", page, current: genre === undefined },
							...offered.map((entry) => ({
								label: entry.name,
								page: `${page}?genre=${entry.id}`,
								current: entry.id === genre?.id,
							})),
						]}
					/>
				</ScreenHeading>
				<Gutter>
					{shown.length === 0 ? (
						<Blank
							title={`No ${heading.toLowerCase()} in ${genre?.name ?? "this genre"}`}
							action={<LinkButton href={href(page)}>Show all {heading.toLowerCase()}</LinkButton>}
						>
							Try another genre, or see everything Vesper has.
						</Blank>
					) : (
						<PosterGrid
							titles={shown}
							variant={`${page}-grid`}
							label={genre === undefined ? heading : `${heading}, ${genre.name}`}
						/>
					)}
				</Gutter>
			</>
		);
	};
}

/** One genre's page across series and films. */
export function GenrePage(handle: Handle<{ viewer: Viewer; genre: Genre }>) {
	return () => {
		let { genre, viewer } = handle.props;
		let titles = visibleTitles(viewer.profile).filter((title) => title.genres.includes(genre.id));
		return (
			<>
				<ScreenHeading title={genre.name}>
					<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
						{titles.length} {titles.length === 1 ? "title" : "titles"}
					</p>
				</ScreenHeading>
				<Gutter>
					{titles.length === 0 ? (
						<Blank
							title="Nothing here for this profile"
							action={<LinkButton href={href()}>Back to home</LinkButton>}
						>
							The Kids profile shows titles rated for all ages only.
						</Blank>
					) : (
						<PosterGrid titles={titles} variant="genre-grid" label={genre.name} />
					)}
				</Gutter>
			</>
		);
	};
}

/** The search screen's box: a GET form that puts the query in the address. */
function SearchForm(handle: Handle<{ query: string }>) {
	return () => (
		<form
			method="get"
			action={href("search")}
			role="search"
			mix={[raw({ position: "relative", maxInlineSize: "40rem" })]}
		>
			<SearchIcon
				aria-hidden="true"
				size={20}
				mix={[
					raw({
						position: "absolute",
						insetInlineStart: "1rem",
						insetBlockStart: "50%",
						translate: "0 -50%",
						color: "var(--ui-neutral-fg-muted)",
						pointerEvents: "none",
					}),
				]}
			/>
			<input
				type="search"
				name="q"
				value={handle.props.query}
				aria-label="Search titles, people and genres"
				placeholder="Search titles, people, genres"
				autocomplete="off"
				enterkeyhint="search"
				mix={[
					raw({
						boxSizing: "border-box",
						inlineSize: "100%",
						blockSize: "3.25rem",
						paddingInline: "3rem 1rem",
						border: "0",
						borderRadius: "var(--ui-radius-lg)",
						font: "inherit",
						fontSize: "1.0625rem",
						color: "var(--ui-neutral-fg-emphasis)",
						backgroundColor: "rgb(255 255 255 / 0.08)",
						boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)",
						"&::placeholder": { color: "var(--ui-neutral-fg-muted)" },
					}),
					when(
						"&:focus",
						raw({ outline: "none", boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" }),
					),
				]}
			/>
		</form>
	);
}

/**
 * Search: before a query, genres to browse and what is popular; after, the matches by name
 * first, or an empty state that offers the genres instead.
 */
export function SearchPage(handle: Handle<{ viewer: Viewer; query: string }>) {
	return () => {
		let { query, viewer } = handle.props;
		let pool = visibleTitles(viewer.profile);
		let results = searchTitles(query, pool);
		let genres = GENRES.filter((genre) => pool.some((title) => title.genres.includes(genre.id)));
		let chips = genres.map((genre) => ({
			label: genre.name,
			page: `genre/${genre.id}`,
			current: false,
		}));
		let popular = TRENDING.map((id) => pool.find((title) => title.id === id)).filter(
			(title): title is Title => title !== undefined,
		);
		return (
			<>
				<ScreenHeading title="Search">
					<SearchForm query={query} />
				</ScreenHeading>
				<Gutter>
					<SearchBody
						query={query}
						results={results}
						chips={chips}
						popular={popular.length > 0 ? popular : pool}
					/>
				</Gutter>
			</>
		);
	};
}

namespace SearchBody {
	export interface Props {
		query: string;
		results: Title[];
		chips: Chips.Props["chips"];
		/** What to show before a query: the week's most watched the profile may see. */
		popular: Title[];
	}
}

/** What sits under the search box: browsing before a query, then results or why there are none. */
function SearchBody(handle: Handle<SearchBody.Props>) {
	return () => {
		let { chips, popular, query, results } = handle.props;
		if (query.trim() === "") {
			return (
				<div mix={[raw({ display: "grid", gap: "2rem" })]}>
					<section
						aria-labelledby="vesper-browse-genres"
						mix={[raw({ display: "grid", gap: "0.75rem" })]}
					>
						<SubHeading id="vesper-browse-genres">Browse by genre</SubHeading>
						<Chips label="Genres" chips={chips} />
					</section>
					<section
						aria-labelledby="vesper-popular"
						mix={[raw({ display: "grid", gap: "0.75rem" })]}
					>
						<SubHeading id="vesper-popular">Popular on Vesper</SubHeading>
						<PosterGrid titles={popular} variant="popular" label="Popular on Vesper" />
					</section>
				</div>
			);
		}
		if (results.length === 0) {
			return (
				<Blank
					title={`Nothing matches “${query.trim()}”`}
					action={<Chips label="Genres" chips={chips} />}
				>
					Check the spelling, or try a genre, an actor or a creator.
				</Blank>
			);
		}
		return (
			<section aria-labelledby="vesper-results" mix={[raw({ display: "grid", gap: "0.75rem" })]}>
				<SubHeading id="vesper-results">
					{results.length} {results.length === 1 ? "result" : "results"} for “{query.trim()}”
				</SubHeading>
				<PosterGrid titles={results} variant="results" label="Results" />
			</section>
		);
	};
}

/** A section heading inside a grid screen. */
function SubHeading(handle: Handle<{ id: string; children: string | Array<string | number> }>) {
	return () => (
		<h2
			id={handle.props.id}
			mix={[raw({ margin: "0", fontSize: "1.125rem", color: "var(--ui-neutral-fg-emphasis)" })]}
		>
			{handle.props.children}
		</h2>
	);
}

/** The profile's list, most recently added first, or how to start one. */
export function MyList(handle: Handle<{ viewer: Viewer }>) {
	return () => {
		let { viewer } = handle.props;
		let pool = visibleTitles(viewer.profile);
		let titles = viewer.list
			.map((id) => findTitle(id))
			.filter((title): title is Title => title !== undefined && pool.includes(title));
		return (
			<>
				<ScreenHeading title="My List">
					<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
						{titles.length === 0
							? `Nothing saved for ${viewer.profile.name} yet`
							: `${titles.length} saved for ${viewer.profile.name}`}
					</p>
				</ScreenHeading>
				<Gutter>
					{titles.length === 0 ? (
						<Blank
							title="Your list is empty"
							action={<LinkButton href={href("series")}>Browse series</LinkButton>}
						>
							Press My List on any title to keep it here for later.
						</Blank>
					) : (
						<PosterGrid titles={titles} variant="my-list-grid" label="My List" />
					)}
				</Gutter>
			</>
		);
	};
}
