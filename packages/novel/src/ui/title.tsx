/**
 * The title screen a novel opens on: its heading over the author's background and art, New game,
 * Continue from the newest save, the library screens and the settings, each in a modal dialog.
 * It starts nothing itself; a play the reader begins leaves as `novel:start` for its owner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixElement, RemixNode } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { css, on, ref } from "remix/component";

import type { GameState } from "../frames.js";
import type { Novel, StartOptions } from "../novel.js";

import type { LibraryScreen } from "./extras.js";
import type { InterfaceSounds } from "./interface-sounds.js";
import type { NovelLabels, StoredSettings } from "./settings.js";

import { AudioMixer } from "./audio.js";
import { SettingsModel } from "./behaviors/settings.js";
import { ChapterSelect } from "./chapters.js";
import { Encyclopedia } from "./encyclopedia.js";
import { NovelSettingsEvent, NovelStartEvent } from "./events.js";
import { offeredScreens, ScreenDialog } from "./extras.js";
import { interfaceSounds } from "./interface-sounds.js";
import { Memories } from "./memories.js";
import { SaveSummary } from "./saves.js";
import { SettingsScreen } from "./settings-screen.js";
import { DEFAULT_LABELS } from "./settings.js";
import { listenerSignal } from "./signal.js";
import { themeVar } from "./theme.js";

export namespace Title {
	/** What a title screen shows beside the novel's data, which `NovelPlayer.Default` takes too. */
	export interface Options {
		/**
		 * The novel's title: text, the author's markup, or a logo as an `<img>`, `<svg>` or
		 * `<picture>`, scaled to the `--novel-title-logo-*` bounds; a logo's alt text names it.
		 */
		heading: RemixNode;
		/**
		 * Full-bleed behind everything: an `<img>`, `<picture>` or `<video>` covers the screen,
		 * through `--novel-title-background-filter`. Without it the screen shows the
		 * `--novel-title-background` variable.
		 */
		background?: RemixNode;
		/**
		 * A foreground illustration such as a portrait, drawn over the background and under the
		 * menu at `--novel-title-art-inset` and `--novel-title-art-block-size`, keeping its ratio.
		 * It is hidden from assistive technology unless its element carries alt text.
		 */
		art?: RemixNode;
		/** Drawn under the menu in the same column, for a disclaimer or credits. */
		footer?: RemixNode;
		/**
		 * The library screens the menu offers, in order, like `NovelPlayer.Extras`' children.
		 *
		 * @default <ChapterSelect /><Encyclopedia /><Memories />
		 */
		screens?: RemixNode;
	}

	/** Props {@link Title} accepts; `mix` styles the parts through their `data-novel-title-*` attributes. */
	export interface Props extends Omit<TagProps<"div">, "children">, Omit<Options, "screens"> {
		novel: Novel;
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
		/** Sounds the menu plays as the reader reaches and picks an option. */
		sounds?: InterfaceSounds;
		/**
		 * The library screens the menu offers, in order, like `NovelPlayer.Extras`' children.
		 *
		 * @default <ChapterSelect /><Encyclopedia /><Memories />
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

/** True when `node` is an element carrying a non-empty `alt` or `aria-label` for its reader. */
function describes(node: RemixNode): boolean {
	if (typeof node !== "object" || node === null || Array.isArray(node) || !("props" in node)) {
		return false;
	}
	let props = (node as RemixElement).props as Record<string, unknown>;
	return [props["alt"], props["aria-label"]].some(
		(text) => typeof text === "string" && text.trim() !== "",
	);
}

/**
 * The title screen, filling its box. New game, Continue and a chapter or scene picked from a
 * library screen each dispatch `novel:start` with the options to mount a player with; a setting
 * changed here leaves as `novel:settings`. Every visual decision is a `--novel-title-*` variable.
 *
 * @example <NovelPlayer.Title novel={novel} heading="The Café" art={<img src={art} alt="" />} saves={saves} mix={on("novel:start", (event) => play(event.start))} />
 * @example mix={css({ "& [data-novel-title-button]::before": { content: '"◆"', position: "absolute", insetInlineStart: "-0.5em" } })}
 */
export function Title(handle: Handle<Title.Props>) {
	let root: HTMLElement | undefined;
	let seenSettings = handle.props.settings;
	let settings = new SettingsModel(seenSettings);
	let open: string | undefined;
	let prefix = handle.id.replace(/[^\w-]/g, "-");
	/** The title's own mixer, made once a sound plays, so a silent title opens no audio context. */
	let mixer: AudioMixer | undefined;
	handle.signal.addEventListener("abort", () => mixer?.dispose());

	/** The mixer at the reader's current volumes. */
	function soundMixer(): AudioMixer {
		mixer ??= new AudioMixer(settings.value.volume);
		mixer.setVolume(settings.value.volume);
		return mixer;
	}

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
			background,
			art,
			footer,
			saves,
			start,
			settings: stored,
			labels: overrides,
			sounds: _sounds,
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
						<Encyclopedia key="encyclopedia" />,
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
					on("pointerdown", () => {
						if (handle.props.sounds !== undefined) void soundMixer().resume();
					}),
					on("keydown", () => {
						if (handle.props.sounds !== undefined) void soundMixer().resume();
					}),
					interfaceSounds(() => ({
						mixer: soundMixer,
						sounds: handle.props.sounds,
						locale: intl(handle).locale,
					})),
					mix,
				]}
			>
				{background === undefined ? null : (
					<div
						data-novel-title-background=""
						mix={css({
							position: "absolute",
							inset: 0,
							filter: themeVar("--novel-title-background-filter"),
							"& > img, & > video, & > picture, & > picture > img": {
								display: "block",
								inlineSize: "100%",
								blockSize: "100%",
								objectFit: "cover",
								objectPosition: themeVar("--novel-title-background-position"),
							},
						})}
					>
						{background}
					</div>
				)}
				<div
					data-novel-title-overlay=""
					mix={css({
						position: "absolute",
						inset: 0,
						background: themeVar("--novel-title-overlay"),
					})}
				/>
				{art === undefined ? null : (
					<div
						data-novel-title-art=""
						aria-hidden={describes(art) ? undefined : "true"}
						mix={css({
							position: "absolute",
							inset: themeVar("--novel-title-art-inset"),
							blockSize: themeVar("--novel-title-art-block-size"),
							display: "flex",
							filter: themeVar("--novel-title-art-filter"),
							"@media (prefers-reduced-motion: no-preference)": {
								animation: themeVar("--novel-title-art-animation"),
							},
							"@keyframes novel-title-rise": {
								from: { opacity: 0, translate: "0 3cqh" },
								to: { opacity: 1, translate: "0 0" },
							},
							"& > img, & > svg, & > picture, & > picture > img": {
								display: "block",
								blockSize: "100%",
								inlineSize: "auto",
							},
						})}
					>
						{art}
					</div>
				)}
				<div
					data-novel-title-content=""
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
						data-novel-title-heading=""
						mix={css({
							margin: 0,
							fontFamily: themeVar("--novel-title-heading-font"),
							fontSize: themeVar("--novel-title-heading-size"),
							fontWeight: themeVar("--novel-title-heading-weight"),
							lineHeight: 1,
							color: themeVar("--novel-title-heading-color"),
							textShadow: themeVar("--novel-title-heading-shadow"),
							"& img, & svg, & picture": {
								display: "block",
								inlineSize: "auto",
								blockSize: "auto",
								maxInlineSize: themeVar("--novel-title-logo-max-inline-size"),
								maxBlockSize: themeVar("--novel-title-logo-max-block-size"),
								filter: themeVar("--novel-title-logo-filter"),
							},
						})}
					>
						{heading}
					</h1>
					<nav
						aria-label={labels.titleMenu}
						data-novel-title-menu=""
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
								detail={<SaveSummary state={resume} locale={intl(handle).locale} />}
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
					{footer === undefined ? null : (
						<div
							data-novel-title-footer=""
							mix={css({
								marginBlockStart: themeVar("--novel-title-footer-gap"),
								maxInlineSize: themeVar("--novel-title-footer-max-inline-size"),
								fontSize: themeVar("--novel-title-footer-font-size"),
								color: themeVar("--novel-title-footer-color"),
								textAlign: themeVar("--novel-title-footer-align") as "start",
								lineHeight: themeVar("--novel-title-footer-leading"),
							})}
						>
							{footer}
						</div>
					)}
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
							wide={screen === "characters" || screen === "encyclopedia"}
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
				<FullscreenButton label={labels.fullscreen} />
			</div>
		);
	};
}

