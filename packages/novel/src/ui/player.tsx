/**
 * `NovelPlayer`: the provider every visual novel renders. It owns the play, the reader's
 * behaviors (reveal, auto, skip, backlog, saves, settings, countdown), the mixer and prefetch,
 * and publishes them with the actions that drive the play to the parts composed inside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Trans } from "@sdxc/i18n/ui";
import type { Handle, Props as TagProps, RemixElement, RemixNode } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { css, on, ref } from "remix/component";

import type { SceneDeclaration } from "../declarations.js";
import type { NovelError } from "../errors.js";
import type { Ending, GameState, ReplayScope, Reply, StopFrame } from "../frames.js";
import type { Novel, StartOptions } from "../novel.js";
import type { Persistent } from "../persistent.js";

import { readPersistent } from "../persistent.js";

import type { AudioMixer } from "./audio.js";
import type { Phase } from "./director.js";
import type { Prefetcher } from "./prefetch.js";
import type { NovelLabels, NovelSettings, StoredSettings } from "./settings.js";

import { Backlog } from "./backlog.js";
import { AutoModel } from "./behaviors/auto.js";
import { BacklogModel } from "./behaviors/backlog.js";
import { CountdownModel } from "./behaviors/countdown.js";
import { RevealModel } from "./behaviors/reveal.js";
import { SaveSlots } from "./behaviors/save-slots.js";
import { SettingsModel } from "./behaviors/settings.js";
import { SkipModel } from "./behaviors/skip.js";
import { ChapterSelect, SceneReplay } from "./chapters.js";
import { ChoiceMenu } from "./choice-menu.js";
import { gamepadControls, keyboardControls, touchControls } from "./controls.js";
import { Director } from "./director.js";
import { EndingsList } from "./endings.js";
import { NovelEndingEvent, NovelSaveEvent, NovelSettingsEvent } from "./events.js";
import { Extras } from "./extras.js";
import { Gallery } from "./gallery.js";
import { Interaction } from "./interaction.js";
import { Memories } from "./memories.js";
import { MusicRoom } from "./music-room.js";
import { QuickMenu } from "./quick-menu.js";
import { SaveScreen } from "./saves.js";
import { SettingsScreen } from "./settings-screen.js";
import { DEFAULT_LABELS } from "./settings.js";
import { Stage } from "./stage.js";
import { Captions, Line, NamePlate, NextIndicator, Textbox } from "./textbox.js";
import { themeVar } from "./theme.js";

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
		| "music"
		| "endings"
		| "chapters"
		| "scenes";

	/** Markup elements for lines, beside `b`, `i`, `shake`, `speed` and `pause`. */
	export type Markup = Record<string, RemixElement | Trans.MarkupComponent>;

	/**
	 * What `handle.context.get(NovelPlayer)` answers to every part and mixin inside a player: the
	 * play's state, read live, the reader's behaviors as models a custom part reuses, and the
	 * actions that drive the play. It is one object for the player's whole life.
	 */
	export interface Context {
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
		/** The current line's reveal, which the textbox's line drives. */
		readonly typewriter: RevealModel;
		readonly auto: AutoModel;
		readonly skip: SkipModel;
		readonly backlog: BacklogModel;
		readonly saves: SaveSlots;
		readonly settings: SettingsModel;
		/** A timed menu's countdown; it answers the menu with its default when it expires. */
		readonly countdown: CountdownModel;
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
		/** Ends a replay, resuming the play it interrupted. */
		endReplay(): Promise<void>;
		/** Opens one of the player's dialogs, when it is rendered. */
		open(screen: Screen): void;
		/** Asks for the first stop again after an error stopped the play before it. */
		retry(): void;
	}

	/** Props {@link NovelPlayer} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		novel: Novel;
		/**
		 * Where the play starts: a scene, a state, a seed, a save through `from`, and `persistent`
		 * data. It is read once, at mount; a new play needs a remount, done by changing `key`.
		 */
		start?: StartOptions;
		/** The settings the app stored; missing fields take their defaults. */
		settings?: StoredSettings;
		/** The saves the app stored, by slot name. */
		saves?: Readonly<Record<string, GameState>>;
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
		/** The parts the player is composed of; `NovelPlayer.Default` holds every one. */
		children?: RemixNode;
	}

	/** Props {@link NovelPlayer.Default} accepts. */
	export interface DefaultProps extends Omit<Props, "children"> {
		/** Drawn on the stage with the built-in parts, such as `NovelPlayer.Interaction` parts. */
		children?: RemixNode;
	}
}

