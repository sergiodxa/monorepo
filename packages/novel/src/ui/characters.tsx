/**
 * The characters screen: the characters the reader has met, in a scrolling list beside the chosen
 * one's portrait, name, description, the bio learned so far and every look the stage drew them in.
 * A look stays locked until the stage shows it once.
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
import { themeVar } from "./theme.js";

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
		labels?: Partial<Pick<NovelLabels, "loading" | "locked" | "characterLooks">>;
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
		let cast = library?.characters.filter((entry) => entry.met) ?? [];
		let current = cast.find((entry) => entry.character.id === selected) ?? cast[0];
		let seen = current?.looks.filter((look) => look.seen) ?? [];
		let shown = seen.find((look) => look.key === chosenLook) ?? seen[0];
		let character = current?.character;
		let looks = current?.looks ?? [];
		let learnedBio = current?.bio.filter((entry) => entry.learned) ?? [];
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
						blockSize: "var(--novel-characters-height, min(60vh, 36rem))",
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
						<li key={entry.character.id} data-character={entry.character.id}>
							<button
								type="button"
								aria-current={entry === current ? "true" : undefined}
								style={{ "--novel-character-color": entry.character.color }}
								mix={[
									css({
										display: "block",
										inlineSize: "100%",
										padding: "0.5rem 0.75rem",
										border: 0,
										borderRadius: "0.4rem",
										background: "transparent",
										color: themeVar("--novel-character-name-color"),
										font: "inherit",
										textAlign: "start",
										cursor: "pointer",
										"&:hover, &[aria-current='true']": {
											background: "rgb(127 127 127 / 0.2)",
										},
									}),
									on("click", () => select(entry.character.id)),
								]}
							>
								<Message i18nKey={entry.character.name} />
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
											borderRadius: themeVar("--novel-library-radius"),
											border: themeVar("--novel-library-frame"),
											background: themeVar("--novel-library-locked-background"),
											color: themeVar("--novel-library-locked-color"),
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
								paddingBlockEnd: "1rem",
							})}
						>
							<h3
								style={{ "--novel-character-color": character.color }}
								mix={css({
									margin: 0,
									fontSize: "1.5em",
									color: themeVar("--novel-character-name-color"),
								})}
							>
								<Message i18nKey={character.name} />
							</h3>
							{character.description === undefined ? null : (
								<p data-novel-character-description="" mix={css({ margin: 0, lineHeight: 1.5 })}>
									<Message i18nKey={character.description} />
								</p>
							)}
							{learnedBio.map((entry, index) => (
								<section key={entry.id} data-novel-character-bio={entry.id}>
									<h4 mix={css({ margin: "0.25rem 0 0.35rem", fontSize: "1.1em" })}>
										{`${index + 1}. `}
										<Message i18nKey={entry.section.title} />
									</h4>
									<p mix={css({ margin: 0, lineHeight: 1.5, whiteSpace: "pre-line" })}>
										<Message i18nKey={entry.section.body} />
									</p>
								</section>
							))}
							{looks.length === 0 ? null : (
								<ul
									aria-label={labels.characterLooks}
									mix={css({
										margin: 0,
										padding: "4px",
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
															borderRadius: themeVar("--novel-library-radius"),
															border: themeVar("--novel-library-frame"),
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
															borderRadius: themeVar("--novel-library-radius"),
															border: themeVar("--novel-library-frame"),
															background: themeVar("--novel-library-locked-background"),
														}),
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