/** Props of {@link FullscreenButton}. */
interface FullscreenButtonProps {
	label: string;
}

/**
 * Enters or leaves full screen from the title's bottom corner. It fills the screen with the box
 * the title sits in, which the play started from it shares, so starting a game stays in full
 * screen; it shows only where the browser allows full screen.
 */
function FullscreenButton(handle: Handle<FullscreenButtonProps>) {
	let button: HTMLButtonElement | undefined;
	let supported = false;
	let active = false;

	handle.queueTask(() => {
		supported = document.fullscreenEnabled;
		active = document.fullscreenElement !== null;
		document.addEventListener(
			"fullscreenchange",
			() => {
				active = document.fullscreenElement !== null;
				void handle.update();
			},
			{ signal: handle.signal },
		);
		void handle.update();
	});

	/** Leaves full screen, or fills the screen with the box the title sits in. */
	function toggle(): void {
		if (document.fullscreenElement !== null) {
			void document.exitFullscreen().catch(() => undefined);
			return;
		}
		let title = button?.closest("[data-novel-title]");
		let target = title?.parentElement ?? title;
		void target?.requestFullscreen().catch(() => undefined);
	}

	return () => (
		<button
			type="button"
			data-novel-title-fullscreen=""
			aria-label={handle.props.label}
			aria-pressed={active ? "true" : "false"}
			hidden={!supported}
			mix={[
				ref((node) => {
					button = node;
				}),
				css({
					position: "absolute",
					insetBlockEnd: themeVar("--novel-title-fullscreen-inset"),
					insetInlineEnd: themeVar("--novel-title-fullscreen-inset"),
					display: "grid",
					placeItems: "center",
					inlineSize: themeVar("--novel-title-fullscreen-size"),
					blockSize: themeVar("--novel-title-fullscreen-size"),
					padding: 0,
					border: themeVar("--novel-title-fullscreen-border"),
					borderRadius: themeVar("--novel-title-fullscreen-radius"),
					background: themeVar("--novel-title-fullscreen-background"),
					color: themeVar("--novel-title-fullscreen-color"),
					cursor: "pointer",
					"&[hidden]": { display: "none" },
					"&:hover, &:focus-visible": { color: themeVar("--novel-title-heading-color") },
					"& svg": { inlineSize: "55%", blockSize: "55%" },
				}),
				on("click", toggle),
			]}
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path
					d={
						active
							? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
							: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
					}
				/>
			</svg>
		</button>
	);
}