/**
 * Plays a novel and provides {@link NovelPlayer.Context} to the parts and mixins inside it; it
 * renders nothing of its own but a root element. It reads its translator from `IntlProvider`,
 * renders inside the app's own client entry since a novel holds functions, and reads `start`
 * once, at mount. Saves, settings and endings leave as `novel:save`, `novel:settings` and
 * `novel:ending`. Every visual decision of the parts is a `--novel-*` variable set on it:
 * `NOVEL_THEME_VARIABLES` lists them with their defaults.
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
	let settings = new SettingsModel(handle.props.settings);
	let saves = new SaveSlots(handle.props.saves);
	let countdown = new CountdownModel();
	let ids = Object.fromEntries(
		(
			[
				"backlog",
				"save",
				"load",
				"settings",
				"memories",
				"gallery",
				"music",
				"endings",
				"chapters",
				"scenes",
			] as const
		).map((screen) => [screen, `${handle.id}-${screen}`.replace(/[^\w-]/g, "-")]),
	) as Record<NovelPlayer.Screen, string>;

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
			onEnding: (ending) => root?.dispatchEvent(new NovelEndingEvent(ending)),
			prefetch: () => handle.props.prefetch ?? 1,
		},
		{
			reveal: new RevealModel(settings.value.textSpeed),
			auto: new AutoModel(),
			skip: new SkipModel(),
			backlog: new BacklogModel(),
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
		{ signal: handle.signal },
	);
	countdown.addEventListener(
		"expire",
		(event) => {
			if (director.frame === event.frame) answer(event.frame.choose(event.option));
		},
		{ signal: handle.signal },
	);
	handle.signal.addEventListener("abort", () => {
		director.dispose();
		countdown.cancel();
	});
	handle.queueTask(() => {
		if (handle.signal.aborted) return;
		void director.begin(handle.props.start);
	});

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

	let context: NovelPlayer.Context = {
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
		get persistent() {
			persistent ??= { value: director.persistent ?? storedPersistent(handle.props.start) };
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
		typewriter: director.reveal,
		auto: director.auto,
		skip: director.skip,
		backlog: director.backlog,
		saves,
		settings,
		countdown,
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
		open: (screen) => {
			let dialog = root?.querySelector<HTMLDialogElement>(`#${ids[screen]}`);
			if (dialog !== null && dialog !== undefined && !dialog.open) dialog.showModal();
		},
		retry: () => director.retry(),
	};
	handle.context.set(context);

	return () => {
		let {
			novel: _novel,
			start: _start,
			settings: stored,
			saves: storedSaves,
			labels: labelOverrides,
			markup: _markup,
			prefetch: _prefetch,
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
				style={{ "--novel-font-scale": current.fontSize }}
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
function storedPersistent(start: StartOptions | undefined): Persistent | undefined {
	return start?.persistent === undefined ? undefined : readPersistent(start.persistent);
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

/**
 * The whole player as one component: every part in the classic layout, the six library screens
 * in the extras menu, and keyboard, touch and gamepad controls. Its children are drawn on the
 * stage, which is where a game's `NovelPlayer.Interaction` parts go.
 *
 * @example <NovelPlayer.Default novel={novel} settings={stored}><NovelPlayer.Interaction name="fishing" component={Fishing} /></NovelPlayer.Default>
 */
NovelPlayer.Default = function NovelPlayerDefault(handle: Handle<NovelPlayer.DefaultProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<NovelPlayer {...rest} mix={[keyboardControls(), touchControls(), gamepadControls(), mix]}>
				<Stage>
					<Captions />
					<Textbox />
					<ChoiceMenu />
					{children}
					<QuickMenu>
						<Extras>
							<Memories />
							<Gallery />
							<MusicRoom />
							<EndingsList />
							<ChapterSelect />
							<SceneReplay />
						</Extras>
					</QuickMenu>
				</Stage>
				<Backlog />
				<SaveScreen />
				<SettingsScreen />
			</NovelPlayer>
		);
	};
};
