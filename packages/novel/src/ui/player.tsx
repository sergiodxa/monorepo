/**
 * `NovelPlayer`: the provider every visual novel renders. It owns the play, the reader's
 * behaviors (reveal, auto, skip, backlog, saves, settings, countdown, autosave, notifications,
 * read lines), the mixer and prefetch, and publishes them with the actions to its parts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Trans } from "@sdxc/i18n/ui";
import type { Handle, Props as TagProps, RemixElement, RemixNode } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { css, on, ref, TypedEventTarget } from "remix/component";

import type { SceneDeclaration } from "../declarations.js";
import type { NovelError } from "../errors.js";
import type { Ending, GameState, ReplayScope, Reply, StopFrame } from "../frames.js";
import type { Novel, StartOptions } from "../novel.js";
import type { Persistent } from "../persistent.js";
import type { FrameStage } from "../stage.js";
import type { NovelState } from "../types.js";

import { INTERNALS } from "../novel.js";

import type { AudioMixer } from "./audio.js";
import type { AutoBehavior } from "./behaviors/auto.js";
import type { AutosaveBehavior } from "./behaviors/autosave.js";
import type { BacklogBehavior } from "./behaviors/backlog.js";
import type { CountdownBehavior } from "./behaviors/countdown.js";
import type { NotificationsBehavior } from "./behaviors/notifications.js";
import type { ReadBehavior } from "./behaviors/read.js";
import type { RevealBehavior } from "./behaviors/reveal.js";
import type { SavesBehavior } from "./behaviors/save-slots.js";
import type { SettingsBehavior } from "./behaviors/settings.js";
import type { SkipBehavior } from "./behaviors/skip.js";
import type { Phase } from "./director.js";
import type { Prefetcher } from "./prefetch.js";
import type { NovelLabels, NovelSettings, StoredSettings } from "./settings.js";

import { Backlog } from "./backlog.js";
import { AutoModel } from "./behaviors/auto.js";
import { AutosaveModel } from "./behaviors/autosave.js";
import { BacklogModel } from "./behaviors/backlog.js";
import { CountdownModel } from "./behaviors/countdown.js";
import { NotificationsModel } from "./behaviors/notifications.js";
import { ReadModel } from "./behaviors/read.js";
import { RevealModel } from "./behaviors/reveal.js";
import { SaveSlots } from "./behaviors/save-slots.js";
import { SettingsModel } from "./behaviors/settings.js";
import { SkipModel } from "./behaviors/skip.js";
import { ChapterSelect, SceneReplay } from "./chapters.js";
import { ChoiceMenu } from "./choice-menu.js";
import { gamepadControls, keyboardControls, touchControls } from "./controls.js";
import { Director } from "./director.js";
import { Encyclopedia } from "./encyclopedia.js";
import { EndingsList } from "./endings.js";
import { NovelEndingEvent, NovelSaveEvent, NovelSettingsEvent, NovelTitleEvent } from "./events.js";
import { Extras } from "./extras.js";
import { Interaction } from "./interaction.js";
import { readLibrary } from "./library.js";
import { Memories } from "./memories.js";
import { Notifications } from "./notifications.js";
import { QuickMenu } from "./quick-menu.js";
import { SaveScreen } from "./saves.js";
import { SettingsScreen } from "./settings-screen.js";
import { DEFAULT_LABELS } from "./settings.js";
import { listenerSignal } from "./signal.js";
import { Stage } from "./stage.js";
import { Captions, Line, NamePlate, NextIndicator, Textbox } from "./textbox.js";
import { themeVar } from "./theme.js";
import { Title } from "./title.js";

/** A typeface stack with dyslexia-friendly faces first; the app loads the web font it prefers. */
const DYSLEXIA_FONT = '"OpenDyslexic", "Atkinson Hyperlegible", "Lexend", Verdana, sans-serif';