/** Props of one title menu entry: a play it starts on click, or the dialog it opens. */
interface TitleButtonProps extends Pick<TagProps<"button">, "mix"> {
	/** Its `data-action`, which names it for styling and tests. */
	action: string;
	/** The id of the modal dialog it opens. */
	opens?: string;
	/** A second line under the label, such as the save Continue resumes. */
	detail?: RemixNode;
	children?: RemixNode;
}

/**
 * One entry of the title menu, styled through the `--novel-title-button-*` variables. It is
 * positioned, so an author's `::before` and `::after` ornaments anchor to its edges.
 */
function TitleButton(handle: Handle<TitleButtonProps>) {
	return () => {
		let { action, opens, detail, mix, children } = handle.props;
		let invoke = opens === undefined ? {} : { commandfor: opens, command: "show-modal" as const };
		return (
			<button
				type="button"
				data-novel-title-button=""
				data-action={action}
				{...invoke}
				mix={[
					css({
						position: "relative",
						padding: themeVar("--novel-title-button-padding"),
						border: themeVar("--novel-title-button-border"),
						borderRadius: themeVar("--novel-title-button-radius"),
						background: themeVar("--novel-title-button-background"),
						boxShadow: themeVar("--novel-title-button-shadow"),
						color: themeVar("--novel-title-button-color"),
						fontFamily: themeVar("--novel-title-button-font-family"),
						fontSize: themeVar("--novel-title-button-font-size"),
						fontWeight: themeVar("--novel-title-button-font-weight"),
						fontVariant: themeVar("--novel-title-button-font-variant"),
						letterSpacing: themeVar("--novel-title-button-letter-spacing"),
						textTransform: themeVar("--novel-title-button-text-transform") as "none",
						cursor: "pointer",
						transition:
							"background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
						"&:hover, &:focus-visible": {
							background: themeVar("--novel-title-button-hover"),
							borderColor: themeVar("--novel-title-button-hover-border-color"),
							boxShadow: themeVar("--novel-title-button-hover-shadow"),
							translate: themeVar("--novel-title-button-hover-translate"),
						},
						"@media (prefers-reduced-motion: reduce)": { transition: "none" },
					}),
					mix,
				]}
			>
				<span data-novel-title-label="" mix={css({ display: "block" })}>
					{children}
				</span>
				{detail === undefined ? null : (
					<span
						data-novel-title-detail=""
						mix={css({
							display: "block",
							marginBlockStart: "0.4em",
							fontFamily: themeVar("--novel-title-detail-font-family"),
							fontSize: themeVar("--novel-title-detail-font-size"),
							color: themeVar("--novel-title-detail-color"),
							letterSpacing: themeVar("--novel-title-detail-letter-spacing"),
							textTransform: themeVar("--novel-title-detail-text-transform") as "none",
							"& time": { color: themeVar("--novel-title-detail-time-color") },
						})}
					>
						{detail}
					</span>
				)}
			</button>
		);
	};
}
