/**
 * Wishlists: the stays the traveller saved with the heart, plus two lists they put together
 * earlier, each as a collage card; a list opens as cards beside a map of where its stays are.
 * Saved stays come from the visitor's cookie, so a heart anywhere shows up here at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ChevronLeftIcon, HeartIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { HeadingScope } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";

import type { Stay } from "./data";
import type { Screen } from "./screen";

import { findStay, href } from "./data";
import { SPLIT, TOP_BAR } from "./layout";
import { NightlyPrice, Page, StayCard, StayPhoto, Title } from "./parts";
import { money } from "./pricing";
import { StaysMap } from "./stays-map";

/** One wishlist. */
export interface Wishlist {
	id: string;
	name: string;
	/** A line under the name on its own page. */
	note: string;
	stays: Stay[];
}

/** The lists the traveller made before the demo began; only "Saved" follows the heart. */
const KEPT_LISTS = [
	{
		id: "lakes",
		name: "Autumn by the lakes",
		note: "For when the birches turn.",
		ids: ["stillwater-boathouse", "ondine-glasshouse", "kingfisher-cottage"],
	},
	{
		id: "family",
		name: "The big family trip",
		note: "Ten of us, two dogs, one long table.",
		ids: ["lantern-house", "orchard-farmhouse", "mossback-lodge"],
	},
];

/**
 * Every wishlist the traveller has: "Saved" first, from their hearts, then the kept lists.
 *
 * @param saved The saved stays' ids, most recent first.
 */
export function wishlists(saved: string[]): Wishlist[] {
	let pick = (ids: string[]) =>
		ids.map(findStay).filter((stay): stay is Stay => stay !== undefined);
	return [
		{
			id: "saved",
			name: "Saved",
			note: "Every stay you hearted, newest first.",
			stays: pick(saved),
		},
		...KEPT_LISTS.map((list) => ({
			id: list.id,
			name: list.name,
			note: list.note,
			stays: pick(list.ids),
		})),
	];
}

/** A list's cover: up to three photos in a collage, or a heart on a tint when it's empty. */
function Collage(handle: Handle<{ stays: Stay[] }>) {
	return () => {
		let { stays } = handle.props;
		if (stays.length === 0) {
			return (
				<span
					mix={[
						raw({
							display: "grid",
							placeItems: "center",
							aspectRatio: "1",
							borderRadius: "1rem",
							backgroundColor: "var(--ui-brand-bg-tint)",
							color: "var(--ui-brand-fg)",
						}),
					]}
				>
					<HeartIcon aria-hidden="true" size={40} />
				</span>
			);
		}
		return (
			<span
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "2fr 1fr",
						gridTemplateRows: "1fr 1fr",
						gap: "2px",
						aspectRatio: "1",
						overflow: "clip",
						borderRadius: "1rem",
						"& > :first-child": {
							gridRow: stays.length > 1 ? "span 2" : "auto",
							gridColumn: stays.length === 1 ? "span 2" : "auto",
						},
					}),
				]}
			>
				{stays.slice(0, 3).map((stay) => (
					<span
						mix={[
							raw({
								display: "block",
								minBlockSize: "0",
								overflow: "clip",
								gridRow: stays.length === 1 ? "span 2" : "auto",
							}),
						]}
					>
						<StayPhoto stay={stay} />
					</span>
				))}
			</span>
		);
	};
}

/** The wishlists screen. */
export default function Wishlists(handle: Handle<{ ctx: Screen }>) {
	return () => {
		let lists = wishlists(handle.props.ctx.traveller.saved);
		return (
			<Page>
				<Title>Wishlists</Title>
				<ul
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))",
							gap: "2rem 1.5rem",
							margin: "2rem 0 0",
							padding: "0",
							listStyle: "none",
						}),
					]}
				>
					{lists.map((list) => (
						<li>
							<a
								href={href(`wishlists/${list.id}`)}
								data-rmx-prefetch="intent"
								mix={[
									raw({
										display: "grid",
										gap: "0.625rem",
										color: "inherit",
										textDecoration: "none",
									}),
									when(
										"&:focus-visible",
										raw({
											outline: "2px solid var(--ui-brand-ring)",
											outlineOffset: "4px",
											borderRadius: "1rem",
										}),
									),
								]}
							>
								<Collage stays={list.stays} />
								<span mix={[raw({ display: "grid" })]}>
									<strong
										mix={[raw({ fontSize: "1.0625rem", color: "var(--ui-neutral-fg-emphasis)" })]}
									>
										{list.name}
									</strong>
									<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
										{list.stays.length} {list.stays.length === 1 ? "stay" : "stays"}
									</span>
								</span>
							</a>
						</li>
					))}
				</ul>
			</Page>
		);
	};
}

/** One wishlist: its stays as cards, beside a map of them on a wide screen. */
export function WishlistPage(handle: Handle<{ ctx: Screen; list: Wishlist }>) {
	return () => {
		let { ctx, list } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						[`@media ${SPLIT}`]: { gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)" },
					}),
				]}
			>
				<Page>
					<a
						href={href("wishlists")}
						mix={[
							raw({
								display: "inline-flex",
								alignItems: "center",
								gap: "0.25rem",
								minBlockSize: "2.75rem",
								marginBlockEnd: "0.5rem",
								fontWeight: "600",
								color: "var(--ui-neutral-fg-emphasis)",
								textDecoration: "none",
							}),
							when("&:hover", raw({ textDecoration: "underline" })),
						]}
					>
						<ChevronLeftIcon aria-hidden="true" size={18} />
						Wishlists
					</a>
					<Title>{list.name}</Title>
					<p mix={[raw({ margin: "0.5rem 0 2rem", color: "var(--ui-neutral-fg-muted)" })]}>
						{list.note}
					</p>
					{list.stays.length === 0 ? (
						<HeadingScope level={2}>
							<Empty kind="first-run" icon={<HeartIcon />}>
								<Empty.Title>Nothing saved yet</Empty.Title>
								<Empty.Description>
									Tap the heart on any stay and it lands here, ready to compare.
								</Empty.Description>
								<Empty.Action>
									<a
										href={href("s")}
										mix={[raw({ fontWeight: "650", color: "var(--ui-brand-fg-emphasis)" })]}
									>
										Browse stays
									</a>
								</Empty.Action>
							</Empty>
						</HeadingScope>
					) : (
						<div
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 15rem), 1fr))",
									gap: "2rem 1.5rem",
									paddingBlockEnd: "2rem",
								}),
							]}
						>
							{list.stays.map((stay) => (
								<StayCard
									stay={stay}
									query=""
									saved={ctx.traveller.saved.includes(stay.id)}
									back={ctx.back}
									price={<NightlyPrice cents={stay.nightly} />}
									mapKey={stay.id}
									level={2}
								/>
							))}
						</div>
					)}
				</Page>
				{list.stays.length === 0 ? null : (
					<aside
						aria-label="Map"
						mix={[
							raw({
								display: "none",
								[`@media ${SPLIT}`]: {
									display: "block",
									position: "sticky",
									insetBlockStart: TOP_BAR,
									alignSelf: "start",
									padding: "1.25rem 1.25rem 1.25rem 0",
								},
							}),
						]}
					>
						<div mix={[raw({ overflow: "clip", borderRadius: "1rem" })]}>
							<StaysMap
								id="wayfern-list-map"
								stays={list.stays}
								labels={new Map(list.stays.map((stay) => [stay.id, money(stay.nightly)]))}
								query=""
								label={`${list.name} on the map`}
							/>
						</div>
					</aside>
				)}
			</div>
		);
	};
}
