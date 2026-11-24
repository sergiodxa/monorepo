/**
 * The title screen a novel opens on: its heading over the author's art, New game, Continue from
 * the newest save, the library screens and the settings, each in a modal dialog. It starts
 * nothing itself; a play the reader begins leaves as `novel:start` for its owner to mount.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { css, on, ref } from "remix/component";

import type { GameState } from "../frames.js";
import type { Novel, StartOptions } from "../novel.js";

import type { LibraryScreen } from "./extras.js";
import type { NovelLabels, StoredSettings } from "./settings.js";

import { SettingsModel } from "./behaviors/settings.js";
import { ChapterSelect } from "./chapters.js";
import { NovelSettingsEvent, NovelStartEvent } from "./events.js";
import { offeredScreens, ScreenDialog } from "./extras.js";
import { Gallery } from "./gallery.js";
import { Memories } from "./memories.js";
import { SettingsScreen } from "./settings-screen.js";
import { DEFAULT_LABELS } from "./settings.js";
import { listenerSignal } from "./signal.js";
import { themeVar } from "./theme.js";

export namespace Title {
	/** What a title screen shows beside the novel's data, which `NovelPlayer.Default` takes too. */
	export interface Options {
		/** The novel's title, as text or the author's own markup. */
		heading: RemixNode;
		/**
		 * Drawn behind the heading and the menu, filling the screen: key art as an `<img>`, a
		 * `<picture>` or any markup. Without it the screen shows `--novel-title-background`.
		 */
		art?: RemixNode;
		/**
		 * The library screens the menu offers, in order, like `NovelPlayer.Extras`' children.
		 *
		 * @default <ChapterSelect /><Gallery /><Memories />
		 */
		screens?: RemixNode;
	}

	/** Props {@link Title} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		novel: Novel;
		heading: RemixNode;
		art?: RemixNode;
		/** The reader's saves by slot; Continue resumes the newest and shows only when one exists. */
		saves?: Readonly<Record<string, GameState>>;
		/**
		 * What every play the title begins extends, such as the stored `persistent` data, which the
		 * library screens read too. A new game leaves its `from` out.
		 */
		start?: StartOptions;
		/** The settings the app stored, which the settings screen shows and changes. */
		settings?: StoredSettings;
		labels?: Partial<NovelLabels>;
		/**
		 * The library screens the menu offers, in order, like `NovelPlayer.Extras`' children.
		 *
		 * @default <ChapterSelect /><Gallery /><Memories />
		 */
		children?: RemixNode;
	}
}

/** Props the library screens share, which the title fills from its own. */
interface LibraryProps {
	novel?: Novel;
	persistent?: unknown;
	labels?: Partial<NovelLabels>;
}

/** The newest save across every slot by `meta.savedAt`, or `undefined` without saves. */
function newestSave(saves: Readonly<Record<string, GameState>> | undefined): GameState | undefined {
	let newest: GameState | undefined;
	for (let save of Object.values(saves ?? {})) {
		if (newest === undefined || Date.parse(save.meta.savedAt) > Date.parse(newest.meta.savedAt)) {
			newest = save;
		}
	}
	return newest;
}

/**
 * The title screen, filling its box. New game, Continue and a chapter or scene picked from a
 * library screen each dispatch `novel:start` with the options to mount a player with; a setting
 * changed here leaves as `novel:settings`. Every visual decision is a `--novel-title-*` variable.
 *
 * @example <NovelPlayer.Title novel={novel} heading="The Café" art={<img src={art} alt="" />} saves={saves} mix={on("novel:start", (event) => play(event.start))} />
 */
