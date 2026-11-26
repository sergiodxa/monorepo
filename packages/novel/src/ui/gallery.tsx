/**
 * The CG gallery: every declared full-screen image, unlocked ones as thumbnails that open a
 * lightbox (a native modal `<dialog>`) and locked ones as placeholders, each localized for the
 * reader the way the stage localizes it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { XIcon } from "@sdxc/icons";
import { css, on } from "remix/component";

import type { Novel } from "../novel.js";

import type { LibraryAsset } from "./library.js";
import type { NovelLabels } from "./settings.js";

import { libraryReader, librarySource } from "./library.js";
import { NovelPlayer } from "./player.js";
import { DEFAULT_LABELS } from "./settings.js";
import { resolveSource } from "./source.js";
import { themeVar } from "./theme.js";

export namespace Gallery {
	/** Props {@link Gallery} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The novel; inside a player it defaults to the player's. */
		novel?: Novel;
		/**
		 * The stored `Persistent` value; inside a player it defaults to the play's. Keep one value
		 * while the screen shows, since a new value reads the library again.
		 */
		persistent?: unknown;
		labels?: Partial<Pick<NovelLabels, "loading" | "locked" | "close" | "gallery">>;
	}
}

/**
 * Lists the novel's CGs in the order the story first shows them, each in the same frame, locked or
 * not; the reader opens an unlocked one full size.
 *
 * @example <Gallery novel={novel} persistent={stored} />
 */
export function Gallery(handle: Handle<Gallery.Props>) {
	let read = libraryReader(handle);
	let lightbox = `${handle.id}-lightbox`.replace(/[^\w-]/g, "-");
	let open: LibraryAsset | undefined;
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	return () => {
		let { novel: _novel, persistent: _persistent, labels: overrides, mix, ...rest } = handle.props;
		let source = librarySource(player, handle.props);
		if (source === undefined) return null;
		let labels = { ...DEFAULT_LABELS, ...player?.labels, ...overrides };
		let locale = intl(handle).locale;
		let library = read(source.novel, source.persistent, locale);
		return (
			<div
				{...rest}
				data-novel-gallery=""
				aria-busy={library === undefined ? "true" : undefined}
				mix={mix}
			>
				{library === undefined ? <p>{labels.loading}</p> : null}
				<ul
					mix={css({
						margin: 0,
						padding: 0,
						listStyle: "none",
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))",
						gap: "0.75rem",
					})}
				>
					{(library?.images ?? []).map((image) => (
						<li key={image.id} data-image={image.id} data-unlocked={String(image.unlocked)}>
							{image.unlocked ? (
								<button
									type="button"
									commandfor={lightbox}
									command="show-modal"
									mix={[
										css({
											display: "block",
											inlineSize: "100%",
											aspectRatio: "16 / 9",
											padding: 0,
											border: themeVar("--novel-library-frame"),
											borderRadius: themeVar("--novel-library-radius"),
											overflow: "hidden",
											background: "#000",
											cursor: "zoom-in",
										}),
										on("click", () => {
											open = image;
											void handle.update();
										}),
									]}
								>
									<img
										alt=""
										src={resolveSource(image.src, locale)}
										mix={css({
											display: "block",
											inlineSize: "100%",
											blockSize: "100%",
											objectFit: "cover",
										})}
									/>
								</button>
							) : (
								<div
									role="img"
									aria-label={labels.locked}
									mix={css({
										display: "grid",
										placeItems: "center",
										aspectRatio: "16 / 9",
										borderRadius: themeVar("--novel-library-radius"),
										border: themeVar("--novel-library-frame"),
										background: themeVar("--novel-library-locked-background"),
										color: themeVar("--novel-library-locked-color"),
									})}
								>
									{labels.locked}
								</div>
							)}
						</li>
					))}
				</ul>
				<dialog
					id={lightbox}
					aria-label={labels.gallery}
					data-novel-lightbox=""
					mix={[
						css({
							inlineSize: "min(96vw, calc(90vh * 16 / 9))",
							maxInlineSize: "none",
							padding: 0,
							border: 0,
							background: "#000",
							"&::backdrop": { background: "rgb(0 0 0 / 0.85)" },
						}),
						on("close", () => {
							open = undefined;
							void handle.update();
						}),
					]}
				>
					{open === undefined ? null : (
						<img
							alt=""
							src={resolveSource(open.src, locale)}
							data-image={open.id}
							mix={css({ display: "block", inlineSize: "100%", blockSize: "auto" })}
						/>
					)}
					<button
						type="button"
						commandfor={lightbox}
						command="close"
						aria-label={labels.close}
						mix={css({
							position: "absolute",
							insetBlockStart: "0.5rem",
							insetInlineEnd: "0.5rem",
							display: "grid",
							placeItems: "center",
							padding: "0.4rem",
							border: 0,
							borderRadius: "999px",
							background: "rgb(0 0 0 / 0.6)",
							color: "#fff",
							font: "inherit",
							cursor: "pointer",
						})}
					>
						<XIcon size={18} />
					</button>
				</dialog>
			</div>
		);
	};
}