export namespace NovelPlayer {
	/** A dialog the player opens by name: one of its screens or a library screen. */
	export type Screen =
		| "backlog"
		| "save"
		| "load"
		| "settings"
		| "memories"
		| "gallery"
		| "characters"
		| "encyclopedia"
		| "music"
		| "endings"
		| "chapters"
		| "scenes";

	/** Markup elements for lines, beside `b`, `i`, `shake`, `speed` and `pause`. */
	export type Markup = Record<string, RemixElement | Trans.MarkupComponent>;

	/**
	 * The reader's behaviors a player runs on, each one replaceable through the `behaviors` prop by
	 * any object implementing its interface; a slot left out takes the built-in model.
	 */
	export interface Behaviors {
		/** The current line's reveal; `RevealModel` by default. */
		reveal?: RevealBehavior;
		/** Auto mode; `AutoModel` by default. */
		auto?: AutoBehavior;
		/** Skip mode; `SkipModel` by default. */
		skip?: SkipBehavior;
		/** The lines shown so far; `BacklogModel` by default. */
		backlog?: BacklogBehavior;
		/** The save slots; `SaveSlots` by default. */
		saves?: SavesBehavior;
		/** The reader's settings; `SettingsModel` by default. */
		settings?: SettingsBehavior;
		/** A timed menu's countdown; `CountdownModel` by default. */
		countdown?: CountdownBehavior;
		/** When the play saves itself; `AutosaveModel` by default. */
		autosave?: AutosaveBehavior;
		/** The toasts queue; `NotificationsModel` by default. */
		notifications?: NotificationsBehavior;
		/** Which shown lines had been read before; `ReadModel` by default. */
		read?: ReadBehavior;
	}

	/** Events the player's context dispatches, for a behavior built inside the player to follow it. */
	export interface EventMap {
		/** Dispatched as soon as `frame` changes, before the parts render it. */
		frame: Event;
		/** Dispatched as soon as `phase` changes. */
		phase: Event;
		/** Dispatched as soon as `ending` changes: the play finished, or a new one started. */
		ending: Event;
	}