export function Title(handle: Handle<Title.Props>) {
	let root: HTMLElement | undefined;
	let seenSettings = handle.props.settings;
	let settings = new SettingsModel(seenSettings);
	let open: string | undefined;
	let prefix = handle.id.replace(/[^\w-]/g, "-");

	settings.addEventListener(
		"change",
		() => {
			root?.dispatchEvent(new NovelSettingsEvent(settings.value));
			void handle.update();
		},
		{ signal: listenerSignal(handle) },
	);

	/** Begins a play from `start`, closing any dialog the title left open. */
	function begin(target: EventTarget, start: StartOptions): void {
		root?.querySelector<HTMLDialogElement>("dialog[open]")?.close();
		target.dispatchEvent(new NovelStartEvent(start));
	}

	/** The title's start without a save to resume, which a new game and a replay extend. */
	function fresh(): StartOptions {
		let { from: _from, ...rest } = handle.props.start ?? {};
		return rest;
	}

	/** Tracks the open library dialog, so only its screen renders and reads the library. */
	function toggle(screen: LibraryScreen, shown: boolean): void {
		if (shown) open = screen;
		else if (open === screen) open = undefined;
		void handle.update();
	}

	return () => {
		let {
			novel,
			heading,
			art,
			saves,
			start,
			settings: stored,
			labels: overrides,
			children,
			mix,
			...rest
		} = handle.props;
		if (stored !== seenSettings) {
			seenSettings = stored;
			settings.replace(stored);
		}
		let labels: NovelLabels = { ...DEFAULT_LABELS, ...overrides };
		let resume = newestSave(saves);
		let offered = offeredScreens(children);
		let screens =
			offered.length > 0
				? offered
				: offeredScreens([
						<ChapterSelect key="chapters" />,
						<Gallery key="gallery" />,
						<Memories key="memories" />,
					]);
		let settingsId = `${prefix}-settings`;
		return (
			<div
				role="region"
				aria-labelledby={`${prefix}-heading`}
				{...rest}
				data-novel-title=""
				mix={[
					ref((node) => {
						root = node;
					}),
					css({
						position: "relative",
						inlineSize: "100%",
						blockSize: "100%",
						containerType: "size",
						overflow: "hidden",
						background: themeVar("--novel-title-background"),
						color: themeVar("--novel-title-color"),
						fontFamily: themeVar("--novel-title-font"),
						userSelect: "none",
						WebkitUserSelect: "none",
					}),
					on("novel:replay", (event) => {
						event.stopPropagation();
						begin(event.currentTarget, { ...fresh(), scene: event.scene, replay: event.scope });
					}),
					mix,
				]}
			>
				<div
					data-novel-title-art=""
					mix={css({
						position: "absolute",
						inset: 0,
						display: "grid",
						"& > img, & > picture, & > video": {
							inlineSize: "100%",
							blockSize: "100%",
							objectFit: "cover",
						},
					})}
				>
					{art}
				</div>
				<div
					mix={css({
						position: "absolute",
						inset: 0,
						background: themeVar("--novel-title-overlay"),
					})}
				/>
				<div
					mix={css({
						position: "absolute",
						inset: themeVar("--novel-title-inset"),
						display: "flex",
						flexDirection: "column",
						justifyContent: themeVar("--novel-title-justify"),
						alignItems: themeVar("--novel-title-align"),
						gap: themeVar("--novel-title-gap"),
					})}
				>
					<h1
						id={`${prefix}-heading`}
						mix={css({
							margin: 0,
							fontFamily: themeVar("--novel-title-heading-font"),
							fontSize: themeVar("--novel-title-heading-size"),
							fontWeight: themeVar("--novel-title-heading-weight"),
							lineHeight: 1,
							color: themeVar("--novel-title-heading-color"),
							textShadow: themeVar("--novel-title-heading-shadow"),
						})}
					>
						{heading}
					</h1>
					<nav
						aria-label={labels.titleMenu}
						mix={css({
							display: "flex",
							flexDirection: "column",
							alignItems: "stretch",
							gap: themeVar("--novel-title-menu-gap"),
							minInlineSize: themeVar("--novel-title-button-min-inline-size"),
						})}
					>
						<TitleButton
							action="new-game"
							mix={on("click", (event) => begin(event.currentTarget, fresh()))}
						>
							{labels.newGame}
						</TitleButton>
						{resume === undefined ? null : (
							<TitleButton
								action="continue"
								mix={on("click", (event) => begin(event.currentTarget, { ...start, from: resume }))}
							>
								{labels.continue}
							</TitleButton>
						)}
						{screens.map(({ screen, label }) => (
							<TitleButton key={screen} action={screen} opens={`${prefix}-${screen}`}>
								{labels[label]}
							</TitleButton>
						))}
						<TitleButton action="settings" opens={settingsId}>
							{labels.settings}
						</TitleButton>
					</nav>
				</div>
				{screens.map(({ screen, label, element }) => {
					let Screen = element.type as (handle: Handle<LibraryProps>) => () => RemixNode;
					let own = element.props as LibraryProps;
					return (
						<ScreenDialog
							key={screen}
							id={`${prefix}-${screen}`}
							title={labels[label]}
							closeLabel={labels.close}
							open={open === screen}
							mix={on("toggle", (event) =>
								toggle(screen, (event as ToggleEvent).newState === "open"),
							)}
						>
							<Screen
								{...own}
								novel={own.novel ?? novel}
								persistent={own.persistent ?? start?.persistent}
								labels={{ ...labels, ...own.labels }}
							/>
						</ScreenDialog>
					);
				})}
				<SettingsScreen id={settingsId} settings={settings} labels={labels} />
			</div>
		);
	};
}

/** Props of one title menu entry: a play it starts on click, or the dialog it opens. */
interface TitleButtonProps extends Pick<TagProps<"button">, "mix"> {
	/** Its `data-action`, which names it for styling and tests. */
	action: string;
	/** The id of the modal dialog it opens. */
	opens?: string;
	children?: RemixNode;
}

/** One entry of the title menu, styled through the `--novel-title-button-*` variables. */
function TitleButton(handle: Handle<TitleButtonProps>) {
	return () => {
		let { action, opens, mix, children } = handle.props;
		let invoke = opens === undefined ? {} : { commandfor: opens, command: "show-modal" as const };
		return (
			<button
				type="button"
				data-action={action}
				{...invoke}
				mix={[
					css({
						padding: themeVar("--novel-title-button-padding"),
						border: themeVar("--novel-title-button-border"),
						borderRadius: themeVar("--novel-title-button-radius"),
						background: themeVar("--novel-title-button-background"),
						color: themeVar("--novel-title-button-color"),
						font: "inherit",
						fontSize: themeVar("--novel-title-button-font-size"),
						cursor: "pointer",
						transition: "background-color 160ms ease, border-color 160ms ease",
						"&:hover, &:focus-visible": {
							background: themeVar("--novel-title-button-hover"),
							borderColor: themeVar("--novel-title-button-hover-border-color"),
						},
						"@media (prefers-reduced-motion: reduce)": { transition: "none" },
					}),
					mix,
				]}
			>
				{children}
			</button>
		);
	};
}
