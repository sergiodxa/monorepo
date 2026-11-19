/**
 * `NovelPlayer`: owns a play, renders its current frame on the stage with the textbox, menu,
 * captions and quick menu, and its screens (backlog, saves, settings, the library extras). Input
 * comes from the control mixins, and saves, settings and endings leave as bubbling DOM events.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Trans } from "@sdxc/i18n/ui";
import type { Handle, Props as TagProps, RemixElement, RemixNode } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { Dialog } from "@sdxc/ui";
import { css, on, ref } from "remix/component";

import type { SceneDeclaration } from "../declarations.js";
import type { CustomFrame, GameState, ReplayScope, Reply } from "../frames.js";
import type { Novel, StartOptions } from "../novel.js";

import type { AudioMixer } from "./audio.js";
import type { NovelLabels, NovelSettings, PlayerAction, StoredSettings } from "./settings.js";

import { Backlog } from "./backlog.js";
import { ChapterSelect, SceneReplay } from "./chapters.js";
import { ChoiceMenu } from "./choice-menu.js";
import { INTERACTIVE, perform } from "./controls.js";
import { Director } from "./director.js";
import { EndingsList } from "./endings.js";
import { NovelEndingEvent, NovelSaveEvent, NovelSettingsEvent } from "./events.js";
import { Gallery } from "./gallery.js";
import { Memories } from "./memories.js";
import { Message } from "./message.js";
import { MusicRoom } from "./music-room.js";
import { QuickMenu } from "./quick-menu.js";
import { QUICK_SLOT, SaveScreen } from "./saves.js";
import { SettingsScreen } from "./settings-screen.js";
import { DEFAULT_LABELS, resolveSettings } from "./settings.js";
import { Stage } from "./stage.js";
import { Captions, Textbox } from "./textbox.js";

/** A typeface stack with dyslexia-friendly faces first; the app loads the web font it prefers. */
const DYSLEXIA_FONT = '"OpenDyslexic", "Atkinson Hyperlegible", "Lexend", Verdana, sans-serif';

export namespace NovelPlayer {
	/** Props an interaction component receives for a custom frame. */
	export interface InteractionProps {
		frame: CustomFrame;
		/** Answers the frame; pass `frame.complete(output)`. */
		respond: (reply: Reply) => void;
	}

	/** A component that renders a custom frame, written by the app. */
	export type Interaction = (handle: Handle<InteractionProps>) => () => RemixNode;

	/** A dialog the player opens by name: one of its screens or a library screen. */
	export type Screen =
		| "backlog"
		| "save"
		| "load"
		| "settings"
		| "memories"
		| "gallery"
		| "music"
		| "endings"
		| "chapters"
		| "scenes";

	/**
	 * What `handle.context.get(NovelPlayer)` answers: the play's state, read live, and the actions
	 * that drive it. It is one object for the player's whole life, so a mixin reads it once.
	 */
	export interface Context {
		/** The player's root element, once it is in the document. */
		readonly element: HTMLElement | undefined;
		/** The dialog open in the player, which takes keys and the gamepad while it is open. */
		readonly dialog: HTMLDialogElement | null;
		/** True while the reader has hidden the interface to look at the stage. */
		readonly hidden: boolean;
		/** True while the play is a replay, which never saves. */
		readonly replaying: boolean;
		readonly mixer: AudioMixer;
		/** Advances a line or pause, finishing a running transition or typewriter first. */
		advance(): void;
		/** Returns to the previous stop, shown at once. */
		rollback(): Promise<void>;
		/**
		 * Saves the play into `slot` and dispatches `novel:save`.
		 *
		 * @returns The play as JSON, or `undefined` before the play starts and during a replay.
		 */
		save(slot: string): GameState | undefined;
		/** Resumes the play saved in `slot`, when it holds one. */
		load(slot: string): Promise<void>;
		toggleAuto(): void;
		toggleSkip(): void;
		/** Skips while `held` is true, the way held Control does. */
		holdSkip(held: boolean): void;
		/** Hides the interface, shows it with `false`, or toggles it without an argument. */
		hide(hidden?: boolean): void;
		/** Enters or leaves full screen with the player as the full-screen element. */
		toggleFullscreen(): void;
		/** Ends a replay, resuming the play it interrupted. */
		endReplay(): Promise<void>;
		/** Opens one of the player's dialogs, when it is rendered. */
		open(screen: Screen): void;
	}