	/**
	 * What `handle.context.get(NovelPlayer)` answers to every part and mixin inside a player: the
	 * play's state, read live, the reader's behaviors, and the actions that drive the play. It is
	 * one object for the player's whole life, and its `frame`, `phase` and `ending` events let a
	 * behavior a provider part builds follow the play.
	 *
	 * @example player.addEventListener("frame", () => pulse.beat(player.frame), { signal: listenerSignal(handle) });
	 */
	export interface Context extends TypedEventTarget<EventMap> {
		readonly novel: Novel;
		/** The player's root element, once it is in the document. */
		readonly element: HTMLElement | undefined;
		/** The dialog open in the player, which takes keys and the gamepad while it is open. */
		readonly dialog: HTMLDialogElement | null;
		/** The stop the play shows, or `undefined` before its first one. */
		readonly frame: StopFrame | undefined;
		readonly phase: Phase;
		/** How the play finished, once it has. */
		readonly ending: Ending | undefined;
		/**
		 * What the stage draws: the frame's stage, or once the play ends, the stage the story
		 * finished on, with whoever left after the last line in `exits`.
		 */
		readonly stage: FrameStage | undefined;
		/**
		 * The story state at the current stop, as the play's `GameState.state` holds it, or
		 * `undefined` before the play starts. It is one value per stop, so a part can key on it.
		 */
		readonly state: NovelState | undefined;
		/** The error the play reported at the current stop. */
		readonly error: NovelError | undefined;
		/** True when an error stopped the play before its first stop; `retry()` tries again. */
		readonly stalled: boolean;
		/** True while the current frame's transitions end at once: skip, rollback, reduced motion. */
		readonly instant: boolean;
		/** True while the reader has hidden the interface to look at the stage. */
		readonly hidden: boolean;
		/** True while the play is a replay, which never saves. */
		readonly replaying: boolean;
		/** True when the player hands the reader back to a title screen as `returnsToTitle` asks. */
		readonly returnsToTitle: boolean;
		/**
		 * Persistent data as the play has updated it, or the stored value passed in `start`
		 * before the play begins. It is one value per render, so a screen can key on it.
		 */
		readonly persistent: Persistent | undefined;
		/** The interface's words: the English defaults with the `labels` prop over them. */
		readonly labels: NovelLabels;
		readonly locale: string;
		readonly markup: Markup | undefined;
		/** The id of each dialog, for a `commandfor` button to open it without script. */
		readonly ids: Readonly<Record<Screen, string>>;
		/**
		 * The CSS anchor name on the player's root, unique per player, so a part in the top layer
		 * (the toasts) positions itself over the player with `position-anchor`.
		 */
		readonly anchor: string;
		/** The current line's reveal, which the textbox's line drives. */
		readonly reveal: RevealBehavior;
		readonly auto: AutoBehavior;
		readonly skip: SkipBehavior;
		readonly backlog: BacklogBehavior;
		readonly saves: SavesBehavior;
		readonly settings: SettingsBehavior;
		/** A timed menu's countdown; it answers the menu with its default when it expires. */
		readonly countdown: CountdownBehavior;
		/** Saves the play into its `slot` when it asks, through `save()`. */
		readonly autosave: AutosaveBehavior;
		/** The toasts `NovelPlayer.Notifications` shows; `push()` adds a game's own. */
		readonly notifications: NotificationsBehavior;
		/** Whether the current line and each backlog line had been read before. */
		readonly read: ReadBehavior;
		readonly mixer: AudioMixer;
		readonly prefetcher: Prefetcher;
		/** Answers the current frame with a reply built by one of its methods. */
		answer(reply: Reply): void;
		/** Advances a line or pause, finishing a running transition or reveal first. */
		advance(): void;
		/** Returns to the previous stop, shown at once. */
		rollback(): Promise<void>;
		/**
		 * Saves the play into `slot`, keeps it in `saves` and dispatches `novel:save`.
		 *
		 * @returns The play as JSON, or `undefined` before the play starts and during a replay.
		 */
		save(slot: string): GameState | undefined;
		/** Resumes the play saved in `slot`, when it holds one. */
		load(slot: string): Promise<void>;
		/** Replaces every setting; the change leaves as `novel:settings`. */
		setSettings(next: NovelSettings): void;
		/** Turns auto mode on or off; hiding the tab turns it off, so the play waits for the reader. */
		toggleAuto(): void;
		toggleSkip(): void;
		/** Skips while `held` is true, the way held Control does. */
		holdSkip(held: boolean): void;
		/** Hides the interface, shows it with `false`, or toggles it without an argument. */
		hide(hidden?: boolean): void;
		/** Enters or leaves full screen with the player as the full-screen element. */
		toggleFullscreen(): void;
		/** Closes the open dialog and replays `scene`, resuming this play when the replay ends. */
		replay(scene: SceneDeclaration, scope: ReplayScope): Promise<void>;
		/**
		 * Ends a replay, resuming the play it interrupted; with nothing to resume, it finishes like
		 * an ending, or returns to the title under `returnsToTitle`.
		 */
		endReplay(): Promise<void>;
		/** Closes the open dialog and dispatches `novel:title` with the play's persistent data. */
		toTitle(): void;
		/** Opens one of the player's dialogs, when it is rendered. */
		open(screen: Screen): void;
		/** The character the characters screen opens on, as `showCharacter()` last asked. */
		readonly character: string | undefined;
		/**
		 * Opens the encyclopedia's characters page on `id`, or else the characters screen, when the
		 * player offers either.
		 */
		showCharacter(id: string): void;
		/** Asks for the first stop again after an error stopped the play before it. */
		retry(): void;
		/**
		 * Starts a new play from the novel's first scene, keeping what earlier playthroughs
		 * read, chose and reached; the ending screen's button calls it.
		 */
		restart(): Promise<void>;
	}

