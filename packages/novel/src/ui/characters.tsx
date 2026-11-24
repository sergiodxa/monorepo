/**
 * The characters screen: the cast in a scrolling list beside the chosen character's portrait,
 * name, description and every look the stage drew them in. A character stays unnamed until the
 * reader meets them, and a look stays locked until the stage shows it once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { css, on } from "remix/component";

import type { Novel } from "../novel.js";

import type { LibraryLook } from "./library.js";
import type { NovelLabels } from "./settings.js";

import { libraryReader, librarySource } from "./library.js";
import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";
import { DEFAULT_LABELS } from "./settings.js";
import { resolveSource } from "./source.js";

export namespace Characters {
	/** Props {@link Characters} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The novel; inside a player it defaults to the player's. */
		novel?: Novel;
		/**
		 * The stored `Persistent` value; inside a player it defaults to the play's. Keep one value
		 * while the screen shows, since a new value reads the library again.
		 */
		persistent?: unknown;
		labels?: Partial<Pick<NovelLabels, "loading" | "locked" | "unknownName" | "characterLooks">>;
	}
}

/**
 * Lists the novel's cast in declaration order. Inside a player it opens on the character
 * `showCharacter()` asked for, and otherwise on the first one the reader met.
 *
 * @example <Characters novel={novel} persistent={stored} />
 */