	/** Props of the library screens' dialogs. */
	export interface LibraryProps {
		novel: Novel;
		ids: Record<"memories" | "gallery" | "music" | "endings" | "chapters" | "scenes", string>;
		/** The screen open now and the persistent data it reads. */
		open: { id: string; persistent: unknown } | undefined;
		labels: NovelLabels;
		mixer: AudioMixer;
		musicTitles: Readonly<Record<string, string>> | undefined;
		onToggle: (id: string, open: boolean) => void;
		onReplay: (scene: SceneDeclaration, scope: ReplayScope) => void;
	}

	/** Props of a library screen's dialog. */
	export interface ScreenProps {
		id: string;
		title: string;
		closeLabel: string;
		/** True while the dialog is open, which is when its content renders and loads. */
		open: boolean;
		onToggle: (open: boolean) => void;
		children?: RemixNode;
	}

	/** Props {@link NovelPlayer} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		novel: Novel;
		/** Where the play starts: a scene, a state, a seed, a save through `from`, and `persistent` data. */
		start?: StartOptions;
		/** The settings the app stored; missing fields take their defaults. */
		settings?: StoredSettings;
		/** The saves the app stored, by slot name. */
		saves?: Readonly<Record<string, GameState>>;
		/**
		 * How many numbered save slots the save and load screens show, beside the quick slot.
		 *
		 * @default 6
		 */
		slots?: number;
		/**
		 * Shows speaker focus: the speaker enlarged and raised, everyone else dimmed.
		 *
		 * @default true
		 */
		focus?: boolean;
		/** Renders custom frames; without it a custom frame shows the stage and waits. */
		renderInteraction?: Interaction;
		/** Replaces any of the interface's English labels. */
		labels?: Partial<NovelLabels>;
		/**
		 * Offers the library screens (Memories, gallery, music room, endings, chapter select and
		 * scene replay) from an extras menu.
		 *
		 * @default true
		 */
		extras?: boolean;
		/**
		 * How many jumps ahead to prefetch when the play enters a scene: its modules, images,
		 * sounds, voices and music. `false` prefetches nothing.
		 *
		 * @default 1
		 */
		prefetch?: number | false;
		/** Each music track's title as a message key, by asset id, for the music room. */
		musicTitles?: Readonly<Record<string, string>>;
		/** Markup elements for lines, beside `b`, `i`, `shake`, `speed` and `pause`. */
		markup?: Record<string, RemixElement | Trans.MarkupComponent>;
	}
}

/**
 * Plays a novel and provides {@link NovelPlayer.Context} to what it holds. It reads its translator
 * from `IntlProvider`, renders inside the app's own client entry since a novel holds functions,
 * and reads `start` once, at mount: a new play needs a remount, done by changing its `key`.
 *
 * @example <NovelPlayer novel={novel} settings={stored} saves={saves} mix={[keyboardControls(), touchControls(), on("novel:save", store)]} />
 */