	/** Props {@link NovelPlayer} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		novel: Novel;
		/**
		 * Where the play starts: a scene, a state, a seed, a save through `from`, and `persistent`
		 * data. It is read once, at mount; a new play needs a remount, done by changing `key`.
		 */
		start?: StartOptions;
		/**
		 * The settings the app stored; missing fields take their defaults. They reach the settings
		 * behavior through `replace()`, a custom one included, whenever the prop is given or changes.
		 */
		settings?: StoredSettings;
		/**
		 * The saves the app stored, by slot name. They reach the saves behavior through `replace()`,
		 * a custom one included, whenever the prop is given or changes.
		 */
		saves?: Readonly<Record<string, GameState>>;
		/**
		 * Replaces any of the reader's behaviors with the app's own implementation; the rest are
		 * the built-in models. It is read once, at mount, like `start`.
		 *
		 * @example behaviors={{ auto: new VoiceAwareAuto(), backlog: new SyncedBacklog(api) }}
		 */
		behaviors?: Behaviors;
		/** Replaces any of the interface's English labels. */
		labels?: Partial<NovelLabels>;
		markup?: Markup;
		/**
		 * How many jumps ahead to prefetch when the play enters a scene: its modules, images,
		 * sounds, voices and music. `false` prefetches nothing.
		 *
		 * @default 1
		 */
		prefetch?: number | false;
		/**
		 * Hands the reader back to a title screen: the ending's button returns there in place of
		 * Play again, and a replay with no play to resume returns there as it ends, each through
		 * `novel:title`.
		 */
		returnsToTitle?: boolean;
		/** The parts the player is composed of; `NovelPlayer.Default` holds every one. */
		children?: RemixNode;
	}

	/** Props {@link NovelPlayer.Default} accepts. */
	export interface DefaultProps extends Omit<Props, "children"> {
		/** Drawn on the stage with the built-in parts, such as a `NovelPlayer.Interaction` part. */
		children?: RemixNode;
		/**
		 * Opens on `NovelPlayer.Title` with this heading, art, footer and screens, plays what the
		 * reader starts there and returns there when it ends; `start` is what every such play
		 * extends. Without it the play starts at once. `mix` applies to the title, then the player.
		 *
		 * @example titleScreen={{ heading: "The Café", art: <img src={keyArt} alt="" /> }}
		 */
		titleScreen?: Title.Options;
	}
}

/**
 * Plays a novel and provides {@link NovelPlayer.Context} to the parts and mixins inside it; it
 * renders nothing of its own but a root element. It reads its translator from `IntlProvider`,
 * renders inside the app's own client entry since a novel holds functions, and reads `start`
 * and `behaviors` once, at mount. Saves (autosaves included), settings and endings leave as
 * `novel:save`, `novel:settings` and `novel:ending`. Every visual decision of the parts is a
 * `--novel-*` variable set on it: `NOVEL_THEME_VARIABLES` lists them with their defaults.
 *
 * @example <NovelPlayer novel={novel} mix={[keyboardControls(), on("novel:save", store)]}><NovelPlayer.Stage><NovelPlayer.Textbox /></NovelPlayer.Stage></NovelPlayer>
 * @example <NovelPlayer.Default novel={novel} settings={stored} saves={saves} />
 */
