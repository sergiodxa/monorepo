# @sdxc/novel

Visual novels declared like routes: typed scenes, a cast and assets, played as an async generator of frames.

## Installation

```sh
npm add @sdxc/novel remix
```

`remix` is a peer dependency: the player is built with `remix/component`, and state schemas can come from `remix/data-schema` or any [Standard Schema](https://standardschema.dev) library. The player reads its translator from [`@sdxc/i18n`](https://www.npmjs.com/package/@sdxc/i18n) and its screens use [`@sdxc/ui`](https://www.npmjs.com/package/@sdxc/ui), so a page that renders it loads `@sdxc/ui/theme.css`.

## Usage

### Declare a novel and play it

Declare the scenes, the cast and the assets, write each scene as a list of directives, map every scene onto its module, and start a play. A play is an async generator: each frame describes one stop, and the reply you send back is built by that frame's own method.

```typescript
import * as s from "remix/data-schema";
import {
	assets,
	cast,
	character,
	createNovel,
	createScene,
	lazy,
	scene,
	scenes,
} from "@sdxc/novel";

let SCENES = scenes({ opening: scene(), cafe: scene({ title: "scenes.cafe" }) });
let CAST = cast({
	mika: character({ name: "cast.mika", sprites: { smile: "/mika/smile.webp" } }),
});
let ASSETS = assets({ backgrounds: { street: "/bg/street.webp" } });

let opening = createScene(SCENES.opening, (ctx) => [
	ctx.show(ASSETS.backgrounds.street, { transition: "fade" }),
	ctx.enter(CAST.mika, { at: "left", expression: "smile" }),
	ctx.say(CAST.mika, "opening.hello", { name: "Ada" }),
	ctx.choose({
		"opening.follow": [ctx.set("metMika", true), ctx.goto(SCENES.cafe)],
		"opening.leave": [ctx.ending("endings.early")],
	}),
]);

let novel = createNovel({
	scenes: SCENES,
	cast: CAST,
	assets: ASSETS,
	state: s.object({ metMika: s.defaulted(s.boolean(), false) }),
	initial: SCENES.opening,
});
novel.map(SCENES.opening, opening);
novel.map(
	SCENES.cafe,
	lazy(() => import("./scenes/cafe.js")),
);

let started = novel.start();
if (started.status === "success") {
	let play = started.data;
	let step = await play.next();
	while (!step.done) {
		let frame = step.value;
		if (frame.type === "line" || frame.type === "pause") step = await play.next(frame.advance());
		else if (frame.type === "choice") step = await play.next(frame.choose(frame.options[0].id));
		else break;
	}
}
```

`./scenes/cafe.js` default-exports what `createScene(SCENES.cafe, …)` returns, and loads the first time a play reaches the scene.

### Type the story once

Augment `NovelTypes` with your state, message bundle and interactions, and every scene's keys, message values, state paths and interaction frames are checked:

```typescript
import type { StandardSchemaV1 } from "@standard-schema/spec";

import * as s from "remix/data-schema";

let STATE = s.object({
	metMika: s.defaulted(s.boolean(), false),
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
});

let en = {
	cast: { mika: "Mika" },
	opening: { hello: "Hi, {$name}!", follow: "Follow her", leave: "Leave" },
	endings: { early: "An early night" },
} as const;

declare module "@sdxc/novel" {
	interface NovelTypes {
		state: StandardSchemaV1.InferOutput<typeof STATE>;
		messages: typeof en;
	}
}
```

With state typed, `ctx.set("gold", (gold) => gold + 5)` receives a number, and a menu option that needs more than its directives is an object whose directives go in `do`:

```typescript
ctx.choose(
	{
		"cafe.flirt": {
			when: (state) => state.charm >= 50,
			visibility: "disabled",
			reason: "cafe.tooShy",
			do: [ctx.set("gold", (gold) => gold - 5), ctx.goto(SCENES.date)],
		},
		"cafe.leave": { done: true, do: [] },
	},
	{ prompt: "cafe.what", repeat: true },
);
```

### Render the player

A novel holds functions, so it cannot travel from the server as props: render `NovelPlayer` inside a client entry of your own that imports the novel. The player reads its translator from `IntlProvider` (or `setIntl()`) in `@sdxc/i18n/ui`, and fills its parent with a letterboxed 16:9 stage.

```tsx
import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { NovelPlayer } from "@sdxc/novel/ui";
import { clientEntry, css } from "remix/component";

import { novel } from "./novel.js";
import en from "./locales/en.js";

export let Game = clientEntry("/app/game.tsx#Game", function Game() {
	let i18n = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en } });
	return () => (
		<div mix={css({ blockSize: "100dvh" })}>
			<IntlProvider intl={i18n}>
				<NovelPlayer novel={novel} />
			</IntlProvider>
		</div>
	);
});
```

### Test the story

`createTestPlay` drives a play by naming each reply, `check` reads every scene without playing it, and `explore` plays every combination of choices:

```typescript
import { check, createTestPlay, explore } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel, SCENES } from "./novel.js";

test("following Mika leads to the cafe", async () => {
	let play = createTestPlay(novel, { seed: "mika" });
	await play.advanceUntil("choice");
	await play.choose("opening.follow");
	expect(play.state.metMika).toBe(true);
	expect(play.scene).toBe(SCENES.cafe);
});

test("every ending replays", async () => {
	expect((await check(novel)).ok).toBe(true);
	let report = await explore(novel);
	expect(report.errors).toEqual([]);
	for (let ending of report.endings) {
		let replay = createTestPlay(novel, { seed: ending.seed });
		await replay.follow(ending.steps);
		expect(replay.ending?.key).toBe(ending.key);
	}
});
```

## API

### `@sdxc/novel`

Declarations, scene modules, the novel and its plays. Declarations hold data and types alone, so a page, a test or a check imports them without loading a scene module.

#### `scenes(tree: SceneTree): SceneMap`

Names every scene by its dotted path, so `scenes({ spring: { cafe: scene() } })` declares `spring.cafe`. Saves and the seen-line record are keyed by that name, so renaming a scene breaks the saves that stand in it.

#### `scene(options?: { title?: LineKey }): SceneLeaf`

Declares one scene. Its title is the message key save slots and scene replay show; a scene without one is a beat no menu lists.

#### `chapter(options: { title?: LineKey; scenes: SceneTree }): ChapterLeaf`

Groups scenes into a chapter, which chapter select lists by its title and the `chapter` event reports. The chapter's key is part of every scene name under it.

#### `chapterOf(group: object): ChapterInfo | undefined`

The chapter a group of a scene map was declared as, or `undefined` for a plain group.

#### `character(options: CharacterOptions & ({ sprites } | { layers } | {})): CharacterLeaf`

Declares a character by its name's message key and an optional `color`, with a flat set of `sprites` (one shows at a time), `layers` drawn bottom to top (one variant each), or no image for a voice that never stands on stage.

```typescript
character({
	name: "cast.ren",
	layers: { body: { school: "/ren/body.webp" }, face: { grin: "/ren/grin.webp" } },
});
```

#### `cast(tree: Record<string, CharacterLeaf>): CastMap`

Names every character by its key, which the stage and saves refer to it by.

#### `assets(tree: AssetTree): AssetMap`

Names every file by its group and key (`backgrounds.cafe`). Groups are `backgrounds`, `images` (full-screen CGs), `music`, `ambience` and `sounds`; a file is a URL or a map of locale to URL, and a sound may be `{ src, caption }`. Saves keep the id, so a save loaded after a rebuild draws the file's current URL.

#### `interaction(options: { input: StandardSchemaV1; output: StandardSchemaV1 }): InteractionLeaf`

Declares a screen the app renders itself, such as a minigame, by the schemas of what goes in and what comes back. The engine hands it the parsed input and validates its reply against the output schema; both schemas need a synchronous validator.

#### `interactions(tree: Record<string, InteractionLeaf>): InteractionMap`

Names every interaction by its key, which a custom frame carries as `frame.interaction`.

#### `createScene(declaration: SceneDeclaration, build: (ctx: SceneContext) => Directive[]): SceneModule`

Builds a scene's directives once, when its module loads. The scene is plain data: state is read only inside callbacks, which the engine calls at play time. The scene's file default-exports the result for `novel.map()`. The context's directives:

- `show(asset, { transition? })`: sets the background, or shows a full-screen image over it
- `hide(asset, { transition? })`: removes the full-screen image
- `enter(character, { at, expression? | layers, transition? })`: puts a character in a column, showing a named sprite (the first by default) or a variant for every layer
- `exit(character, { transition? })`: takes a character off stage
- `express(character, { expression | layers, transition? })`: changes the sprite, or any of the layers
- `move(character, { at, transition? })`: moves a character to another column
- `say(speaker | speakers[], key, values?)`: a line spoken by one or several characters; the play stops for the reader
- `narrate(key, values?)`: a line with no speaker; a stop
- `choose(options, { prompt?, repeat?, timeout?, default? }?)`: a menu, a stop. Each option, keyed by its label, is a list of directives or `{ when?, visibility?, reason?, once?, done?, do }`; `repeat` brings the menu back after a branch that stays in the scene, `done` ends that repeat, `once` removes an option after it is taken, and `timeout` milliseconds later the menu takes `default`
- `when(condition, directives, otherwise?)`: runs one list or the other by a condition read at play time
- `set(path, value | (value, state, tools) => next)`: changes state at a dotted path
- `goto(scene)`: continues in another scene
- `call(scene)` and `back()`: plays another scene and returns to the next directive; `back()` returns early
- `wait(duration)`: a pause with no line, advanced after `duration` milliseconds
- `play(asset, { volume?, fade? })`: starts music, an ambience loop or a one-shot sound
- `stop("music" | "ambience" | ambienceAsset, { fade? })`: stops the music, every ambience loop, or one
- `custom(interaction, { input, into? })`: hands the screen to an interaction and stores its validated output at `into`; a stop
- `ending(key)`: records an ending and finishes the play

Message values are an object or a callback of the state, evaluated once when the line is reached. Callbacks receive `(state, tools)`, where `tools.random` is the play's seeded stream and `tools.persistent` what earlier playthroughs left.

Lines may use MessageFormat markup: `{#b}`, `{#i}` and `{#shake}` style their text, `{#speed rate=2}…{/speed}` types at that multiple of the reader's text speed (half without `rate`), and `{#pause ms=600/}` holds the typewriter (400ms without `ms`).

#### `lazy(load: () => Promise<{ default: SceneModule }>): Lazy`

Wraps a dynamic import so `novel.map()` defers it to the first time a play, a prefetch or a check reaches the scene; the import runs once and is shared.

#### `createNovel(options: NovelOptions): Novel`

Creates a novel from its declarations and story options; presentation settings belong to the player.

- `options.scenes`: The `scenes()` map, which names the scenes a save can stand in
- `options.cast`: The `cast()` map, which a loaded save redraws characters from
- `options.assets`: The `assets()` map, which a loaded save re-reads file URLs from
- `options.interactions`: The `interactions()` map
- `options.state`: The state schema; it gives a new play its defaults and validates every loaded save
- `options.initial`: The scene a new play starts in
- `options.rollback`: How many earlier stops `rollback()` can return to, `0` to turn it off (default `100`)
- `options.positions`: Redefines the columns `left`, `center` and `right` stand in (default `1/3`, `2/3`, `3/3`)
- `options.voice`: Finds a spoken line's voice file from `{ speaker, key, locale? }`, or answers `undefined`
- `options.version`: The version saves are stamped with (default `1`)
- `options.migrate`: Upgrade steps keyed by the version each upgrades from, each `(save) => Result<save, Error>`
- `options.messages`: Catalogs by locale; a shown key a catalog lacks is reported on `error` and the frame still carries the key
- `options.locales`: The locales `voice` is asked for, one call each (default the locales of `messages`)

#### `Novel`

One novel serves every play: it holds the declarations, the module mapped onto each scene and the listeners, and no player state. `new Novel(options)` is what `createNovel` calls.

- `novel.map(scene, module | lazy(…))`: maps a scene onto its module; mapping one twice throws
- `novel.mapped`: every mapped scene, in mapping order
- `novel.start(options?: StartOptions): Result<Play, NovelError>`: starts a play, or fails with `invalid-state` for a save or state the schemas refuse, `migration-failed` for a save no step upgrades, and `unmapped-scene` for a scene with no module
- `novel.links(scene, { depth?, locale? }): Promise<NovelLink[]>`: the `<link>` descriptors for a page starting at `scene`; `preload` for the images and sounds it shows, `prefetch` for its music and voices and every file of the scenes within `depth` jumps (default `1`). It imports lazy modules on the way and leaves `data:` URLs out
- `novel.reachable(scene, { depth?, locale? }): Promise<ReachedScene[]>`: the same scenes, nearest first, each with its files, for a player to prefetch while the reader is in `scene`
- `novel.on(name, listener): () => void` and `novel.off(name, listener)`: listen to an event of every play; a listener receives the payload and the play, and one that throws or rejects is reported on `error`
- `novel.use(plugin): Novel`: installs a function that registers listeners, so plugins chain

`StartOptions` takes `from` (a stored `GameState`, migrated and validated before the play resumes), `scene` and `state` for a new play (missing fields take their schema defaults), `seed` for the random stream, `persistent` (stored `Persistent` data; anything the schema refuses starts empty), and `replay: "scene" | "chapter"`, which finishes the play when it leaves that scene or chapter, saves nothing, and records only the lines it shows.

A `Play` is the generator itself, with `play.state` (the play as JSON at the current stop), `play.persistent`, `play.save(slot)` (emits `save` and answers the state) and `play.rollback()` (returns to the previous stop, restoring its state, stage and random draws, or answers `null`).

#### `NovelError`

The one error the engine reports, on `error` frames, `error` events and failed `Result`s, so a play never throws past its caller. `code` names the case (`NovelErrorCode`), `subject` the scene, key, asset or event, and `locale` the catalog of a `missing-message`.

#### Events

| Event     | Payload                            | When                                                                                            |
| --------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `scene`   | `{ scene }`                        | A scene starts from its top: a new play, a `goto` or a `call`                                   |
| `line`    | `{ scene, key, speakers, values }` | A line is shown                                                                                 |
| `choice`  | `{ scene, option }`                | The engine accepts an option                                                                    |
| `ending`  | `Ending`                           | An ending is reached, or the story runs out (`key: null`)                                       |
| `unlock`  | `{ kind, id }`                     | An image (`kind: "image"`) or a track (`"music"`) appears for the first time in any playthrough |
| `chapter` | `{ chapter, scene }`               | The play enters another chapter                                                                 |
| `save`    | `{ slot, state }`                  | `play.save(slot)` runs, for the app to store `state`                                            |
| `persist` | `Persistent`                       | Persistent data changes; the payload is the whole record                                        |
| `error`   | `NovelError`                       | A story problem the play continued past, or a failed listener                                   |

#### Types from `@sdxc/novel`

- `NovelTypes`: The interface an app augments with `state`, `messages` and `interactions`; without it state is any record and any key reads as a line.
- `NovelState`, `NovelMessages`, `LineKey`, `LineValues<Key>`: The declared state and bundle read back from `NovelTypes`, every message key, and the values argument a key requires.
- `StateRecord`, `StatePath<State>`, `PathValue<State, Path>`, `PathAccepting<State, Value>`, `DeepPartial<Value>`: State as any record, the dotted paths `set` takes, the value at a path, the paths whose value accepts an interaction's output, and the partial state a play or test starts from.
- `PlayTools`, `StateCallback<Value>`, `ValuesInput<Values>`, `StoredCallback<Value>`: What callbacks receive beside the state, a read-only callback of the state, message values inline or computed, and a callback as a directive stores it.
- `SceneTree`, `SceneLeaf`, `ChapterLeaf`, `SceneMap`, `SceneDeclaration<Name>`, `ChapterInfo`, `ChapterMarker`: The scene tree before and after `scenes()` names it, a named scene with its optional title and chapter, and the chapter a group is branded with.
- `CharacterOptions`, `CharacterLeaf`, `CharacterDeclaration`, `CastMap`, `CharacterImage`, `SpriteImage`, `LayerImage`, `NoImage`, `StagedCharacter`: A character before and after `cast()` names it, the three shapes its images take, and a character that can stand on stage.
- `AssetSource`, `AssetKind`, `AssetTree`, `AssetMap`, `AssetDeclaration<Kind>`, `CaptionedSound`: A file's URL or locale map, the five kinds of media, and an asset before and after `assets()` names it.
- `InteractionLeaf`, `InteractionDeclaration`, `InteractionMap`: An interaction before and after `interactions()` names it.
- `SceneContext`, `SceneModule`, `Directive`, and each directive (`ShowDirective`, `HideDirective`, `EnterDirective`, `ExitDirective`, `ExpressDirective`, `MoveDirective`, `SayDirective`, `NarrateDirective`, `ChooseDirective`, `WhenDirective`, `SetDirective`, `GotoDirective`, `CallDirective`, `BackDirective`, `WaitDirective`, `PlayDirective`, `StopDirective`, `CustomDirective`, `EndingDirective`): The builder a scene receives, the module it returns, and the plain data each directive is.
- `EnterOptions<Character>`, `ExpressOptions<Character>`, `ChoiceOptions`, `ChoiceOption`, `ChoiceOptionDirective`, `MenuOptions<Options>`: The options `enter`, `express` and `choose` take, typed from the character's images and the menu's keys, and an option as the directive stores it.
- `Frame`, `StopFrame`, `FrameBase`, `LineFrame`, `ChoiceFrame`, `FrameOption`, `PauseFrame`, `CustomFrame`, `InteractionFrame`, `ErrorFrame`, `Speaker`, `Reply`: What a play yields. Every stop carries its complete stage and audio; a line knows its speakers, voice and whether the reader has `seen` it; a reply comes only from the frame's `advance()`, `choose()` or `complete()`, and one from any other frame is refused. An error frame carries the stop to answer, or `null` when `next()` retries.
- `Ending`, `ReplayScope`, `StoryPosition`, `GameState`: How a play finished, how far a replay plays, a position anchored on a message key, and the play as JSON with its version, stack, stage, audio, state, random stream and play time.
- `Stage`, `StageScenery`, `StageCharacter`, `FrameStage`, `FrameCharacter`, `Position`, `Fraction`, `PositionAlias`, `SceneryTransition`, `CharacterTransition`: The stage as saved and as a frame shows it (with `speaking` focus and the characters that just left), columns as `n/d` or an alias, and the transition names; any name beyond the built-in ones is a CSS class the app styles.
- `Audio`, `AudioTrack`, `AudioSound`: What each channel plays at a stop: one music loop, layered ambience, the one-shots since the previous stop, and the line's voice.
- `Persistent`: What outlives a playthrough: lines read (with their values), options taken, endings, chapters and unlocked images and music.
- `Play`, `StartOptions`, `NovelOptions`, `VoiceLine`, `Migration`, `SavedObject`, `MessageCatalog`, `Lazy`: The play and the options above, and the shapes their callbacks and catalogs take.
- `NovelLink`, `ReachOptions`, `ReachedScene`, `SceneAsset`: What `links()` and `reachable()` take and answer.
- `NovelEvents`, `NovelEventName`, `NovelListener<Name>`, `NovelPlugin`, `SceneEvent`, `LineEvent`, `ChoiceEvent`, `UnlockEvent`, `ChapterEvent`, `SaveEvent`: The events above and their listeners.
- `NovelErrorCode`, `NovelErrorOptions`: What went wrong (`stale-reply`, `invalid-reply`, `unavailable-option`, `invalid-output`, `invalid-state`, `migration-failed`, `unmapped-scene`, `load-failed`, `endless-loop`, `dead-end-menu`, `missing-asset`, `missing-message`, `listener-failed`) and what an error is about.

### `@sdxc/novel/ui`

The player and the parts it is built from, as `remix/component` components; each part renders alone, so a game can build its own screens. Every component reads its translator through `intl(handle)` from `@sdxc/i18n/ui`.

#### `NovelPlayer`

Owns a play, renders its current frame and wires every input and screen. Render it inside your own client entry, since the novel it takes holds functions. It accepts the attributes of a `div` beside its own props:

- `novel`: The novel, with its scenes mapped
- `start`: The `StartOptions` the play starts from: a `scene`, `state`, `seed`, a save through `from`, and `persistent` data. The player reads it once, so mount a new player (change its `key`) to start another play
- `settings`: The `StoredSettings` the app kept; missing fields take `DEFAULT_SETTINGS`
- `onSettingsChange`: Called with the whole `NovelSettings` whenever the reader changes one
- `saves`: The stored saves by slot name, which the save and load screens show; slots are `"quick"` and `"1"` to `"<slots>"`
- `onSave`: Called with the slot and the `GameState`; the save also reaches the novel's `save` event
- `slots`: How many numbered slots the save and load screens show beside the quick slot (default `6`)
- `focus`: Enlarges and raises the speaker and dims everyone else (default `true`)
- `renderInteraction`: A component receiving `{ frame, respond }` for custom frames; without it a custom frame shows the stage and waits
- `onEnding`: Called when the play reaches an ending or runs out of story
- `labels`: Replaces any of the interface's English words (`NovelLabels`)
- `extras`: Offers Memories, the gallery, the music room, endings, chapter select and scene replay from an extras menu (default `true`)
- `prefetch`: How many jumps ahead to prefetch modules, images, sounds, voices and music as the play enters a scene, or `false` (default `1`)
- `musicTitles`: Each track's title as a message key, by asset id, for the music room
- `markup`: Line markup elements or `Trans.MarkupComponent`s beside `b`, `i`, `shake`, `speed` and `pause`

A click on the stage finishes a running transition, then the line being typed, then advances; the wheel rolls back (up) and advances (down), and holding Control skips. On touch screens a tap advances, a swipe up rolls back and a swipe down opens the backlog. Keys follow `KEYMAP`:

| Key          | Action           | Key    | Action      |
| ------------ | ---------------- | ------ | ----------- |
| Space, Enter | Advance          | `a`    | Auto        |
| ↑, Page Up   | Roll back        | `k`    | Skip        |
| ←, `l`       | Backlog          | `h`    | Hide UI     |
| `s`, `o`     | Save, load       | `f`    | Full screen |
| `q`, `w`     | Quick save, load | Escape | Settings    |

With a standard-mapping gamepad, A presses the focused control or advances, B closes the open screen or hides the interface, the shoulder buttons roll back (left) and skip (right), Start opens the settings, and the D-pad moves focus. A replay offers no saving and an End replay button.

The root carries `data-novel-player` with `data-phase`, `data-auto`, `data-skip`, `data-hidden`, `data-replay` and `data-dyslexia` for styling, and `--novel-letterbox` sets the color around the stage.

#### `Stage`, `Scenery` and `CharacterSprite`

`<Stage stage locale focus? transitions? instant?>` draws a frame's stage on a 16:9 surface letterboxed inside any box, with its children (a textbox, a menu, an interaction) above the characters, so the same component draws a play and a save thumbnail. `Scenery` is one background or image layer, and `CharacterSprite` one character, with `data-speaking` for focus and `data-exiting` while it leaves.

#### `Textbox` and `Captions`

`<Textbox frame typing textSpeed complete? onRevealed? markup?>` draws a line's speaker in their color and types the line out; it is a live region holding the whole line from the start, so a screen reader reads it at once. `<Captions sounds>` shows the captions of a frame's sounds.

#### `Message` and `lineMarkup(): Record<string, RemixElement | Trans.MarkupComponent>`

`<Message i18nKey values? markup?>` renders a message with the built-in line effects plus any `markup` adds or replaces. `lineMarkup()` answers a fresh map of those built-in effects for `Trans`.

#### `ChoiceMenu` and `timeoutOption(frame: ChoiceFrame): string | undefined`

`<ChoiceMenu frame onChoose timeLeftLabel?>` draws a menu: a locked option disabled with its reason, a taken one marked `data-chosen`, and a timed menu counting down. `timeoutOption` is the option a timed menu takes when it runs out: its `default`, else its first available option.

#### `Backlog`

`<Backlog id entries labels onReplayVoice?>` is a modal `<dialog>` listing `BacklogEntry` lines oldest first, scrolled to the newest, each with a button that replays its voice.

#### `SaveScreen`, `SlotThumbnail` and `QUICK_SLOT`

`<SaveScreen id mode slots saves locale onSelect labels>` is a modal `<dialog>` of slots that saves into any slot (`mode: "save"`) or resumes a filled one (`mode: "load"`). `<SlotThumbnail state locale>` draws a saved stage as a miniature, and `QUICK_SLOT` (`"quick"`) is the slot quick save writes.

#### `SettingsScreen` and `RangeSetting`

`<SettingsScreen id settings onChange labels>` is a modal `<dialog>` for every presentation setting, and `<RangeSetting label name value min max step onInput>` one labeled slider that reports as the reader drags.

#### `QuickMenu`

`<QuickMenu auto skip dialogs extras? replay? onAction labels>` draws the menu over the stage: buttons open the dialogs by id and report the other actions through `onAction`, and none of them advances the story.

#### `Memories`, `Gallery`, `MusicRoom` and `EndingsList`

The library screens, each taking `novel`, the stored `persistent` value (keep one value while the screen shows) and optional `labels`. `Memories` lists the lines read, scene by scene, with `onReplayVoice` to play a line's voice again; `Gallery` lists the CGs, opening an unlocked one full size; `MusicRoom` plays unlocked tracks through an optional `mixer`, with `titles` by asset id; `EndingsList` counts the endings reached. Lazily mapped scenes load as a screen opens.

#### `ChapterSelect` and `SceneReplay`

`<ChapterSelect novel persistent onSelect labels?>` lists the titled chapters and reports a reached one's first mapped scene; `SceneReplay` lists the titled scenes under their chapters and reports the one picked. Start the reported scene with `replay: "chapter"` or `"scene"`.

#### `AudioMixer`

Mixes the music, ambience, sound and voice channels through one `AudioContext`, created on first use. `new AudioMixer(volume)`; `resume()` from a user interaction, since browsers keep the context suspended until one; `reconcile(audio, locale, silent?)` brings it in line with a frame (crossfading music, layering ambience, playing each sound once); `playVoice(url)` lowers the music while a voice speaks; `preload(url)`, `stopVoice()`, `setVolume(volume)`, `snapshot` and `dispose()`.

#### `readLibrary(novel: Novel, persistent: unknown, locale: string): Promise<NovelLibrary>`

Everything the library screens show, read from the declarations and stored `Persistent` data. Every mapped scene loads, and one that fails is listed with `loaded: false` rather than failing the library.

#### `sceneLines(directives: readonly Directive[]): SceneLine[]` and `endingKeys(directives: readonly Directive[]): string[]`

Every line, and every ending key, a scene's directives declare, in document order and each once, including those inside conditions and menu options.

#### `DEFAULT_SETTINGS`, `resolveSettings(stored?: StoredSettings): NovelSettings` and `DEFAULT_LABELS`

The settings a new player starts with, the completion of stored settings with those defaults (older stores missing newer fields included), and the English labels each `labels` key replaces.

```typescript
interface NovelSettings {
	textSpeed: number; // characters per second, 0 shows a line at once (default 40)
	autoDelay: number; // ms auto waits after a line and its voice end (default 1000)
	skip: "read" | "all"; // skip read lines only, or every line (default "read")
	volume: Record<"master" | "music" | "ambience" | "sound" | "voice", number>; // 0 to 1
	fontSize: number; // multiplier on the text size (default 1)
	dyslexiaFont: boolean; // a dyslexia-friendly typeface with wider spacing
	selfVoicing: boolean; // reads lines and options aloud through speech synthesis
}
```

`NovelLabels` covers the quick menu (`menu`, `auto`, `skip`, `backlog`, `save`, `load`, `quickSave`, `quickLoad`, `settings`, `hide`, `fullscreen`, `close`, `endReplay`), the slots (`slot`, `emptySlot`), the settings (`textSpeed`, `autoDelay`, `skipMode`, `skipRead`, `skipAll`, `volumeMaster`, `volumeMusic`, `volumeAmbience`, `volumeSound`, `volumeVoice`, `fontSize`, `dyslexiaFont`, `selfVoicing`), the extras (`extras`, `memories`, `gallery`, `musicRoom`, `endings`, `chapterSelect`, `sceneReplay`, `unknownEnding`, `noMemories`, `play`, `stop`, `locked`, `loading`) and the rest (`replayVoice`, `retry`, `timeLeft`).

#### `KEYMAP` and `gamepadActions(previous: readonly boolean[], current: readonly boolean[]): GamepadAction[]`

The keyboard map by `KeyboardEvent.key`, and the actions of the gamepad buttons pressed since the previous poll, in button order.

#### `resolveSource(source: AssetSource, locale: string): string`

The URL to load for a file in a locale: the exact locale's, its language's (`es` for `es-MX`), or the first the map lists.

#### `columnOf(at: Fraction): Column` and `stillStage(stage: Stage): FrameStage`

Where a column sits on the stage as CSS percentages (a malformed one centers on the whole stage), and a saved stage as a frame would show it, with nobody speaking and no transition.

#### `BUILT_IN_TRANSITIONS` and `prefersReducedMotion(): boolean`

The scenery transitions the player draws itself as View Transitions (any other name is a class the app styles), and whether the reader asked for reduced motion, which finishes every transition at once.

#### Types from `@sdxc/novel/ui`

- `NovelPlayer.Props`, `NovelPlayer.Interaction`, `NovelPlayer.InteractionProps`: The player's props, and the component `renderInteraction` takes with the `{ frame, respond }` it receives.
- `NovelPlayer.LibraryProps`, `NovelPlayer.ScreenProps`: The props of the player's own library dialogs.
- `Stage.Props`, `Stage.SceneryProps`, `Stage.CharacterProps`, `Textbox.Props`, `Textbox.CaptionsProps`, `Message.Props`, `ChoiceMenu.Props`, `Backlog.Props`, `SaveScreen.Props`, `SaveScreen.ThumbnailProps`, `SettingsScreen.Props`, `SettingsScreen.RangeProps`, `QuickMenu.Props`, `Memories.Props`, `Gallery.Props`, `MusicRoom.Props`, `EndingsList.Props`, `ChapterSelect.Props`, `SceneReplay.Props`: Each component's props.
- `NovelSettings`, `StoredSettings`, `AudioChannel`, `SkipMode`, `NovelLabels`, `PlayerAction`, `GamepadAction`: The settings and labels above, and what a key or a gamepad button does.
- `NovelLibrary`, `LibraryChapter`, `LibraryScene`, `LibraryAsset`, `LibraryEnding`, `SceneLine`, `MemoryLine`: What `readLibrary` and `sceneLines` answer.
- `BacklogEntry`: A line as the backlog keeps it, with its values, speakers and voice for the reader's locale.
- `MixerSnapshot`: What the mixer plays now, for a test or a panel.
- `Phase`: Where the player is in a frame (`idle`, `staging`, `typing`, `waiting`, `replying`), as `data-phase` shows it.
- `RunningTransition`: A stage transition with its `finished` promise and a `finish()` that ends it early.
- `Column`: A column's `left`, `width` and whether it sits left of center.

### `@sdxc/novel/test`

#### `createTestPlay(novel: Novel, options?: StartOptions): TestPlay`

Starts a play a test drives by naming each reply, from the initial scene or from `scene` with `state` and a fixed `seed` so every draw replays. A reply that does not fit the current frame, an error frame, or a novel that refuses to start throws, so the test fails at once.

- `advance()`: starts the play or answers the current line or pause
- `advanceUntil(type)`: advances through lines and pauses until a frame of `type`, which it resolves to
- `choose(option)` and `complete(output)`: answer the current menu or interaction
- `follow(steps)`: replays a path `explore()` reported
- `save(slot)`: emits `save` and answers the state
- `frame`, `ending`, `state`, `game`, `scene`, `persistent`: where the play stands
- `transcript` and `events`: every line, option and interaction so far, and every event emitted (the novel's own listeners receive them too)
- `play`: the generator underneath, for `rollback()` or raw frames

#### `check(novel: Novel): Promise<CheckReport>`

Reads every mapped scene without playing a line. Errors break a play or a save: a key used twice in a scene, a jump to a scene with no module, an undeclared asset or character, a module that fails to load. Warnings may be intended: two characters in one column, a menu whose every option is conditional, a scene the initial one never reaches. `ok` is true when no problem is an error.

#### `explore(novel: Novel, options?: ExploreOptions): Promise<ExploreReport>`

Plays every enabled option of every menu, and every output `interactions` answers for each interaction, from each seed, skipping a stop already reached with the same state, so loops and hubs end. It reports each ending with its shortest path, dead-end menus, unexplored interactions, errors, unreachable scenes, missing messages by locale, missing assets, which caps stopped the walk, and `check()`'s problems. Every path replays in `createTestPlay(novel, { seed }).follow(steps)`.

- `options.scene`, `options.state`, `options.persistent`: Where every path starts
- `options.seeds`: The seeds to explore from, one whole walk each (default `["explore"]`)
- `options.interactions`: The outputs to try per interaction, from its input and the state
- `options.maxDepth`: Choices and interactions one path takes before it stops (default `100`)
- `options.maxPaths`: Paths explored across every seed (default `1000`)
- `options.messages`: The catalogs to find missing messages in (default the novel's `messages`)

#### Types from `@sdxc/novel/test`

- `TestPlay`, `TranscriptEntry`, `TestEvent`: The test play above, one line, option or interaction it recorded, and one event it logged.
- `CheckReport`, `CheckProblem`: What `check()` found, each problem with its `code`, `severity` and scene.
- `ExploreOptions`, `ExploreReport`, `ExplorePath`, `ExploreStep`, `ExploredEnding`, `ExploredDeadEnd`, `ExploredInteraction`, `ExploredError`, `InteractionAnswers`: What `explore()` takes and answers; a path is a seed and its steps.

### `@sdxc/novel/dev`

Developer tools that connect through the novel's events. Load them only in development: the panel jumps to any scene, rewrites state, and imports every scene module to draw the graph.

#### `createDevTools(novel: Novel, options: DevToolsOptions): DevTools`

Connects the tools to a novel. `options.restart` receives the `StartOptions` of every play the tools start, which the app passes to its player as `start` before mounting a new one; `options.limit` caps the event log (default `200`).

#### `DevTools`

Follows the last play an event fired for, or one handed to `attach(play)`.

- `play`, `state`, `persistent`, `events`, `scenes`: the followed play, its JSON and persistent data, the event log oldest first, and the mapped scene names
- `subscribe(listener): () => void` and `clear()`: hear every change, and empty the log
- `jump(scene, state): Result<StartOptions, NovelError>`: starts a play at the top of a mapped scene with state checked against the schema, keeping the persistent data
- `reload(modules): Result<ReloadResult, NovelError>`: swaps in hot-reloaded scene modules and restarts the followed play from its own save, on the same line when it still exists
- `reset({ seen?, chosen?, unlocked?, endings?, chapters? })`: clears parts of persistent data (all of it when empty) and restarts the play
- `problems(): Promise<DevProblems>` and `graph(): Promise<SceneGraph>`: `check()`'s report with the missing messages, and the scene graph
- `dispose()`: stops listening to the novel

#### `NovelDevTools`

`<NovelDevTools devtools>` renders the panel: position and state, a jump with state edited as JSON, persistent data with resets, the scene graph as a flowchart, the event log, and the problems. The graph and problems load on request.

#### `toMermaid(graph: SceneGraph): string` and `describeEvent(event: DevEvent): string`

The scene graph as a [Mermaid](https://mermaid.js.org) flowchart (a box per scene grouped by chapter, solid arrows for `goto`, dotted for `call`, a rounded node per ending, and a slanted box for a scene with no module), and one line summing up a logged event.

#### Types from `@sdxc/novel/dev`

- `DevToolsOptions`, `DevEvent`, `ReloadResult`, `ResetOptions`, `DevProblems`: The options and answers above; a logged event carries an `id` counting up and `at`, its `Date.now()`.
- `SceneGraph`, `GraphScene`, `GraphEdge`, `MissingMessage`: Every declared scene (with `mapped` and its endings), every `goto` and `call` between them, and a key one locale's catalog lacks.
- `NovelDevTools.Props`, `NovelDevTools.SectionProps`: The panel's props and those of its sections.

### `@sdxc/novel/offline`

The page side of an opt-in offline cache. A page that never registers caches nothing.

#### `registerOffline(novel: Novel, options: RegisterOptions): Promise<Result<ServiceWorkerRegistration, Error>>`

Registers your worker script and sends it the novel's declared files, again whenever a new worker takes control. It fails when the browser has no service workers or refuses the script.

- `options.url`: The worker script's URL, served from a path whose scope covers the game's page
- `options.scope`: The worker's scope
- `options.type`: `"module"` for a worker built as an ES module (default `"classic"`)
- `options.extra`: More files to cache, such as voice files, which no declaration lists

#### `offlineAssets(novel: Novel, extra?: Iterable<string>): string[]`

Every file the novel declares (each asset in every locale, every sprite and layer) plus `extra`, each once in declaration order, leaving out `data:` and `blob:` URLs.

#### Types from `@sdxc/novel/offline`

- `RegisterOptions`: The options above.

### `@sdxc/novel/offline/worker`

The worker side, which imports nothing of the engine.

#### `serveOffline(options: OfflineOptions): OfflineCache`

Called once at the top of your worker script, it turns the worker into the novel's cache: a new version takes over at once and deletes older versions' caches, and files are stored as the game first fetches them. Only `GET`s for declared files and scene module chunks are answered; navigations and documents always pass through.

- `options.version`: The build version, which names the cache
- `options.budget`: The most bytes to keep; past it the least recently used files are deleted
- `options.modules`: Which URLs are scene module chunks to cache (default none)
- `options.immutable`: Which URLs are content-hashed and served cache-first (default `isHashed`); every other declared file comes from the network first, with the cache as its offline fallback

#### `OfflineCache`

The cache `serveOffline` builds, for a worker that wires its own events: `new OfflineCache(caches, origin, options)`, `declare(urls)` records the declared files and deletes the ones no longer declared, `activate()` deletes other versions' caches, `handle(request, waitUntil)` answers a request it owns or `undefined`, and `entries()` lists the cached files.

#### `declaredUrls(data: unknown): string[] | undefined` and `ASSETS_MESSAGE`

The declared URLs in a page's message, or `undefined` for any other message, and the message type the page sends them under.

#### `isHashed(url: URL): boolean`

Whether a URL is a Vite build's content-hashed file, `/assets/<name>-<8-character hash>.<ext>`.

#### `strategyFor(request: PolicyRequest, input: PolicyInput): Strategy`

How the worker answers a request: `cache-first` for a hashed declared file or module, `revalidate` for any other, `pass` for the rest.

#### `cacheName(version: string): string`, `staleCaches(names: readonly string[], version: string): string[]`, `evict(entries, budget, keep?): string[]` and `undeclared(entries, declared, modules): string[]`

The cache policy as pure functions: a version's cache name (`sdxc-novel:<version>`), the caches an activation deletes (only this worker's older ones), the entries a budget evicts least recently used first (keeping the one just stored), and the entries a new declaration leaves behind (keeping module chunks).

#### Types from `@sdxc/novel/offline/worker`

- `OfflineOptions`: The options above.
- `Strategy`, `PolicyInput`, `PolicyRequest`, `CachedEntry`: A strategy, what the policy reads, and a cached file with its `size` and last `used` stamp.

## Pattern: Storing Saves, Settings And Persistent Data

The novel stores nothing: it emits JSON and the app keeps it. Store saves from the `save` event and persistent data from `persist`, hand them back on the next start, and pass settings through the player. Storage is read once the entry runs in the browser.

```tsx
import type { GameState } from "@sdxc/novel";
import type { StoredSettings } from "@sdxc/novel/ui";
import type { Handle } from "remix/component";

import { NovelPlayer } from "@sdxc/novel/ui";
import { clientEntry } from "remix/component";

import { novel } from "./novel.js";

function read(key: string): unknown {
	return JSON.parse(localStorage.getItem(key) ?? "null") ?? undefined;
}

novel.on("save", ({ slot, state }) => {
	let saves = (read("saves") ?? {}) as Record<string, GameState>;
	localStorage.setItem("saves", JSON.stringify({ ...saves, [slot]: state }));
});
novel.on("persist", (persistent) => localStorage.setItem("persistent", JSON.stringify(persistent)));

export let Game = clientEntry("/app/game.tsx#Game", function Game(handle: Handle) {
	let saves: Record<string, GameState> | undefined;
	handle.queueTask(() => {
		saves = (read("saves") ?? {}) as Record<string, GameState>;
		void handle.update();
	});

	return () =>
		saves === undefined ? null : (
			<NovelPlayer
				novel={novel}
				start={{ from: saves.quick, persistent: read("persistent") }}
				saves={saves}
				settings={read("settings") as StoredSettings | undefined}
				onSettingsChange={(settings) => localStorage.setItem("settings", JSON.stringify(settings))}
			/>
		);
});
```

A save the schemas refuse fails `novel.start()` with `invalid-state`, and the player shows the error. When saved state changes shape in a way schema defaults cannot fill, raise the version and add a step:

```typescript
import { createNovel } from "@sdxc/novel";
import { success } from "@sdxc/result";

import { SCENES, STATE } from "./declarations.js";

let novel = createNovel({
	scenes: SCENES,
	state: STATE,
	initial: SCENES.opening,
	version: 2,
	migrate: { 1: (save) => success({ ...save, state: { ...(save.state as object), charm: 0 } }) },
});
```

## Pattern: Prefetching The First Scene From The Page

Render `novel.links()` into the page's head, so the opening scene's images and sounds arrive decoded and the next scenes are already in the HTTP cache. The player then prefetches as the reader moves on.

```tsx
import type { NovelLink } from "@sdxc/novel";
import type { Handle } from "remix/component";

import { novel, SCENES } from "./novel.js";

function Head(handle: Handle<{ links: NovelLink[] }>) {
	return () => (
		<head>
			{handle.props.links.map((link) => (
				<link
					key={link.href}
					rel={link.rel}
					href={link.href}
					as={link.as}
					crossorigin={link.crossorigin}
				/>
			))}
		</head>
	);
}

let links = await novel.links(SCENES.opening, { depth: 1, locale: "en" });
let head = <Head links={links} />;
```

## Pattern: Voice Files Per Locale

`voice` is asked once per locale when the novel has `messages` or `locales`, which fits a folder per locale loaded with a [Vite glob import](https://vite.dev/guide/features.html#glob-import). Pass the same files to the offline worker, since no declaration lists them.

```typescript
import { createNovel } from "@sdxc/novel";

import { CAST, SCENES, STATE } from "./declarations.js";

let VOICES = import.meta.glob<string>("./voice/*/*/*.ogg", {
	query: "?url",
	import: "default",
	eager: true,
});

let novel = createNovel({
	scenes: SCENES,
	cast: CAST,
	state: STATE,
	initial: SCENES.opening,
	locales: ["en", "ja"],
	voice: ({ speaker, key, locale }) => VOICES[`./voice/${locale}/${speaker}/${key}.ogg`],
});
```

## Pattern: A Custom Interaction

Declare the interaction's input and output, hand the screen to it from a scene, and render the custom frame with your own component; the engine validates the output and stores it at `into`.

```tsx
import type { Handle } from "remix/component";

import * as s from "remix/data-schema";
import { createScene, interaction, interactions } from "@sdxc/novel";
import { NovelPlayer } from "@sdxc/novel/ui";
import { on } from "remix/component";

import { CAST, novel, SCENES } from "./novel.js";

/** Passed to `createNovel({ interactions: INTERACTIONS })`. */
export let INTERACTIONS = interactions({
	fishing: interaction({
		input: s.object({ difficulty: s.number() }),
		output: s.object({ caught: s.number() }),
	}),
});

let lake = createScene(SCENES.lake, (ctx) => [
	ctx.custom(INTERACTIONS.fishing, { input: { difficulty: 2 }, into: "lastCatch" }),
	ctx.when((state) => state.lastCatch.caught >= 3, [ctx.say(CAST.mika, "lake.impressed")]),
]);

function Fishing(handle: Handle<NovelPlayer.InteractionProps>) {
	return () => {
		let { frame, respond } = handle.props;
		if (frame.interaction !== "fishing") return null;
		return (
			<button type="button" mix={on("click", () => respond(frame.complete({ caught: 4 })))}>
				Reel in
			</button>
		);
	};
}

let player = <NovelPlayer novel={novel} renderInteraction={Fishing} />;
```

Add `interactions: typeof INTERACTIONS` to `NovelTypes` so `frame.interaction` narrows the input and output, and give `explore()` the outputs to try: `explore(novel, { interactions: { fishing: () => [{ caught: 0 }, { caught: 5 }] } })`.

## Pattern: A Title Screen With Chapter Select

The library screens are components a title screen can place itself. A chosen chapter starts as a replay, which saves nothing and finishes when the story leaves the chapter.

```tsx
import type { StartOptions } from "@sdxc/novel";
import type { Handle } from "remix/component";

import { ChapterSelect, NovelPlayer } from "@sdxc/novel/ui";

import { novel } from "./novel.js";

function Title(handle: Handle<{ persistent: unknown }>) {
	let start: StartOptions | undefined;
	return () => {
		if (start !== undefined) return <NovelPlayer novel={novel} start={start} />;
		return (
			<ChapterSelect
				novel={novel}
				persistent={handle.props.persistent}
				onSelect={(scene) => {
					start = { scene, replay: "chapter", persistent: handle.props.persistent };
					void handle.update();
				}}
			/>
		);
	};
}
```

## Pattern: Achievements As A Plugin

A plugin is a function that registers listeners, so a feature ships as one call to `novel.use()`. Listeners run after a stop settles and never change the story.

```typescript
import type { NovelPlugin } from "@sdxc/novel";

import { novel } from "./novel.js";

function achievements(unlock: (id: string) => void, byEnding: Record<string, string>): NovelPlugin {
	return (novel) => {
		novel.on("ending", ({ key }) => {
			let id = key === null ? undefined : byEnding[key];
			if (id !== undefined) unlock(id);
		});
	};
}

novel.use(
	achievements((id) => localStorage.setItem(`achievement:${id}`, "1"), {
		"endings.good": "GOOD_END",
	}),
);
```

## Pattern: Developer Tools With Hot Reload

Render the panel beside the player from a client entry the page uses only in development. Every play the tools start comes back through `restart`; changing the player's `key` mounts a new player on it, and `reload()` swaps an edited scene in on the same line.

```tsx
import type { StartOptions } from "@sdxc/novel";
import type { DevTools } from "@sdxc/novel/dev";
import type { Handle } from "remix/component";

import { createDevTools, NovelDevTools } from "@sdxc/novel/dev";
import { NovelPlayer } from "@sdxc/novel/ui";
import { clientEntry } from "remix/component";

import { novel } from "./novel.js";

export let DevGame = clientEntry("/app/dev-game.tsx#DevGame", function DevGame(handle: Handle) {
	let start: StartOptions = {};
	let restarts = 0;
	let devtools: DevTools | undefined;

	handle.queueTask(() => {
		let tools = createDevTools(novel, {
			restart(options) {
				start = options;
				restarts += 1;
				void handle.update();
			},
		});
		handle.signal.addEventListener("abort", () => tools.dispose());
		import.meta.hot?.accept(["./scenes/opening.ts", "./scenes/cafe.ts"], (modules) =>
			tools.reload(modules),
		);
		devtools = tools;
		void handle.update();
	});

	return () =>
		devtools === undefined ? null : (
			<>
				<NovelPlayer key={restarts} novel={novel} start={start} />
				<NovelDevTools devtools={devtools} />
			</>
		);
});
```

## Pattern: Playing Offline

Build the worker as its own entry, served from a path whose scope covers the game, and register it from the page. Content-hashed files are served cache-first, any other declared file from the network first with the cache as its fallback.

```typescript
// sw.ts
import { serveOffline } from "@sdxc/novel/offline/worker";

serveOffline({
	version: "2026-11-19",
	budget: 200_000_000,
	modules: (url) => url.pathname.startsWith("/assets/scenes/"),
});
```

```typescript
// the page
import { registerOffline } from "@sdxc/novel/offline";

import { novel } from "./novel.js";

let registered = await registerOffline(novel, { url: "/sw.js", type: "module" });
if (registered.status === "failure") reportError(registered.error);
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/novel": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