export function Characters(handle: Handle<Characters.Props>) {
	let read = libraryReader(handle);
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	let selected = player?.character;
	let chosenLook: string | undefined;

	/** Shows `id` and its first look. */
	function select(id: string): void {
		selected = id;
		chosenLook = undefined;
		void handle.update();
	}

	return () => {
		let { novel: _novel, persistent: _persistent, labels: overrides, mix, ...rest } = handle.props;
		let source = librarySource(player, handle.props);
		if (source === undefined) return null;
		let labels = { ...DEFAULT_LABELS, ...player?.labels, ...overrides };
		let locale = intl(handle).locale;
		let library = read(source.novel, source.persistent, locale);
		let cast = library?.characters ?? [];
		let current =
			cast.find((entry) => entry.met && entry.character.id === selected) ??
			cast.find((entry) => entry.met);
		let seen = current?.looks.filter((look) => look.seen) ?? [];
		let shown = seen.find((look) => look.key === chosenLook) ?? seen[0];
		let character = current?.character;
		let looks = current?.looks ?? [];
		return (
			<div
				{...rest}
				data-novel-characters=""
				aria-busy={library === undefined ? "true" : undefined}
				mix={[
					css({
						containerType: "inline-size",
						display: "grid",
						gridTemplateColumns: "minmax(9rem, 14rem) minmax(0, 1fr)",
						gap: "1rem",
						blockSize: "min(60vh, 36rem)",
						"@container (max-width: 34rem)": {
							gridTemplateColumns: "minmax(0, 1fr)",
							gridTemplateRows: "auto minmax(0, 1fr)",
						},
					}),
					mix,
				]}
			>
				{library === undefined ? <p>{labels.loading}</p> : null}
				<ul
					mix={css({
						margin: 0,
						padding: 0,
						listStyle: "none",
						display: "flex",
						flexDirection: "column",
						gap: "0.25rem",
						overflowY: "auto",
						overscrollBehavior: "contain",
					})}
				>
					{cast.map((entry) => (
						<li key={entry.character.id} data-character={entry.met ? entry.character.id : ""}>
							<button
								type="button"
								disabled={!entry.met}
								aria-current={entry === current ? "true" : undefined}
								style={entry.met ? { color: entry.character.color } : undefined}
								mix={[
									css({
										display: "block",
										inlineSize: "100%",
										padding: "0.5rem 0.75rem",
										border: 0,
										borderRadius: "0.4rem",
										background: "transparent",
										color: "inherit",
										font: "inherit",
										textAlign: "start",
										cursor: "pointer",
										"&:hover:not(:disabled), &[aria-current='true']": {
											background: "rgb(127 127 127 / 0.2)",
										},
										"&:disabled": { cursor: "default", opacity: 0.5 },
									}),
									on("click", () => select(entry.character.id)),
								]}
							>
								{entry.met ? <Message i18nKey={entry.character.name} /> : labels.unknownName}
							</button>
						</li>
					))}
				</ul>
				{character === undefined ? null : (
					<section
						key={character.id}
						data-novel-character-detail=""
						mix={css({
							display: "grid",
							gridTemplateColumns:
								looks.length === 0 ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)",
							gap: "1rem",
							minBlockSize: 0,
						})}
					>
						{looks.length === 0 ? null : (
							<div
								data-novel-character-portrait=""
								mix={css({ position: "relative", minBlockSize: 0 })}
							>
								{shown === undefined ? (
									<div
										role="img"
										aria-label={labels.locked}
										mix={css({
											position: "absolute",
											inset: 0,
											display: "grid",
											placeItems: "center",
											borderRadius: "0.4rem",
											border: "1px dashed var(--ui-border, rgb(127 127 127 / 0.5))",
											opacity: 0.6,
										})}
									>
										{labels.locked}
									</div>
								) : (
									<Layers look={shown} locale={locale} fit="contain" />
								)}
							</div>
						)}
						<div
							mix={css({
								display: "flex",
								flexDirection: "column",
								gap: "0.75rem",
								minBlockSize: 0,
								overflowY: "auto",
							})}
						>
							<h3 style={{ color: character.color }} mix={css({ margin: 0, fontSize: "1.5em" })}>
								<Message i18nKey={character.name} />
							</h3>
							{character.description === undefined ? null : (
								<p data-novel-character-description="" mix={css({ margin: 0, lineHeight: 1.5 })}>
									<Message i18nKey={character.description} />
								</p>
							)}
							{looks.length === 0 ? null : (
								<ul
									aria-label={labels.characterLooks}
									mix={css({
										margin: 0,
										padding: 0,
										listStyle: "none",
										display: "flex",
										flexWrap: "wrap",
										gap: "0.5rem",
									})}
								>
									{looks.map((look) => (
										<li key={look.key} data-look={look.seen ? look.key : ""}>
											{look.seen ? (
												<button
													type="button"
													aria-pressed={look === shown ? "true" : "false"}
													mix={[
														css({
															position: "relative",
															display: "block",
															inlineSize: "3.5rem",
															blockSize: "4.5rem",
															overflow: "hidden",
															borderRadius: "0.4rem",
															border: "1px solid var(--ui-border, rgb(127 127 127 / 0.5))",
														}),
														css({
															padding: 0,
															cursor: "pointer",
															background: "transparent",
															"&[aria-pressed='true']": { outline: "2px solid currentColor" },
														}),
														on("click", () => {
															chosenLook = look.key;
															void handle.update();
														}),
													]}
												>
													<Layers look={look} locale={locale} fit="cover" />
												</button>
											) : (
												<div
													role="img"
													aria-label={labels.locked}
													mix={[
														css({
															position: "relative",
															display: "block",
															inlineSize: "3.5rem",
															blockSize: "4.5rem",
															overflow: "hidden",
															borderRadius: "0.4rem",
															border: "1px solid var(--ui-border, rgb(127 127 127 / 0.5))",
														}),
														css({ borderStyle: "dashed", opacity: 0.5 }),
													]}
												/>
											)}
										</li>
									))}
								</ul>
							)}
						</div>
					</section>
				)}
			</div>
		);
	};
}

/** Props of {@link Layers}. */
interface LayersProps {
	look: LibraryLook;
	locale: string;
	/** `contain` shows the whole figure; `cover` crops a thumbnail to the top of it. */
	fit: "contain" | "cover";
}

/** A look's images stacked bottom to top over one box, each localized for the reader. */
function Layers(handle: Handle<LayersProps>) {
	return () => {
		let { look, locale, fit } = handle.props;
		return (
			<>
				{look.images.map((src, index) => (
					<img
						key={index}
						alt=""
						src={resolveSource(src, locale)}
						mix={css({
							position: "absolute",
							inset: 0,
							inlineSize: "100%",
							blockSize: "100%",
							objectFit: fit,
							objectPosition: fit === "contain" ? "bottom center" : "top center",
						})}
					/>
				))}
			</>
		);
	};
}