export function NovelPlayer(handle: Handle<NovelPlayer.Props, NovelPlayer.Context>) {
	let root: HTMLElement | undefined;
	let seenSettings = handle.props.settings;
	let seenSaves = handle.props.saves;
	let hidden = false;
	let labels: NovelLabels = { ...DEFAULT_LABELS, ...handle.props.labels };
	let persistent: { value: Persistent | undefined } | undefined;
	let story: { value: NovelState | undefined } | undefined;
	let behaviors = handle.props.behaviors ?? {};
	let settings = behaviors.settings ?? new SettingsModel();
	let saves = behaviors.saves ?? new SaveSlots();
	let countdown = behaviors.countdown ?? new CountdownModel();
	let autosave = behaviors.autosave ?? new AutosaveModel();
	let notifications = behaviors.notifications ?? new NotificationsModel();
	let read = behaviors.read ?? new ReadModel();
	/** True when autosave asked mid-step, so the save waits for the stop the step reaches. */
	let autosaveDue = false;
	if (seenSettings !== undefined) settings.replace(seenSettings);
	if (seenSaves !== undefined) saves.replace(seenSaves);
	let ids = Object.fromEntries(
		(
			[
				"backlog",
				"save",
				"load",
				"settings",
				"memories",
				"gallery",
				"characters",
				"encyclopedia",
				"music",
				"endings",
				"chapters",
				"scenes",
			] as const
		).map((screen) => [screen, `${handle.id}-${screen}`.replace(/[^\w-]/g, "-")]),
	) as Record<NovelPlayer.Screen, string>;
	let anchor = `--novel-${handle.id.replace(/[^\w-]/g, "-")}`;
	let shownCharacter: string | undefined;

	/** Opens one of the player's dialogs, when it is rendered. */
	function open(screen: NovelPlayer.Screen): void {
		let dialog = root?.querySelector<HTMLDialogElement>(`#${ids[screen]}`);
		if (dialog !== null && dialog !== undefined && !dialog.open) dialog.showModal();
	}

	/** Declared before the director, whose callbacks dispatch on it; its members are set below. */
	let context = new TypedEventTarget<NovelPlayer.EventMap>() as NovelPlayer.Context;

	let director = new Director(
		{
			novel: () => handle.props.novel,
			render: async () => {
				await handle.update();
			},
			stage: () => root?.querySelector("[data-novel-stage]") ?? null,
			locale: () => intl(handle).locale,
			text: () =>
				root?.querySelector("[data-novel-textbox], [data-novel-choices]")?.textContent?.trim() ??
				"",
			settings: () => settings.value,
			onEnding: (ending, replay) => {
				root?.dispatchEvent(new NovelEndingEvent(ending));
				if (replay && handle.props.returnsToTitle === true) toTitle();
			},
			changed: (what) => {
				story = undefined;
				context.dispatchEvent(new Event(what));
			},
			prefetch: () => handle.props.prefetch ?? 1,
		},
		{
			reveal: behaviors.reveal ?? new RevealModel(settings.value.textSpeed),
			auto: behaviors.auto ?? new AutoModel(),
			skip: behaviors.skip ?? new SkipModel(),
			backlog: behaviors.backlog ?? new BacklogModel(),
		},
	);

	settings.addEventListener(
		"change",
		() => {
			let next = settings.value;
			director.mixer.setVolume(next.volume);
			if (!next.selfVoicing && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
			root?.dispatchEvent(new NovelSettingsEvent(next));
			void handle.update();
		},
		{ signal: listenerSignal(handle) },
	);
	countdown.addEventListener(
		"expire",
		(event) => {
			if (director.frame === event.frame) answer(event.frame.choose(event.option));
		},
		{ signal: listenerSignal(handle) },
	);
	autosave.addEventListener(
		"save",
		() => {
			if (director.replaying) return;
			if (director.phase === "replying" || director.frame === undefined) autosaveDue = true;
			else save(autosave.slot);
		},
		{ signal: listenerSignal(handle) },
	);
	if (typeof document !== "undefined") {
		document.addEventListener(
			"visibilitychange",
			() => {
				if (!document.hidden) return;
				if (director.auto.enabled) director.auto.toggle();
				autosave.leave?.();
			},
			{ signal: listenerSignal(handle) },
		);
	}
	listenToNovel();
	handle.signal.addEventListener("abort", () => {
		director.dispose();
		countdown.cancel();
	});
	handle.queueTask(() => {
		if (handle.signal.aborted) return;
		void director.begin(handle.props.start);
	});

	/**
	 * Feeds autosave and notifications from the novel's events for this player's own play,
	 * outside replays, until the player leaves the page.
	 */
	function listenToNovel(): void {
		let novel = handle.props.novel;
		let ours = (play: unknown) => play === director.play && !director.replaying;
		let stops = [
			novel.on("chapter", (_event, play) => {
				if (ours(play)) autosave.chapter();
			}),
			novel.on("line", (_event, play) => {
				if (ours(play)) autosave.line();
			}),
			novel.on("unlock", (event, play) => {
				if (!ours(play)) return;
				notifications.push({ text: unlockedText(event.kind, event.id), kind: event.kind });
			}),
			novel.on("notify", (event, play) => {
				if (ours(play))
					notifications.push({ key: event.key, values: event.values, kind: "notify" });
			}),
			novel.on("ending", (event, play) => {
				if (ours(play) && event.key !== null) void notifyEnding(play.persistent);
			}),
		];
		handle.signal.addEventListener("abort", () => {
			for (let stop of stops) stop();
		});
	}

	/** What the toast for an unlock says: "CG unlocked", or "New entry: The pier" for an entry. */
	function unlockedText(kind: "image" | "music" | "entry", id: string): string {
		if (kind === "image") return labels.imageUnlocked;
		if (kind === "music") return labels.musicUnlocked;
		let title = handle.props.novel[INTERNALS]().entries.get(id)?.title;
		let t = intl(handle).t as (key: string) => string;
		return title === undefined ? labels.entryUnlocked : `${labels.entryUnlocked}: ${t(title)}`;
	}

	/** Pushes "Ending 3/5": the endings reached in any playthrough out of every ending the scenes hold. */
	async function notifyEnding(record: Persistent): Promise<void> {
		let library = await readLibrary(handle.props.novel, record, intl(handle).locale);
		if (handle.signal.aborted) return;
		let reached = library.endings.filter((ending) => ending.reached).length;
		notifications.push({
			text: `${labels.endingReached} ${reached}/${library.endings.length}`,
			kind: "ending",
		});
	}

	/** The dialog open in the player. */
	function openDialog(): HTMLDialogElement | null {
		return root?.querySelector<HTMLDialogElement>("dialog[open]") ?? null;
	}

	/** Answers the current frame, stopping a menu's countdown. */
	function answer(reply: Reply): void {
		countdown.cancel();
		director.reply(reply);
	}

	/** Saves the play into `slot` and keeps the save so the screens show it at once. */
	function save(slot: string): GameState | undefined {
		let state = director.save(slot);
		if (state === undefined) return undefined;
		saves.put(slot, state);
		root?.dispatchEvent(new NovelSaveEvent(slot, state));
		return state;
	}

	/** Resumes the play saved in `slot`. */
	async function load(slot: string): Promise<void> {
		let state = saves.get(slot);
		if (state !== undefined) await director.load(state);
	}

	/** Hands the reader back to the title with persistent data as this play left it. */
	function toTitle(): void {
		openDialog()?.close();
		root?.dispatchEvent(new NovelTitleEvent(director.persistent));
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

	let members: Omit<NovelPlayer.Context, keyof EventTarget> = {
		get novel() {
			return handle.props.novel;
		},
		get element() {
			return root;
		},
		get dialog() {
			return openDialog();
		},
		get frame() {
			return director.frame;
		},
		get phase() {
			return director.phase;
		},
		get ending() {
			return director.ending;
		},
		get stage() {
			return director.stage;
		},
		get state() {
			story ??= { value: director.state?.state };
			return story.value;
		},
		get error() {
			return director.error;
		},
		get stalled() {
			return director.stalled;
		},
		get instant() {
			return director.instant;
		},
		get hidden() {
			return hidden;
		},
		get replaying() {
			return director.replaying;
		},
		get returnsToTitle() {
			return handle.props.returnsToTitle === true;
		},
		get persistent() {
			persistent ??= {
				value: director.persistent ?? storedPersistent(handle.props.novel, handle.props.start),
			};
			return persistent.value;
		},
		get labels() {
			return labels;
		},
		get locale() {
			return intl(handle).locale;
		},
		get markup() {
			return handle.props.markup;
		},
		ids,
		anchor,
		reveal: director.reveal,
		auto: director.auto,
		skip: director.skip,
		backlog: director.backlog,
		saves,
		settings,
		countdown,
		autosave,
		notifications,
		read,
		get mixer() {
			return director.mixer;
		},
		get prefetcher() {
			return director.prefetcher;
		},
		answer,
		advance: () => director.advance(),
		rollback: () => director.rollback(),
		save,
		load,
		setSettings: (next) => settings.set(next),
		toggleAuto: () => director.auto.toggle(),
		toggleSkip: () => director.skip.toggle(),
		holdSkip: (held) => director.skip.hold(held),
		hide,
		toggleFullscreen,
		replay: async (scene, scope) => {
			openDialog()?.close();
			await director.replay(scene, scope);
		},
		endReplay: () => director.endReplay(),
		toTitle,
		open,
		get character() {
			return shownCharacter;
		},
		showCharacter: (id) => {
			shownCharacter = id;
			let book = root?.querySelector(`#${ids.encyclopedia}`);
			open(book instanceof HTMLDialogElement ? "encyclopedia" : "characters");
		},
		retry: () => director.retry(),
		restart: async () => {
			openDialog()?.close();
			await director.restart();
		},
	};
	Object.defineProperties(context, Object.getOwnPropertyDescriptors(members));
	handle.context.set(context);
	context.addEventListener(
		"frame",
		() => {
			let frame = director.frame;
			if (frame === undefined) return;
			read.record(frame);
			if (!autosaveDue) return;
			autosaveDue = false;
			save(autosave.slot);
		},
		{ signal: listenerSignal(handle) },
	);

	return () => {
		let {
			novel: _novel,
			start: _start,
			settings: stored,
			saves: storedSaves,
			labels: labelOverrides,
			markup: _markup,
			prefetch: _prefetch,
			behaviors: _behaviors,
			returnsToTitle: _returnsToTitle,
			children,
			mix,
			...rest
		} = handle.props;
		if (stored !== seenSettings) {
			seenSettings = stored;
			settings.replace(stored);
		}
		if (storedSaves !== seenSaves) {
			seenSaves = storedSaves;
			saves.replace(storedSaves);
		}
		labels = { ...DEFAULT_LABELS, ...labelOverrides };
		persistent = undefined;
		story = undefined;
		let current = settings.value;
		return (
			<div
				{...rest}
				data-novel-player=""
				data-phase={director.phase}
				data-auto={String(director.auto.enabled)}
				data-skip={String(director.skip.active)}
				data-hidden={String(hidden)}
				data-replay={String(director.replaying)}
				data-dyslexia={String(current.dyslexiaFont)}
				style={{ "--novel-font-scale": current.fontSize, anchorName: anchor }}
				mix={[
					ref((node) => {
						root = node;
					}),
					css({
						position: "relative",
						inlineSize: "100%",
						blockSize: "100%",
						background: themeVar("--novel-letterbox"),
						color: themeVar("--novel-color"),
						userSelect: "none",
						WebkitUserSelect: "none",
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
				{children}
			</div>
		);
	};
}

/** The persistent data a play passes in `start`, read once a screen asks, before the play runs. */
function storedPersistent(novel: Novel, start: StartOptions | undefined): Persistent | undefined {
	return start?.persistent === undefined
		? undefined
		: novel[INTERNALS]().persistent(start.persistent);
}

NovelPlayer.Stage = Stage;
NovelPlayer.Textbox = Textbox;
NovelPlayer.NamePlate = NamePlate;
NovelPlayer.Line = Line;
NovelPlayer.NextIndicator = NextIndicator;
NovelPlayer.Captions = Captions;
NovelPlayer.Choices = ChoiceMenu;
NovelPlayer.Interaction = Interaction;
NovelPlayer.QuickMenu = QuickMenu;
NovelPlayer.Backlog = Backlog;
NovelPlayer.Saves = SaveScreen;
NovelPlayer.Settings = SettingsScreen;
NovelPlayer.Extras = Extras;
NovelPlayer.Notifications = Notifications;
NovelPlayer.Title = Title;

/**
 * The whole player as one component: every part in the classic layout, the seven library screens
 * in the extras menu, the notifications, and keyboard, touch and gamepad controls. Its children
 * are drawn on the stage; given `titleScreen`, it opens on the title and returns there as a play ends.
 *
 * @example <NovelPlayer.Default novel={novel} settings={stored}><NovelPlayer.Interaction interactions={INTERACTIONS}>{(frame) => <Fishing input={frame.input} />}</NovelPlayer.Interaction></NovelPlayer.Default>
 */
NovelPlayer.Default = function NovelPlayerDefault(handle: Handle<NovelPlayer.DefaultProps>) {
	/** The play the reader began on the title screen, until they return to the title. */
	let chosen: StartOptions | undefined;
	/**
	 * The settings the reader changed, which the title and the next play start with until the app
	 * passes new ones.
	 */
	let changed: StoredSettings | undefined;
	/**
	 * What plays made since mount left: saves by slot and the latest persistent data, so the title
	 * a play returns to offers them. A new `saves` or `start` prop from the app replaces them.
	 */
	let since: { saves: Record<string, GameState>; persistent?: Persistent } = { saves: {} };
	let seen = {
		saves: handle.props.saves,
		start: handle.props.start,
		settings: handle.props.settings,
	};
	return () => {
		let { children, mix, titleScreen, ...rest } = handle.props;
		if (rest.saves !== seen.saves) since = { ...since, saves: {} };
		if (rest.start !== seen.start) since = { saves: since.saves };
		if (rest.settings !== seen.settings) changed = undefined;
		seen = { saves: rest.saves, start: rest.start, settings: rest.settings };
		if (titleScreen !== undefined && chosen === undefined) {
			let { screens, ...look } = titleScreen;
			let saves =
				Object.keys(since.saves).length === 0 ? rest.saves : { ...rest.saves, ...since.saves };
			let start =
				since.persistent === undefined
					? rest.start
					: { ...rest.start, persistent: since.persistent };
			return (
				<Title
					{...look}
					novel={rest.novel}
					saves={saves}
					start={start}
					settings={changed ?? rest.settings}
					labels={rest.labels}
					mix={[
						on("novel:settings", (event) => {
							changed = event.settings;
						}),
						on("novel:start", (event) => {
							chosen = event.start;
							void handle.update();
						}),
						mix,
					]}
				>
					{screens}
				</Title>
			);
		}
		return (
			<NovelPlayer
				{...rest}
				start={chosen ?? rest.start}
				settings={changed ?? rest.settings}
				returnsToTitle={titleScreen !== undefined}
				mix={[
					keyboardControls(),
					touchControls(),
					gamepadControls(),
					on("novel:settings", (event) => {
						changed = event.settings;
					}),
					on("novel:save", (event) => {
						since.saves[event.slot] = event.state;
					}),
					on("novel:title", (event) => {
						if (event.persistent !== undefined) since.persistent = event.persistent;
						chosen = undefined;
						void handle.update();
					}),
					mix,
				]}
			>
				<Stage>
					<Captions />
					<Textbox />
					<ChoiceMenu />
					{children}
					<QuickMenu>
						<Extras>
							<Memories />
							<Encyclopedia />
							<EndingsList />
							<ChapterSelect />
							<SceneReplay />
						</Extras>
					</QuickMenu>
				</Stage>
				<Backlog />
				<SaveScreen />
				<SettingsScreen />
				<Notifications />
			</NovelPlayer>
		);
	};
};