export function NovelPlayer(handle: Handle<NovelPlayer.Props, NovelPlayer.Context>) {
	let root: HTMLElement | undefined;
	let stage: HTMLElement | undefined;
	let seenSettings: StoredSettings | undefined;
	let settings = resolveSettings(handle.props.settings);
	seenSettings = handle.props.settings;
	let seenSaves: NovelPlayer.Props["saves"];
	let saves: Record<string, GameState> = {};
	let hidden = false;
	let ids: Record<NovelPlayer.Screen, string> = {
		backlog: `${handle.id}-backlog`.replace(/[^\w-]/g, "-"),
		save: `${handle.id}-save`.replace(/[^\w-]/g, "-"),
		load: `${handle.id}-load`.replace(/[^\w-]/g, "-"),
		settings: `${handle.id}-settings`.replace(/[^\w-]/g, "-"),
		memories: `${handle.id}-memories`.replace(/[^\w-]/g, "-"),
		gallery: `${handle.id}-gallery`.replace(/[^\w-]/g, "-"),
		music: `${handle.id}-music`.replace(/[^\w-]/g, "-"),
		endings: `${handle.id}-endings`.replace(/[^\w-]/g, "-"),
		chapters: `${handle.id}-chapters`.replace(/[^\w-]/g, "-"),
		scenes: `${handle.id}-scenes`.replace(/[^\w-]/g, "-"),
	};
	let extras = {
		memories: ids.memories,
		gallery: ids.gallery,
		music: ids.music,
		endings: ids.endings,
		chapters: ids.chapters,
		scenes: ids.scenes,
	};
	/** The library screen open now, and the persistent data it reads, taken as it opened. */
	let screen: { id: string; persistent: unknown } | undefined;

	let director = new Director({
		novel: () => handle.props.novel,
		render: async () => {
			await handle.update();
		},
		stage: () => stage ?? null,
		locale: () => intl(handle).locale,
		text: () =>
			root?.querySelector("[data-novel-textbox], [data-novel-choices]")?.textContent?.trim() ?? "",
		settings: () => settings,
		onEnding: (ending) => root?.dispatchEvent(new NovelEndingEvent(ending)),
		prefetch: () => handle.props.prefetch ?? 1,
	});

	handle.signal.addEventListener("abort", () => director.dispose());
	handle.queueTask(() => {
		if (handle.signal.aborted) return;
		void director.begin(handle.props.start);
	});

	/** The dialog open in the player, which takes keys and the gamepad while it is open. */
	function openDialog(): HTMLDialogElement | null {
		return root?.querySelector<HTMLDialogElement>("dialog[open]") ?? null;
	}

	/** Opens one of the player's dialogs. */
	function show(id: string): void {
		let dialog = root?.querySelector<HTMLDialogElement>(`#${id}`);
		if (dialog !== null && dialog !== undefined && !dialog.open) dialog.showModal();
	}

	/** Saves the play into `slot`, keeping the save locally so the screens show it at once. */
	function save(slot: string): GameState | undefined {
		let state = director.save(slot);
		if (state === undefined) return undefined;
		saves = { ...saves, [slot]: state };
		root?.dispatchEvent(new NovelSaveEvent(slot, state));
		void handle.update();
		return state;
	}

	/** Resumes the play saved in `slot`. */
	async function load(slot: string): Promise<void> {
		let state = saves[slot];
		if (state !== undefined) await director.load(state);
	}

	/**
	 * Tracks which library screen is open, taking the play's persistent data as it opens so the
	 * screen reads one value; closing the music room hands the music back to the frame.
	 */
	function toggleScreen(id: string, open: boolean): void {
		if (open) {
			screen = { id, persistent: director.persistent ?? handle.props.start?.persistent };
		} else if (screen?.id === id) {
			screen = undefined;
			let frame = director.frame;
			if (id === extras.music && frame !== undefined) {
				director.mixer.reconcile(frame.audio, intl(handle).locale, true);
			}
		}
		void handle.update();
	}

	/** Closes the open library screen and starts a replay from the scene it picked. */
	function startReplay(scene: SceneDeclaration, scope: ReplayScope): void {
		root?.querySelector<HTMLDialogElement>("dialog[open]")?.close();
		void director.replay(scene, scope);
	}

	/** Stores changed settings and hands them to the app. */
	function changeSettings(next: NovelSettings): void {
		settings = next;
		director.mixer.setVolume(next.volume);
		if (!next.selfVoicing && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
		root?.dispatchEvent(new NovelSettingsEvent(next));
		void handle.update();
	}

	/** Shows or hides the interface; a hidden interface comes back on the next click or key. */
	function hide(next = !hidden): void {
		if (next === hidden) return;
		hidden = next;
		void handle.update();
	}

	/** Enters or leaves full screen with the player as the full-screen element. */
	function toggleFullscreen(): void {
		if (document.fullscreenElement !== null) {
			void document.exitFullscreen().catch(() => undefined);
			return;
		}
		void root?.requestFullscreen().catch(() => undefined);
	}

	/** Runs one of the quick menu's actions through the same path as the inputs. */
	function run(action: PlayerAction): void {
		perform(context, action);
	}

	let context: NovelPlayer.Context = {
		get element() {
			return root;
		},
		get dialog() {
			return openDialog();
		},
		get hidden() {
			return hidden;
		},
		get replaying() {
			return director.replaying;
		},
		get mixer() {
			return director.mixer;
		},
		advance: () => director.advance(),
		rollback: () => director.rollback(),
		save,
		load,
		toggleAuto: () => director.toggleAuto(),
		toggleSkip: () => director.toggleSkip(),
		holdSkip: (held) => director.holdSkip(held),
		hide,
		toggleFullscreen,
		endReplay: () => director.endReplay(),
		open: (screen) => show(ids[screen]),
	};
	handle.context.set(context);

	return () => {
		let {
			novel: _novel,
			start: _start,
			settings: stored,
			saves: storedSaves,
			slots = 6,
			focus = true,
			renderInteraction,
			labels: labelOverrides,
			markup,
			extras: showExtras = true,
			prefetch: _prefetch,
			musicTitles,
			mix,
			...rest
		} = handle.props;
		if (stored !== seenSettings) {
			seenSettings = stored;
			settings = resolveSettings(stored);
		}
		if (storedSaves !== seenSaves) {
			seenSaves = storedSaves;
			saves = { ...storedSaves };
		}
		let labels = { ...DEFAULT_LABELS, ...labelOverrides };
		let locale = intl(handle).locale;
		let frame = director.frame;
		let showUi = !hidden && director.ending === undefined;
		let Interaction = renderInteraction;
		let staged = director.phase !== "staging";
		return (
			<div
				{...rest}
				data-novel-player=""
				data-phase={director.phase}
				data-auto={String(director.auto)}
				data-skip={String(director.skipping)}
				data-hidden={String(hidden)}
				data-replay={String(director.replaying)}
				data-dyslexia={String(settings.dyslexiaFont)}
				style={{ "--novel-font-scale": settings.fontSize }}
				mix={[
					ref((node) => {
						root = node;
					}),
					css({
						position: "relative",
						inlineSize: "100%",
						blockSize: "100%",
						background: "var(--novel-letterbox, #000)",
						color: "#fff",
						'&[data-dyslexia="true"]': {
							"--novel-text-font": DYSLEXIA_FONT,
							"--novel-text-tracking": "0.05em",
							"--novel-text-word-spacing": "0.16em",
							"--novel-text-leading": "1.7",
						},
					}),
					on("pointerdown", () => void director.mixer.resume()),
					mix,
				]}
			>
				<Stage
					stage={frame?.stage ?? { background: null, image: null, characters: [] }}
					locale={locale}
					focus={focus}
					instant={director.instant}
					mix={[
						ref((node) => {
							stage = node;
						}),
						css({ cursor: "pointer", userSelect: "none" }),
						on("click", (event) => {
							if ((event.target as Element).closest(INTERACTIVE) !== null) return;
							if (hidden) {
								hide(false);
								return;
							}
							director.advance();
						}),
					]}
				>
					{showUi && frame !== undefined ? (
						<Captions sounds={frame.audio.sounds} data-novel-ui="" />
					) : null}
					{showUi && frame?.type === "line" ? (
						<Textbox
							frame={frame}
							typing={director.phase === "typing" || director.phase === "waiting"}
							complete={director.complete}
							textSpeed={settings.textSpeed}
							markup={markup}
							onRevealed={() => director.revealed()}
						/>
					) : null}
					{showUi && frame?.type === "choice" && staged ? (
						<ChoiceMenu
							frame={frame}
							timeLeftLabel={labels.timeLeft}
							onChoose={(option) => director.reply(frame.choose(option))}
						/>
					) : null}
					{frame?.type === "custom" && staged && Interaction !== undefined ? (
						<div data-novel-interaction="" mix={css({ position: "absolute", inset: 0, zIndex: 4 })}>
							<Interaction frame={frame} respond={(reply) => director.reply(reply)} />
						</div>
					) : null}
					{director.ending?.key === null || director.ending === undefined ? null : (
						<p
							data-novel-ending=""
							mix={css({
								position: "absolute",
								inset: 0,
								margin: 0,
								display: "grid",
								placeItems: "center",
								fontSize: "6cqh",
								background: "rgb(0 0 0 / 0.55)",
								zIndex: 6,
							})}
						>
							<Message i18nKey={director.ending.key} />
						</p>
					)}
					{director.error === undefined ? null : (
						<div
							role="alert"
							data-novel-ui=""
							data-novel-error={director.error.code}
							mix={css({
								position: "absolute",
								insetBlockStart: "3cqh",
								insetInline: "20cqw",
								padding: "1.5cqh 2cqw",
								borderRadius: "1cqh",
								background: "rgb(120 20 30 / 0.9)",
								fontSize: "2.4cqh",
								zIndex: 7,
							})}
						>
							<p mix={css({ margin: 0 })}>{director.error.message}</p>
							{director.stalled ? (
								<button type="button" mix={on("click", () => director.retry())}>
									{labels.retry}
								</button>
							) : null}
						</div>
					)}
					{showUi ? (
						<QuickMenu
							auto={director.auto}
							skip={director.skipping}
							dialogs={ids}
							extras={showExtras ? extras : undefined}
							replay={director.replaying}
							labels={labels}
							onAction={run}
						/>
					) : null}
				</Stage>
				<Backlog
					id={ids.backlog}
					entries={director.backlog}
					labels={labels}
					onReplayVoice={(entry) => director.replayVoice(entry)}
				/>
				<SaveScreen
					id={ids.save}
					mode="save"
					slots={[QUICK_SLOT, ...Array.from({ length: slots }, (_, index) => String(index + 1))]}
					saves={saves}
					locale={locale}
					labels={labels}
					onSelect={save}
				/>
				<SaveScreen
					id={ids.load}
					mode="load"
					slots={[QUICK_SLOT, ...Array.from({ length: slots }, (_, index) => String(index + 1))]}
					saves={saves}
					locale={locale}
					labels={labels}
					onSelect={load}
				/>
				<SettingsScreen
					id={ids.settings}
					settings={settings}
					labels={labels}
					onChange={changeSettings}
				/>
				{showExtras ? (
					<LibraryScreens
						novel={handle.props.novel}
						ids={extras}
						open={screen}
						labels={labels}
						mixer={director.mixer}
						musicTitles={musicTitles}
						onToggle={toggleScreen}
						onReplay={startReplay}
					/>
				) : null}
			</div>
		);
	};
}

/**
 * A library screen's modal dialog. Its content renders only while it is open, so a screen loads
 * the scenes it reads when the reader opens it and reads the persistent data of that moment.
 */
function Screen(handle: Handle<NovelPlayer.ScreenProps>) {
	return () => {
		let { id, title, closeLabel, open, onToggle, children } = handle.props;
		return (
			<Dialog
				id={id}
				aria-labelledby={`${id}-title`}
				data-novel-screen=""
				mix={[
					css({ inlineSize: "min(48rem, 94vw)" }),
					on("toggle", (event) => onToggle((event as ToggleEvent).newState === "open")),
				]}
			>
				<Dialog.Header>
					<Dialog.Title id={`${id}-title`}>{title}</Dialog.Title>
				</Dialog.Header>
				<div mix={css({ maxBlockSize: "65vh", overflowY: "auto" })}>{open ? children : null}</div>
				<Dialog.Close commandfor={id} aria-label={closeLabel} />
			</Dialog>
		);
	};
}

/**
 * The library screens' dialogs. Each reads the persistent data the player took as it opened;
 * chapter select and scene replay report the scene to replay and how far.
 */
function LibraryScreens(handle: Handle<NovelPlayer.LibraryProps>) {
	return () => {
		let { novel, ids, open, labels, mixer, musicTitles, onToggle, onReplay } = handle.props;
		return (
			<>
				<Screen
					id={ids.memories}
					title={labels.memories}
					closeLabel={labels.close}
					open={open?.id === ids.memories}
					onToggle={(shown) => onToggle(ids.memories, shown)}
				>
					<Memories
						novel={novel}
						persistent={open?.persistent}
						labels={labels}
						onReplayVoice={(line) => {
							if (line.voice === null) return;
							void mixer.resume();
							void mixer.playVoice(line.voice);
						}}
					/>
				</Screen>
				<Screen
					id={ids.gallery}
					title={labels.gallery}
					closeLabel={labels.close}
					open={open?.id === ids.gallery}
					onToggle={(shown) => onToggle(ids.gallery, shown)}
				>
					<Gallery novel={novel} persistent={open?.persistent} labels={labels} />
				</Screen>
				<Screen
					id={ids.music}
					title={labels.musicRoom}
					closeLabel={labels.close}
					open={open?.id === ids.music}
					onToggle={(shown) => onToggle(ids.music, shown)}
				>
					<MusicRoom
						novel={novel}
						persistent={open?.persistent}
						mixer={mixer}
						titles={musicTitles}
						labels={labels}
					/>
				</Screen>
				<Screen
					id={ids.endings}
					title={labels.endings}
					closeLabel={labels.close}
					open={open?.id === ids.endings}
					onToggle={(shown) => onToggle(ids.endings, shown)}
				>
					<EndingsList novel={novel} persistent={open?.persistent} labels={labels} />
				</Screen>
				<Screen
					id={ids.chapters}
					title={labels.chapterSelect}
					closeLabel={labels.close}
					open={open?.id === ids.chapters}
					onToggle={(shown) => onToggle(ids.chapters, shown)}
				>
					<ChapterSelect
						novel={novel}
						persistent={open?.persistent}
						labels={labels}
						onSelect={(scene) => onReplay(scene, "chapter")}
					/>
				</Screen>
				<Screen
					id={ids.scenes}
					title={labels.sceneReplay}
					closeLabel={labels.close}
					open={open?.id === ids.scenes}
					onToggle={(shown) => onToggle(ids.scenes, shown)}
				>
					<SceneReplay
						novel={novel}
						persistent={open?.persistent}
						labels={labels}
						onSelect={(scene) => onReplay(scene, "scene")}
					/>
				</Screen>
			</>
		);
	};
}
