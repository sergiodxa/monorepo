/**
 * Pinhole's gallery miniature: a phone-shaped post with its story tray above and its photo
 * filling the middle, beside a strip of a profile grid, so the card reads as a photo network
 * before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HeartIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";

import { PersonAvatar, PhotoArt, PinholeMark } from "./art";
import { POSTS, STORIES, findPerson } from "./data";

/** The posts whose first photos tile the grid beside the phone. */
const GRID = ["harbor-fog", "stair-light", "tile-study", "fern-week", "night-tram", "dune-walk"];

/** Renders the miniature on the brand's paper. */
export function PinholeThumbnail() {
	return () => {
		let featured = POSTS[0]!;
		let author = findPerson(featured.author)!;
		return (
			<div
				mix={[
					raw({
						position: "absolute",
						inset: "0",
						display: "grid",
						gridTemplateColumns: "44% 1fr",
						gap: "6%",
						alignItems: "center",
						padding: "6% 7%",
						overflow: "clip",
						backgroundColor: "oklch(0.962 0.01 82)",
						color: "oklch(0.2 0.009 62)",
						fontFamily: "var(--ui-font-sans)",
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.375rem",
							padding: "0.5rem",
							borderRadius: "0.75rem",
							backgroundColor: "oklch(0.985 0.006 85)",
							boxShadow: "0 12px 30px -12px rgb(60 40 20 / 0.35), 0 0 0 1px oklch(0.915 0.014 80)",
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.25rem",
								fontFamily: "var(--pinhole-display)",
								fontSize: "0.75rem",
								fontWeight: "600",
							}),
						]}
					>
						<PinholeMark size={14} />
						Pinhole
					</div>
					<div mix={[raw({ display: "flex", gap: "0.3rem" })]}>
						{STORIES.slice(0, 4).map((story) => (
							<span
								mix={[
									raw({
										display: "grid",
										padding: "1.5px",
										borderRadius: "999px",
										background:
											"conic-gradient(from 200deg, oklch(0.64 0.2 30), oklch(0.8 0.14 70), oklch(0.64 0.2 30))",
									}),
								]}
							>
								<PersonAvatar person={findPerson(story.author)!} size={1.25} />
							</span>
						))}
					</div>
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.3rem",
								fontSize: "0.5rem",
								fontWeight: "650",
							}),
						]}
					>
						<PersonAvatar person={author} size={0.875} />
						{author.handle}
					</div>
					<div mix={[raw({ aspectRatio: "4 / 5", borderRadius: "0.25rem", overflow: "hidden" })]}>
						<PhotoArt photo={featured.photos[0]!} decorative />
					</div>
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.25rem",
								fontSize: "0.5rem",
								fontWeight: "650",
							}),
						]}
					>
						<HeartIcon size={11} fill="oklch(0.6 0.23 25)" stroke="oklch(0.6 0.23 25)" />
						3,185 likes
					</div>
				</div>
				<div mix={[raw({ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "3px" })]}>
					{GRID.map((id) => {
						let post = POSTS.find((entry) => entry.id === id)!;
						return (
							<div mix={[raw({ aspectRatio: "1", overflow: "hidden", borderRadius: "2px" })]}>
								<PhotoArt photo={post.photos[0]!} decorative />
							</div>
						);
					})}
				</div>
			</div>
		);
	};
}
