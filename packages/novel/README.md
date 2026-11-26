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
	mika: character({ name: "cast.mika", known: true, sprites: { smile: "/mika/smile.webp" } }),
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

Augment `NovelTypes` with your state, message bundle, interactions and extensions, and every scene's keys, message values, state paths and interaction frames are checked:

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

A novel holds functions, so it cannot travel from the server as props: render the player inside a client entry of your own that imports the novel. `NovelPlayer.Default` is the whole player in one component; it reads its translator from `IntlProvider` (or `setIntl()`) in `@sdxc/i18n/ui`, and fills its parent with a letterboxed 16:9 stage.

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
				<NovelPlayer.Default novel={novel} />
			</IntlProvider>
		</div>
	);
});
```

### Compose your own player

`NovelPlayer` is a provider: place the parts you want inside it, apply the input mixins you want to it, and listen to its events with `on()`. Leaving a part out removes it.

```tsx
import { keyboardControls, NovelPlayer, touchControls } from "@sdxc/novel/ui";
import { css, on } from "remix/component";

import { showCredits } from "./credits.js";
import { novel } from "./novel.js";

let player = (
	<NovelPlayer
		novel={novel}
		mix={[
			keyboardControls(),
			touchControls(),
			css({ "--novel-textbox-background": "rgb(0 0 0 / 0.8)" }),
			on("novel:ending", (event) => showCredits(event.ending.key)),
		]}
	>
		<NovelPlayer.Stage>
			<NovelPlayer.Textbox />
			<NovelPlayer.Choices />
			<NovelPlayer.QuickMenu />
		</NovelPlayer.Stage>
		<NovelPlayer.Backlog />
		<NovelPlayer.Saves slots={3} />
		<NovelPlayer.Settings />
		<NovelPlayer.Notifications />
	</NovelPlayer>
);
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

#### `chapter(options: { title?: LineKey; scenes: ChapterTree }): ChapterLeaf`

Groups scenes into a chapter, which chapter select lists by its title and the `chapter` event reports. The chapter's key is part of every scene name under it. A chapter holds scenes and groups of scenes; chapters are grouped by `arc()`.

#### `arc(options: { title?: LineKey; chapters: ArcChapters }): ArcLeaf`

Groups chapters into an arc ("First Year" holding chapters 1–12). The arc's key is part of every scene name under it, every chapter in it carries `arc` (the arc's `name` and `title`), and the library screens head each arc's chapters with its title.

```ts
let story = scenes({
	arc1: arc({
		title: "arcs.first",
		chapters: {
			ch1: chapter({ title: "chapters.one", scenes: { s1: scene(), s2: scene() } }),
		},
	}),
});

story.arc1.ch1.s1.name; // "arc1.ch1.s1"
story.arc1.ch1.s1.chapter; // { name: "arc1.ch1", title: "chapters.one", arc: { name: "arc1", title: "arcs.first" } }
```

#### `chapterOf(group: object): ChapterInfo | undefined`

The chapter a group of a scene map was declared as, with its `arc` when it has one, or `undefined` for a plain group.

#### `character(options: CharacterOptions & ({ sprites } | { layers } | {})): CharacterLeaf`

Declares a character by its name's message key and an optional `color`, with a flat set of `sprites` (one shows at a time), `layers` drawn bottom to top (one variant each), or no image for a voice that never stands on stage.

A character is unnamed until the story introduces them: the textbox and the backlog show the `unknownName` label (`"???"`) in place of their name until a scene runs `ctx.introduce(character)`. Persistent data keeps everyone introduced in any play, so a scene or chapter replay names them from its first line. `known: true` names a character from the first line, as the player, their family or anyone the reader already knows. `description` is a message key the characters screen shows beside their portrait. `bio` adds titled sections by id (`{ scar: { title, body, known? } }`) that the characters screen lists, numbered, below the description: each stays hidden until a scene runs `ctx.learn(character, "scar")`, unless it is `known`, so a character's page fills in as the story reveals them.

```typescript
character({ name: "cast.you", known: true });
character({
	name: "cast.ren",
	layers: { body: { school: "/ren/body.webp" }, face: { grin: "/ren/grin.webp" } },
});
```

#### `cast(tree: Record<string, CharacterLeaf>): CastMap`

Names every character by its key, which the stage and saves refer to it by.

#### `encyclopedia(tree: Record<string, TopicLeaf>): EncyclopediaMap`, `topic(options): TopicLeaf` and `entry(options: EntryOptions): EntryLeaf`

Declares the encyclopedia: topics such as places or magic, each with entries the reader learns as the story goes. An entry has a `title`, an optional `summary` line, an opening `body`, titled `sections`, an `image`, and `known: true` for common knowledge open from the first play. Every text is a message key, and a blank line in a message starts a new paragraph. An entry's id is `<topic>.<entry>`, and it stays hidden until a scene runs `ctx.learn(entry)`:

```ts
export const LORE = encyclopedia({
	places: topic({
		name: "lore.places",
		entries: { pier: entry({ title: "lore.pier.title", body: "lore.pier.body" }) },
	}),
});
```

#### `assets(tree: AssetTree): AssetMap`

Names every file by its group and key (`backgrounds.cafe`). Groups are `backgrounds`, `images` (full-screen CGs), `music`, `ambience` and `sounds`; a file is a URL, a `Blob`, or a map of locale to either, and a sound may be `{ src, caption }`. A string is loaded from its URL; a `Blob` is a file the page already holds, such as audio rendered in the browser, and plays or draws without a fetch. Saves keep the id, so a save loaded after a rebuild draws the file's current declaration.

```typescript
import { encodeWav, renderSong } from "@sdxc/synth";

let song = renderSong({ seed: 7, style: "lofi", key: "A2", mode: "dorian", duration: 60 });

let ASSETS = assets({
	backgrounds: { cafe: "/bg/cafe.webp" },
	music: { theme: new Blob([encodeWav(song)], { type: "audio/wav" }) },
});
```

#### `interaction(options: { input: StandardSchemaV1; output: StandardSchemaV1 }): InteractionLeaf`

Declares a screen the app renders itself, such as a minigame, by the schemas of what goes in and what comes back. The engine hands it the parsed input and validates its reply against the output schema; both schemas need a synchronous validator.

#### `interactions(tree: Record<string, InteractionLeaf>): InteractionMap`

Names every interaction by its key, which a custom frame carries as `frame.interaction`.

#### `extension(name: string, options: ExtensionOptions): Extension`

Declares a story extension: methods scenes call as `ctx.<name>.<method>(…)`, a per-play slice of state at `state.<name>`, and lasting data at `persistent.<name>` that outlives every playthrough. Pass it to `createNovel({ extensions })` and declare the list as `NovelTypes["extensions"]` to type all three. Each slice is optional, so an extension may keep lasting data only.

- `options.state`: The per-play slice's schema, which validates it whenever a play starts or loads
- `options.initial`: The slice of a new play, and of a save made before the extension existed
- `options.persistent`: `{ state, initial }` for the lasting slice, kept in the persistent record under the extension's name; a stored record without it, or one its schema refuses, reads as `initial`
- `options.directives`: `(ctx) => methods`; `ctx` holds every scene directive plus `update(value | (value, state, tools) => next)` for the per-play slice and `remember(value | (value) => next)` for the lasting one, and callbacks read the lasting data as `tools.persistent.<name>`
- `options.on`: Listeners for the novel's events, side effects only

```typescript
let achievements = extension("achievements", {
	persistent: { state: s.array(s.string()), initial: [] },
	directives: (ctx) => ({
		unlock: (id: string, key: LineKey) => [
			ctx.remember((all) => (all.includes(id) ? all : [...all, id])),
			ctx.notify(key),
		],
		ifUnlocked: (id: string, directives: Directive[]) =>
			ctx.when((_state, tools) => tools.persistent.achievements.includes(id), directives),
	}),
});
```

A scene records each call as data, and the novel replaces it with the method's directives when it loads the scene; a call to an extension the novel lacks fails with `load-failed`. `remember` validates the new value and reports one its schema refuses on `error` (`invalid-state`, with the extension's name as subject), keeping the slice as it was. Later directives of the same run read the new value, and the play emits `persist` at its next stop. A rollback keeps lasting data, so a `remember` passed again after one applies again: write updaters that give the same result when repeated. A replay never changes it. An extension that keeps lasting data cannot take the name of a persistent field (`seen`, `chosen`, `endings`, `chapters`, `unlocked`, `introduced`).

#### `createScene(declaration: SceneDeclaration, build: (ctx: SceneContext) => Directive[]): SceneModule`

Builds a scene's directives once, when its module loads. The scene is plain data: state is read only inside callbacks, which the engine calls at play time. The scene's file default-exports the result for `novel.map()`. The context's directives:

- `show(asset, { transition? })`: sets the background, or shows a full-screen image over it
- `hide(asset, { transition? })`: removes the full-screen image
- `enter(character, { at, expression? | layers, transition? })`: puts a character in a column, showing a named sprite (the first by default) or a variant for every layer
- `exit(character, { transition? })`: takes a character off stage
- `learn(entry)`: opens an encyclopedia entry in this play and every later one; the player announces the first time with a "New entry" toast
- `learn(character, section)`: opens a section of the character's `bio` the same way, recorded as `<character>:<section>` in `unlocked.bios`
- `introduce(character)`: names a character from the next line on; earlier lines showed the `unknownName` label. The play's state keeps the characters introduced, so saves, loads, rollbacks and the backlog show each line's speakers as they were
- `clear({ transition? })`: takes every character off stage at once, each leaving with the transition, so a chapter's last scene can hand the next one an empty stage
- `express(character, { expression | layers, transition? })`: changes the sprite, or any of the layers
- `move(character, { at, transition? })`: moves a character to another column
- `say(speaker | speakers[], key, values?)`: a line spoken by one or several characters; the play stops for the reader
- `narrate(key, values?)`: a line with no speaker; a stop
- `choose(options, { prompt?, repeat?, timeout?, default? }?)`: a menu, a stop. Each option, keyed by its label, is a list of directives or `{ when?, visibility?, reason?, once?, done?, do }`; `repeat` brings the menu back after a branch that stays in the scene, `done` ends that repeat, `once` removes an option after it is taken, and `timeout` milliseconds later the menu takes `default`
- `when(condition, directives, otherwise?)`: runs one list or the other by a condition read at play time
- `set(path, value | (value, state, tools) => next)`: changes state at a dotted path
- `goto(scene)`: continues in another scene
- `call(scene)` and `back()`: plays another scene and returns to the next directive; `back()` returns early
- `goto.oneOf(scenes, weight?)` and `call.oneOf(scenes, weight?)`: continue in, or play and return from, one scene drawn at play time. `weight(scene, state, tools)` answers a number or a boolean (`true` counts as 1; `false`, `0` and any number that is not positive and finite leave the scene out), and every candidate weighs 1 without it. The draw comes from the play's seeded stream, so a save, a reload or a rollback picks the same scene. When no candidate qualifies the play runs the next directive, so a scene falls through to a default
- `notify(key, values?)`: emits `notify` with the message and its values as the play passes it, without a stop and leaving the state as it was; a rollback or a load that lands past it does not emit it again, and a replay never emits it
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
- `options.encyclopedia`: The `encyclopedia()` map, whose entries scenes `learn`
- `options.state`: The state schema; it gives a new play its defaults and validates every loaded save
- `options.extensions`: Story extensions, each with a unique name that holds no dot and matches no built-in directive, `notify` included (`createNovel` throws otherwise)
- `options.initial`: The scene a new play starts in
- `options.rollback`: How many earlier stops `rollback()` can return to, `0` to turn it off (default `100`)
- `options.positions`: Redefines the columns `left`, `center` and `right` stand in (default `1/3`, `2/3`, `3/3`)
- `options.voice`: Finds a spoken line's voice file from `{ speaker, key, locale? }`, or answers `undefined`
- `options.migrate`: Upgrade steps run in order, each `(save) => Result<save, Error>`; the step at index `n` upgrades a version `n + 1` save, and saves are stamped `migrate.length + 1`
- `options.messages`: Catalogs by locale; a shown key a catalog lacks is reported on `error` and the frame still carries the key
- `options.locales`: The locales `voice` is asked for, one call each (default the locales of `messages`)

#### `Novel`

One novel serves every play: it holds the declarations, the module mapped onto each scene and the listeners, and no player state. `new Novel(options)` is what `createNovel` calls.

- `novel.map(scene, module | lazy(…))`: maps a scene onto its module; mapping one twice throws
- `novel.mapped`: every mapped scene, in mapping order
- `novel.start(options?: StartOptions): Result<Play, NovelError>`: starts a play, or fails with `invalid-state` for a save or state the schemas refuse, `migration-failed` for a save a step fails on or one newer than the novel, and `unmapped-scene` for a scene with no module
- `novel.links(scene, { depth?, locale? }): Promise<NovelLink[]>`: the `<link>` descriptors for a page starting at `scene`; `preload` for the images and sounds it shows, `prefetch` for its music and voices and every file of the scenes within `depth` jumps (default `1`), every candidate of a `oneOf` included. It imports lazy modules on the way and lists URLs only, leaving out `data:` URLs and Blobs
- `novel.reachable(scene, { depth?, locale? }): Promise<ReachedScene[]>`: the same scenes, nearest first, each with its files, for a player to prefetch while the reader is in `scene`
- `novel.on(name, listener): () => void` and `novel.off(name, listener)`: listen to an event of every play; a listener receives the payload and the play, and one that throws or rejects is reported on `error`
- `novel.use(plugin): Novel`: installs a function that registers listeners, so plugins chain

`StartOptions` takes `from` (a stored `GameState`, migrated and validated before the play resumes), `scene` and `state` for a new play (missing fields take their schema defaults), `seed` for the random stream, `persistent` (stored `Persistent` data; anything the schema refuses starts empty), and `replay: "scene" | "chapter"`, which finishes the play when it leaves that scene or chapter, saves nothing, names every character in the persistent `introduced` list, and records only the lines it shows.

A `Play` is the generator itself, with `play.state` (the play as JSON at the current stop), `play.stage` (the current stop's stage, or after the end the stage the story finished on, with anyone who left after the last stop in `exits`), `play.persistent`, `play.save(slot)` (emits `save` and answers the state) and `play.rollback()` (returns to the previous stop, restoring its state, stage and random draws, or answers `null`).

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
| `notify`  | `{ scene, key, values }`           | The play passes a `notify`, outside replays                                                     |
| `persist` | `NovelPersistent`                  | Persistent data changes; the payload is the whole record, lasting extension data included       |
| `error`   | `NovelError`                       | A story problem the play continued past, or a failed listener                                   |

#### Types from `@sdxc/novel`

- `NovelTypes`: The interface an app augments with `state`, `messages`, `interactions` and `extensions`; without it state is any record and any key reads as a line.
- `DeclaredState`, `NovelState`, `NovelMessages`, `LineKey`, `LineValues<Key>`, `SchemaInput<Schema>`: The declared state, that state with every extension's slice, the bundle read back from `NovelTypes`, every message key, the values argument a key requires, and what a schema accepts.
- `Extension`, `AnyExtension`, `ExtensionOptions`, `ExtensionBaseOptions`, `StatelessExtensionOptions`, `LastingOptions`, `ExtensionContext`, `ExtensionScope`, `ExtensionMethods`, `ExtensionListeners`, `ExtensionState`, `ExtensionLasting`, `ExtensionPersistent`, `ExtensionCalls`: An extension and what `extension()` takes (with or without a per-play slice, and its lasting slice), the context and state its directives are written with, and the slices and calls every declared extension adds.
- `StateRecord`, `StatePath<State>`, `PathValue<State, Path>`, `PathAccepting<State, Value>`, `DeepPartial<Value>`: State as any record, the dotted paths `set` takes, the value at a path, the paths whose value accepts an interaction's output, and the partial state a play or test starts from.
- `PlayTools`, `StateCallback<Value>`, `ValuesInput<Values>`, `StoredCallback<Value>`, `PickWeight<Scene>`, `StoredWeight`: What callbacks receive beside the state (`random`, and `persistent` with every lasting slice), a read-only callback of the state, message values inline or computed, a callback as a directive stores it, and a `oneOf` weight as written and as stored.
- `SceneTree`, `SceneLeaf`, `ChapterLeaf`, `ChapterTree`, `ArcLeaf`, `ArcChapters`, `SceneMap`, `SceneDeclaration<Name>`, `ChapterInfo`, `ArcInfo`, `ChapterMarker`: The scene tree before and after `scenes()` names it, a chapter's scenes and an arc's chapters, a named scene with its optional title and chapter, the arc a chapter in an arc carries, and the chapter a group is branded with.
- `CharacterOptions`, `CharacterLeaf`, `CharacterDeclaration`, `CastMap`, `CharacterImage`, `SpriteImage`, `LayerImage`, `NoImage`, `StagedCharacter`: A character before and after `cast()` names it, the three shapes its images take, and a character that can stand on stage.
- `AssetSource`, `AssetKind`, `AssetTree`, `AssetMap`, `AssetDeclaration<Kind>`, `CaptionedSound`: A file's URL, Blob or locale map, the five kinds of media, and an asset before and after `assets()` names it.
- `InteractionLeaf`, `InteractionDeclaration`, `InteractionMap`: An interaction before and after `interactions()` names it.
- `SceneContext`, `SceneDirectives`, `SceneModule`, `GotoBuilder`, `CallBuilder`, `Directive`, and each directive (`ExtensionDirective`, `ShowDirective`, `HideDirective`, `EnterDirective`, `ExitDirective`, `ClearDirective`, `IntroduceDirective`, `ExpressDirective`, `MoveDirective`, `SayDirective`, `NarrateDirective`, `ChooseDirective`, `WhenDirective`, `SetDirective`, `GotoDirective`, `CallDirective`, `PickDirective`, `BackDirective`, `WaitDirective`, `PlayDirective`, `StopDirective`, `CustomDirective`, `EndingDirective`, `NotifyDirective`, `RememberDirective`): The builder a scene receives, its callable `goto` and `call` with their `oneOf`, the module it returns, and the plain data each directive is.
- `EnterOptions<Character>`, `ExpressOptions<Character>`, `ChoiceOptions`, `ChoiceOption`, `ChoiceOptionDirective`, `MenuOptions<Options>`: The options `enter`, `express` and `choose` take, typed from the character's images and the menu's keys, and an option as the directive stores it.
- `Frame`, `StopFrame`, `FrameBase`, `LineFrame`, `ChoiceFrame`, `FrameOption`, `PauseFrame`, `CustomFrame`, `InteractionFrame`, `ErrorFrame`, `Speaker`, `Reply`: What a play yields. Every stop carries its complete stage and audio; a line knows its speakers (each with whether it was `introduced`), voice and whether the reader has `seen` it; a reply comes only from the frame's `advance()`, `choose()` or `complete()`, and one from any other frame is refused. An error frame carries the stop to answer, or `null` when `next()` retries.
- `Ending`, `ReplayScope`, `StoryPosition`, `GameState`: How a play finished, how far a replay plays, a position anchored on a message key, and the play as JSON with its version, stack, stage, audio, state, random stream, the characters introduced (`introduced`) and play time.
- `Stage`, `StageScenery`, `StageCharacter`, `FrameStage`, `FrameCharacter`, `Position`, `Fraction`, `PositionAlias`, `SceneryTransition`, `CharacterTransition`: The stage as saved and as a frame shows it (with `speaking` focus and the characters that just left), columns as `n/d` or an alias, and the transition names; any name beyond the built-in ones is a CSS class the app styles.
- `Audio`, `AudioTrack`, `AudioSound`: What each channel plays at a stop: one music loop, layered ambience, the one-shots since the previous stop, and the line's voice.
- `Persistent`, `NovelPersistent`: What outlives a playthrough: lines read (with their values), options taken, endings, chapters, unlocked images, music and character looks (`unlocked.sprites`, keyed `<character>:<sprite>` or `<character>:<layer>=<variant>,…`), and the characters introduced (`introduced`), and that record with every extension's lasting slice.
- `Play`, `StartOptions`, `NovelOptions`, `VoiceLine`, `Migration`, `SavedObject`, `MessageCatalog`, `Lazy`: The play and the options above, and the shapes their callbacks and catalogs take.
- `NovelLink`, `ReachOptions`, `ReachedScene`, `SceneAsset`: What `links()` and `reachable()` take and answer.
- `NovelEvents`, `NovelEventName`, `NovelListener<Name>`, `NovelPlugin`, `SceneEvent`, `LineEvent`, `ChoiceEvent`, `UnlockEvent`, `ChapterEvent`, `SaveEvent`, `NotifyEvent`: The events above and their listeners.
- `NovelErrorCode`, `NovelErrorOptions`: What went wrong (`stale-reply`, `invalid-reply`, `unavailable-option`, `invalid-output`, `invalid-state`, `migration-failed`, `unmapped-scene`, `load-failed`, `endless-loop`, `dead-end-menu`, `missing-asset`, `missing-message`, `listener-failed`) and what an error is about.

### `@sdxc/novel/ui`

The player as `remix/component` components: `NovelPlayer` is a provider that owns a play, the parts placed inside it draw that play, mixins add input, and headless behavior classes hold the logic the parts are built on. A part of your own reads the same context the built-in parts read, so any of them can be replaced. Every component reads its translator through `intl(handle)` from `@sdxc/i18n/ui`.

#### `NovelPlayer`

Owns a play and publishes it to the parts inside it; it draws nothing but its children. Render it inside your own client entry, since the novel it takes holds functions. It accepts the attributes of a `div`, `mix` included, beside its own props:

- `novel`: The novel, with its scenes mapped
- `start`: The `StartOptions` the play starts from: a `scene`, `state`, `seed`, a save through `from`, and `persistent` data. The player reads it once, so mount a new player (change its `key`) to start another play
- `settings`: The `StoredSettings` the app kept; missing fields take `DEFAULT_SETTINGS`
- `saves`: The stored saves by slot name, which the save and load screens show; slots are `"auto"` (load-only), `"quick"` and `"1"` upward
- `labels`: Replaces any of the interface's English words (`NovelLabels`)
- `markup`: Line markup elements or `Trans.MarkupComponent`s beside `b`, `i`, `shake`, `speed` and `pause`
- `behaviors`: Replaces any of the reader's behaviors (`reveal`, `auto`, `skip`, `backlog`, `saves`, `settings`, `countdown`, `autosave`, `notifications`, `read`) with your own implementation of its interface; read once, at mount
- `prefetch`: How many jumps ahead to prefetch modules, images, sounds, voices and music as the play enters a scene, or `false` (default `1`)
- `returnsToTitle`: Hands the reader back to a title screen: the ending's button reads **Back to title** in place of Play again, and it, or a replay with no play to resume ending, dispatches `novel:title`
- `sounds`: `InterfaceSounds`, a `hover` sound played as the pointer enters an option or keyboard and gamepad focus moves to one, and a `select` sound played as the reader picks one, each a declared sound asset on the mixer's `interface` channel. Advancing a line stays silent, and so does the interface for a moment after a pick, so opening a dialog sounds once. `NovelPlayer.Default` passes it to its title screen, and `NovelPlayer.Title` takes it too
- `children`: The parts

```tsx
<NovelPlayer novel={novel} mix={[keyboardControls(), touchControls(), gamepadControls()]}>
	<NovelPlayer.Stage>
		<NovelPlayer.Textbox />
		<NovelPlayer.Choices />
		<NovelPlayer.Interaction interactions={INTERACTIONS}>
			{(frame) => <Fishing input={frame.input} />}
		</NovelPlayer.Interaction>
		<NovelPlayer.QuickMenu>
			<NovelPlayer.Extras>
				<Memories />
				<Gallery />
				<EndingsList />
			</NovelPlayer.Extras>
		</NovelPlayer.QuickMenu>
	</NovelPlayer.Stage>
	<NovelPlayer.Backlog />
	<NovelPlayer.Saves slots={6} />
	<NovelPlayer.Settings />
</NovelPlayer>
```

The root carries `data-novel-player` with `data-phase`, `data-auto`, `data-skip`, `data-hidden`, `data-replay` and `data-dyslexia` for styling.

#### `NovelPlayer.Default`

The whole player in one component: every part below, notifications included, the seven library screens under an Extras menu, and the three input mixins. It takes the provider's props, and its children (such as `NovelPlayer.Interaction`) are drawn on the stage. A game that needs a different slot count, no speaker focus or music titles composes its own player instead.

```tsx
<NovelPlayer.Default novel={novel} settings={stored} saves={saves}>
	<NovelPlayer.Interaction interactions={INTERACTIONS}>
		{(frame) => <Fishing input={frame.input} />}
	</NovelPlayer.Interaction>
</NovelPlayer.Default>
```

Given `titleScreen={{ heading, background?, art?, footer?, screens? }}` it opens on `NovelPlayer.Title` and plays what the reader starts there, with the settings changed on the title; `start` is what every such play extends, and `mix` applies to the title while it shows. When a play ends, the ending screen's button returns to the title, as does a replay begun there when it ends; the title then offers the saves and persistent data the play left, so Continue resumes the newest save and the library shows what was unlocked.

```tsx
<NovelPlayer.Default
	novel={novel}
	saves={saves}
	titleScreen={{ heading: "The Café", art: <img src={keyArt} alt="" /> }}
/>
```

#### `NovelPlayer.Title`

The title screen, filling its box: `heading` (text, or a logo `<img>`/`<svg>` scaled to `--novel-title-logo-*`), a full-bleed `background` (or the `--novel-title-background` variable), a foreground `art` anchored at `--novel-title-art-inset`, New game, Continue from the newest of `saves` with that save's scene and date (shown only when one exists), the library screens given as children (default `ChapterSelect`, `Encyclopedia`, `Memories`), the settings screen, and a `footer` under the menu. It starts nothing: New game, Continue and a chapter or scene pick dispatch `novel:start` with the `StartOptions` to mount a player with, built on its `start` prop, and a setting changed here dispatches `novel:settings`. Every style is a `--novel-title-*` variable, and every part carries a `data-novel-title-*` attribute (`heading`, `menu`, `button` with `data-action`, `label`, `detail`, `footer`, `background`, `art`) that the title's own `mix` can decorate:

```tsx
<NovelPlayer.Title
	novel={novel}
	heading={<img src={logo} alt="The Café" />}
	mix={css({
		"& [data-novel-title-button]::before": {
			content: '"◆"',
			position: "absolute",
			insetInlineStart: "-0.5em",
		},
	})}
/>
```

#### `SaveSummary`

A save's scene title and the date it was saved in the reader's locale, as the save slots and Continue show it: `<SaveSummary state={save} locale={locale} />`.

#### `NovelPlayer.Context`

What `handle.context.get(NovelPlayer)` answers inside a player: one stable object whose getters always read the current play, so a part or mixin can keep it from setup. It is a `TypedEventTarget` that dispatches `frame`, `phase` and `ending` as soon as each changes; the events carry no data, so a listener reads the getters.

- State: `novel`, `element` (the root), `dialog` (the open dialog, or `null`), `frame`, `phase`, `ending`, `stage` (what the stage draws: the frame's, then the stage the story finished on), `state` (the story state at the current stop, extension slices included, one value per stop), `error`, `stalled`, `instant` (true while skipping or under reduced motion), `hidden`, `replaying`, `returnsToTitle`, `persistent`, `labels`, `locale`, `markup`, `ids` (each screen's dialog id) and `anchor` (the CSS anchor name on the root)
- Behaviors, typed by their interfaces: `reveal`, `auto`, `skip`, `backlog`, `saves`, `settings`, `countdown`, `autosave`, `notifications`, `read`, plus `mixer` (`AudioMixer`) and `prefetcher` (`Prefetcher`)
- Actions: `answer(reply)`, `advance()`, `rollback()`, `save(slot)`, `load(slot)`, `setSettings(next)`, `toggleAuto()`, `toggleSkip()`, `holdSkip(held)`, `hide(hidden?)` (toggles without an argument), `toggleFullscreen()`, `replay(scene, scope)`, `endReplay()`, `toTitle()` (dispatches `novel:title` with the play's persistent data), `open(screen)`, `retry()` and `restart()` (a new play from the first scene, keeping persistent data)

```tsx
import type { Handle } from "remix/component";

import { Message, NovelPlayer } from "@sdxc/novel/ui";
import { on } from "remix/component";

function PhoneChoices(handle: Handle) {
	let player = handle.context.get(NovelPlayer);
	return () => {
		let frame = player.frame;
		if (frame?.type !== "choice") return null;
		return (
			<ul>
				{frame.options.map((option) => (
					<li key={option.id}>
						<button
							type="button"
							disabled={option.disabled}
							mix={on("click", () => player.answer(frame.choose(option.id)))}
						>
							<Message i18nKey={option.label} />
						</button>
					</li>
				))}
			</ul>
		);
	};
}
```

#### Events: `NovelSaveEvent`, `NovelSettingsEvent`, `NovelEndingEvent`, `InteractionCompleteEvent`, `NovelReplayEvent`, `NovelReplayVoiceEvent`, `NovelStartEvent` and `NovelTitleEvent`

The player dispatches the first three from its root, an interaction's component dispatches `novel:interaction:complete`, and the library screens dispatch the last two; they all bubble, so `on()` on the component or any ancestor hears them with typed fields. No component takes a callback prop:

- `novel:save` (`slot`, `state`): The reader saved, or the play autosaved into `"auto"`; the save also reaches the novel's `save` event
- `novel:settings` (`settings`): The reader changed a setting; the event carries the whole `NovelSettings`
- `novel:ending` (`ending`): The play reached an ending or ran out of story
- `novel:interaction:complete` (`interaction`, `output`): `new InteractionCompleteEvent(declaration, output)` finishes an interaction, with `output` typed by its schema; `NovelPlayer.Interaction` answers the frame with it once
- `novel:replay` (`scene`, `scope`): The reader picked a chapter or scene in `ChapterSelect` or `SceneReplay`; inside a player the replay starts unless a listener calls `preventDefault()`
- `novel:start` (`start`): The reader began a play on `NovelPlayer.Title`; `start` is the `StartOptions` to mount a player with
- `novel:title` (`persistent`): A player given `returnsToTitle` hands the reader back to the title, with persistent data as the play left it
- `novel:replay-voice` (`line`): The reader replayed a line's voice in `Memories`; it plays through the player's mixer, or outside one through the screen's own, unless a listener calls `preventDefault()`

```tsx
<NovelPlayer.Default
	novel={novel}
	mix={[
		on("novel:settings", (event) =>
			localStorage.setItem("settings", JSON.stringify(event.settings)),
		),
		on("novel:ending", (event) => showCredits(event.ending.key)),
	]}
/>
```

#### `keyboardControls(options?)`, `touchControls()` and `gamepadControls()`

Input as mixins on the player, so a game applies only the controls it wants. Each one stands down while a dialog or a field has focus, and a click or tap on the stage advances without any of them.

`keyboardControls({ keymap? })` follows `KEYMAP` unless given a map of `KeyboardEvent.key` to `PlayerAction`, and holding Control skips:

| Key          | Action           | Key    | Action      |
| ------------ | ---------------- | ------ | ----------- |
| Space, Enter | Advance          | `a`    | Auto        |
| ↑, Page Up   | Roll back        | `k`    | Skip        |
| ←, `l`       | Backlog          | `h`    | Hide UI     |
| `s`, `o`     | Save, load       | `f`    | Full screen |
| `q`, `w`     | Quick save, load | Escape | Settings    |

`touchControls()` adds swipes (up rolls back, down opens the backlog) and the wheel (up rolls back, down advances). `gamepadControls()` reads a standard-mapping gamepad: A presses the focused control or advances, B closes the open screen or hides the interface, the shoulder buttons roll back (left) and skip (right), Start opens the settings, and the D-pad moves focus.

#### Parts

Each part is a member of `NovelPlayer` and is also exported under its own name. Every one renders a real element that takes `mix`, and renders nothing while it has nothing to show.

- `NovelPlayer.Stage` (`Stage`): The 16:9 stage, letterboxed inside any box, with its children above the characters; a click finishes a transition, then the line being typed, then advances. `focus` (default `true`) enlarges and raises the speaker and dims everyone else. Given a `stage` prop it draws that still stage instead of the play, which is how `SlotThumbnail` works. Once the play finishes it shows the ending's name over the dimmed stage with a **Play again** button (`labels.playAgain`, `--novel-ending-button-*`, `data-novel-play-again`) that calls `restart()`, or under `returnsToTitle` a **Back to title** one (`labels.backToTitle`, `data-novel-back-to-title`) that calls `toTitle()`
- `NovelPlayer.Textbox` (`Textbox`): The line's box, a live region holding the whole line from the start; without children it draws `NamePlate`, `Line` and `NextIndicator`, and with children it draws those. The box and its line carry `data-novel-read` on a line read in an earlier playthrough
- `NovelPlayer.NamePlate` (`NamePlate`), `NovelPlayer.Line` (`Line`) and `NovelPlayer.NextIndicator` (`NextIndicator`): The speaker's name in their color, the typed line with its markup, and the sign that the line is complete. When the player offers the characters screen, a named speaker's name is a button that opens it on them through `showCharacter(id)`
- `NovelPlayer.Captions` (`Captions`): The captions of the frame's sounds
- `NovelPlayer.Choices` (`ChoiceMenu`): A menu, with a locked option disabled with its reason, a taken one marked `data-chosen`, and a timed menu counting down
- `NovelPlayer.Interaction` (`Interaction`): `interactions` (your `interactions()` map) and a children function of the custom frame, narrowed by `frame.interaction`, drawn over the stage while the play stops at one of those interactions; it answers the frame when `novel:interaction:complete` reaches it
- `NovelPlayer.QuickMenu` (`QuickMenu`): The buttons over the stage (auto, skip, backlog, save, load, quick save and load, settings, hide, full screen, End replay during a replay, and Title when the player has a title screen), then its children
- `NovelPlayer.Backlog` (`Backlog`): A modal dialog of the lines read, oldest first, each with a button that replays its voice; an entry read before it showed carries `data-novel-read`
- `NovelPlayer.Saves` (`SaveScreen`): The save and load dialogs, with the autosave slot first (load-only), then the quick one and `slots` numbered slots (default `6`); a replay offers no saving
- `NovelPlayer.Settings` (`SettingsScreen`): A modal dialog for every presentation setting, in Text, Sound and Accessibility tabs (`data-novel-settings-tab`), each row showing the setting's current value beside its control, with a line typed at the chosen text speed, Reset settings and Back; its sliders draw their rail in `--novel-settings-slider-track` and the filled part in `--novel-settings-slider-fill`
- `NovelPlayer.Extras` (`Extras`): An Extras menu offering the library screens given as its children, each in its own modal dialog
- `NovelPlayer.Notifications` (`Notifications`): The `notifications` queue as toasts in a `popover="manual"` element, so they sit in the top layer over dialogs and full screen, anchored to the player so `--novel-notification-inset` measures from its edges; a polite live region whose toasts each leave after `duration` milliseconds (default `4000`) and carry `data-kind`. Reduced motion drops their entrance

#### Theme: `NOVEL_THEME_VARIABLES`

Every color, image, size and timing the parts draw is a `--novel-*` custom property, and `NOVEL_THEME_VARIABLES` maps each name to its default. Set them with `css()` on the player or any ancestor; image frames work through the `border-image` variables:

```tsx
<NovelPlayer.Default
	novel={novel}
	mix={css({
		"--novel-textbox-background": "rgb(30 20 10 / 0.85)",
		"--novel-textbox-border-image-source": "url(/ui/frame.png)",
		"--novel-textbox-border-image-slice": "24",
		"--novel-textbox-border-image-width": "24px",
		"--novel-nameplate-font-family": "Caveat, cursive",
		"--novel-next-content": '"❤"',
		"--novel-accent": "#e8a55c",
	})}
/>
```

The variables cover the player and stage (`letterbox`, `color`, `accent`, `stage-background`, transitions, character height), speaker focus (`focus-scale`, `focus-lift`, `focus-filter`, `dim-brightness`, `dim-filter`), the text (font, size, leading, tracking, color, shadow), the textbox (background, border, `border-image-*`, padding, radius, shadow, backdrop filter, position, inset, sizes), the name plate (background, `border-image-*`, font, color, offset), the next-line indicator (`next-content`, `next-image`, size, `next-inset`, color, animation), the choices (gap, prompt, option background, border, `border-image-*`, hover, focus and disabled states, the countdown bar), the quick menu, the dialogs (background, color, `border-image-*`), the settings screen (`settings-panel-*`, `-divider`, `-readout-color`, `-tab-*` for its tabs and buttons, `-preview-*`), captions, the ending overlay, errors, read lines (`read-color`, `inherit` by default) and the notifications (`notification-inset`, `-gap`, `-background`, `-color`, `-border`, `-radius`, `-padding`, `-font`, `-font-size`, `-shadow`, `-animation`).

#### Behaviors

How the reader experiences the play, kept in the browser and never in the game state. Each slot is an interface the player relies on (`RevealBehavior`, `AutoBehavior`, `SkipBehavior`, `BacklogBehavior`, `SavesBehavior`, `SettingsBehavior`, `CountdownBehavior`, `AutosaveBehavior`, `NotificationsBehavior`, `ReadBehavior`), extending `TypedEventTarget` and dispatching `change` when its state moves. The headless classes below implement them and are the defaults; a custom part subscribes to the player's instance (`player.reveal`, `player.auto`…), and `behaviors` replaces any of them.

- `RevealModel`: A line's reveal: `begin(line, complete?)`, `start()`, `finish()` (the typing ended), `reveal()` (show it whole), `clear()`, with `status` (`idle`, `waiting`, `typing`, `revealed`), `complete` and `speed` in characters per second
- `AutoModel`: Auto mode: `set(enabled)`, `toggle()`, `wait(line, advance)` (advances after the line's voice and `delay(line)`, which a subclass overrides), `cancel()`; `AUTO_PER_CHARACTER_MS` is the time added per character of an unvoiced line
- `SkipModel`: Skip, toggled or held: `toggle()`, `hold(held)`, `stop()`, `active`, and `passes(frame, mode)`, whether skipping goes past a frame; `SKIP_STEP_MS` is the pace between skipped stops
- `BacklogModel`: The lines read, `record(frame, locale)` and `leave(frame)` on rollback, kept to a fixed size, as `entries`
- `SaveSlots`: The saves by slot: `get(slot)`, `put(slot, state)`, `replace(stored)` and `all`; `QUICK_SLOT` (`"quick"`) is the slot quick save writes
- `SettingsModel`: The reader's settings: `value`, `set(next)`, `update(patch)`, `setVolume(channel, value)`, completed with `DEFAULT_SETTINGS`
- `CountdownModel`: A timed menu's clock: `start(frame)`, `cancel()`, `endsAt`, and an `expire` event (`CountdownExpireEvent`) with the option `timeoutOption(frame)` picks, its `default` or else its first available option
- `AutosaveModel`: Asks the player to save, through a `save` event, when a chapter starts (a new play's first one included) and every `every` lines (default `20`), and when the reader leaves the tab with lines shown since the last save, into `slot` (default `AUTO_SLOT`, `"auto"`); the player saves through its own save path, so the save reaches `novel:save` and the save screens, and never during a replay
- `NotificationsModel`: The toasts queue: `push({ text } | { key, values? })` with an optional `kind` (default `"custom"`), `dismiss(id)` and `entries`, holding at most `limit` toasts (default `5`). The player pushes `image` and `music` unlocks, an `ending` with how many of all endings are reached, and each `notify` outside replays
- `ReadModel`: Whether the current line (`current`) and each backlog entry (`isRead(id)`) had been read before it showed, from the line frame's `seen`, which skip's read-only mode follows too
- `Prefetcher`: Warms the files of the scenes ahead as the play enters a scene, four at a time

#### `Message` and `lineMarkup(): Record<string, RemixElement | Trans.MarkupComponent>`

`<Message i18nKey values? markup?>` renders a message with the built-in line effects plus any `markup` adds or replaces. `lineMarkup()` answers a fresh map of those built-in effects for `Trans`.

#### `SlotThumbnail`, `SettingRow` and `RangeSetting`

`<SlotThumbnail state locale>` draws a saved stage as a miniature, `<SettingRow label readout>` one settings row around a control, and `<RangeSetting label name value min max step readout>` a row with a slider whose `<input>` fires a native `input` event as the reader drags, heard with `on("input", …)` in its `mix`.

#### `Memories`, `Gallery`, `MusicRoom` and `EndingsList`

The library screens. Inside a player they read `novel` and the persistent data from its context; on a title screen, pass `novel` and the stored `persistent` value (keep one value while the screen shows), with optional `labels`. `Memories` lists the lines read, scene by scene, opening its scrolling box at the newest one, and replays a voiced line's voice through the player's mixer, or outside one a mixer it makes for itself (a `novel:replay-voice` listener may prevent that and play it another way); `Gallery` lists the CGs, opening an unlocked one full size; `MusicRoom` plays unlocked tracks through an optional `mixer`, with `titles` as message keys by asset id; `EndingsList` counts the endings reached. Lazily mapped scenes load as a screen opens. When the story has arcs, `Memories` heads each arc's chapters with its title in a `section` carrying `data-arc`.

#### `Encyclopedia`

One book for everything the reader has learned. Pages down its edge open every learned entry (with its topic beside it), the cast as `Characters` shows it, each topic, the CGs and the music; `pages` picks and orders them (`all`, `characters`, a topic id, `topics` for the remaining topics, `gallery`, `music`), and a novel without topics has no `all` page, and `titles` names the music room's tracks. A topic lists its learned entries with a search field beside the open article: its topic, title, summary, a Contents disclosure of its sections, the text, then each numbered section. It is the default library screen of `NovelPlayer.Default` and the title screen, opens on the character `showCharacter()` asked for, and a speaker's name in the textbox opens it. Its parts carry `data-novel-encyclopedia`, `-page`, `-content`, `-search`, `-article`, `-topic`, `-summary` and `-contents`, and it reads the settings screen's tab and panel variables plus `--novel-encyclopedia-page-padding` and `-current-background`/`-current-color` for the open entry.

#### `Characters`

The cast in declaration order, as a scrolling list beside the chosen character's portrait, name, `description` and looks. A character shows as the `unknownName` label, and cannot be picked, until they are `known` or a play introduces them; a sprite stays a locked placeholder until the stage draws the character in it once, and a layered character lists each combination of variants the stage drew. Inside a player it opens on the character `showCharacter()` asked for, and its dialog is wider than the other screens'. It takes the same `novel`, `persistent` and `labels` props as the screens above; `characterLooks` names the strip of looks.

#### `ChapterSelect` and `SceneReplay`

`ChapterSelect` lists the titled chapters and `SceneReplay` the titled scenes under their chapters. When the story has arcs, both head each arc's chapters with its title in a `section` carrying `data-arc` and `data-reached`; an arc with no reached chapter shows the locked label, as a locked chapter does. Picking one dispatches `novel:replay` with the `scene` to start from and its `scope`, `"chapter"` or `"scene"`. Inside a player the replay starts unless a listener prevents it; outside one, start it with `replay: event.scope`.

#### `AudioMixer`

Mixes the music, ambience, sound, voice and interface channels through one `AudioContext`, created on first use. `new AudioMixer(volume)`; `resume()` from a user interaction, since browsers keep the context suspended until one; `reconcile(audio, locale, silent?)` brings it in line with a frame (crossfading music, layering ambience, playing each sound once); `playVoice(source)` lowers the music while a voice speaks; `playInterface(source)` plays an interface sound once the context runs, and only decodes it before then; `preload(source)` (each takes a URL or a Blob, which decodes from its bytes), `stopVoice()`, `setVolume(volume)`, `snapshot` and `dispose()`.

#### `readLibrary(novel: Novel, persistent: unknown, locale: string): Promise<NovelLibrary>`

Everything the library screens show, read from the declarations and stored `Persistent` data. Every mapped scene loads, and one that fails is listed with `loaded: false` rather than failing the library. `chapters` groups the scenes by chapter, and `arcs` groups those chapters by arc, a story without arcs having one group whose `arc` is `null`.

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

`NovelLabels` covers the quick menu (`menu`, `auto`, `skip`, `backlog`, `save`, `load`, `quickSave`, `quickLoad`, `settings`, `hide`, `fullscreen`, `close`, `endReplay`), the slots (`slot`, `emptySlot`), the settings (`textSpeed`, `autoDelay`, `skipMode`, `skipRead`, `skipAll`, `volumeMaster`, `volumeMusic`, `volumeAmbience`, `volumeSound`, `volumeVoice`, `volumeInterface`, `fontSize`, `dyslexiaFont`, `selfVoicing`), the extras (`extras`, `memories`, `gallery`, `musicRoom`, `endings`, `chapterSelect`, `sceneReplay`, `unknownEnding`, `noMemories`, `play`, `stop`, `locked`, `loading`) the notifications (`notifications`, `imageUnlocked`, `musicUnlocked`, `endingReached`), the title screen (`newGame`, `continue`, `titleMenu`, `backToTitle`) and the rest (`autosave`, `replayVoice`, `retry`, `timeLeft`, `unknownName`).

#### `KEYMAP` and `gamepadActions(previous: readonly boolean[], current: readonly boolean[]): GamepadAction[]`

The default keyboard map `keyboardControls()` follows, by `KeyboardEvent.key`, and the actions of the gamepad buttons pressed since the previous poll, in button order, for a game that reads gamepads itself.

#### `resolveSource(source: AssetSource, locale: string): string`

The URL to load for a file in a locale: the exact locale's, its language's (`es` for `es-MX`), or the first the map lists. A Blob answers one object URL, made on first use and kept for the life of the page, so every replay reuses it. A server render of the stage draws a Blob image without `src`, and hydration sets it.

#### `columnOf(at: Fraction): Column` and `stillStage(stage: Stage): FrameStage`

Where a column sits on the stage as CSS percentages (a malformed one centers on the whole stage), and a saved stage as a frame would show it, with nobody speaking and no transition.

#### `BUILT_IN_TRANSITIONS` and `prefersReducedMotion(): boolean`

The scenery transitions the player draws itself as View Transitions (any other name is a class the app styles), and whether the reader asked for reduced motion, which finishes every transition at once.

#### Types from `@sdxc/novel/ui`

- `NovelPlayer.Props`, `NovelPlayer.DefaultProps`, `NovelPlayer.Context`, `NovelPlayer.Screen`, `NovelPlayer.Markup`: The provider's props, `Default`'s, the context its parts read, the screens `open()` takes and the markup map.
- `NovelPlayer.Behaviors`, `NovelPlayer.EventMap`: The `behaviors` prop and the context's events.
- `RevealBehavior`, `AutoBehavior`, `SkipBehavior`, `BacklogBehavior`, `SavesBehavior`, `SettingsBehavior`, `CountdownBehavior`, `AutosaveBehavior`, `NotificationsBehavior`, `ReadBehavior`: What the player relies on from each behavior.
- `NotificationInput`, `NotificationText`, `NotificationMessage`, `NovelNotification`: A toast as `push()` takes it, as plain text or a message to translate, and as the queue holds it.
- `Interaction.Props<Map>`, `Interaction.Map`, `Interaction.Frame<Map>`, `Interaction.Rendered`: An interaction part's props, the map it takes, the custom frame of each interaction in it, and what the children function returns.
- `Stage.Props`, `Stage.SceneryProps`, `Stage.CharacterProps`, `Textbox.Props`, `Textbox.PartProps`, `Textbox.CaptionsProps`, `Message.Props`, `ChoiceMenu.Props`, `Backlog.Props`, `SaveScreen.Props`, `SaveScreen.ThumbnailProps`, `SettingsScreen.Props`, `SettingsScreen.RangeProps`, `SettingsScreen.RowProps`, `SettingsScreen.Tab`, `QuickMenu.Props`, `Extras.Props`, `Title.Props`, `Title.Options`, `SaveScreen.SummaryProps`, `Notifications.Props`, `Memories.Props`, `Gallery.Props`, `MusicRoom.Props`, `EndingsList.Props`, `ChapterSelect.Props`, `SceneReplay.Props`: Each component's props.
- `keyboardControls.Options`: The keymap the keyboard mixin takes.
- `RevealStatus`: Where a line's reveal stands.
- `NovelThemeVariable`: A `--novel-*` variable name.
- `NovelSettings`, `StoredSettings`, `AudioChannel`, `SkipMode`, `NovelLabels`, `PlayerAction`, `GamepadAction`: The settings and labels above, and what a key or a gamepad button does.
- `NovelLibrary`, `LibraryArc`, `LibraryChapter`, `LibraryScene`, `LibraryAsset`, `LibraryEnding`, `SceneLine`, `MemoryLine`: What `readLibrary` and `sceneLines` answer.
- `BacklogEntry`: A line as the backlog keeps it, with its values, speakers and voice for the reader's locale.
- `MixerSnapshot`: What the mixer plays now, for a test or a panel.
- `InterfaceSounds`: The `hover` and `select` sounds the player and the title screen play.
- `Phase`: Where the player is in a frame (`idle`, `staging`, `typing`, `waiting`, `replying`), as `data-phase` shows it.
- `RunningTransition`: A stage transition with its `finished` promise and a `finish()` that ends it early.
- `Column`: A column's `left`, `width` and whether it sits left of center.

### `@sdxc/novel/test`

#### `createTestPlay(novel: Novel, options?: StartOptions): TestPlay`

Starts a play a test drives by naming each reply, from the initial scene or from `scene` with `state` and a fixed `seed` so every draw replays. A reply that does not fit the current frame, an error frame, or a novel that refuses to start throws, so the test fails at once.

- `advance()`: starts the play or answers the current line or pause
- `advanceUntil(type)`: advances through lines and pauses until a frame of `type`, which it resolves to
- `choose(option)` and `complete(output)`: answer the current menu or interaction
- `follow(steps)`: replays a path `explore()` reported; its `pick` steps settle the play's `oneOf` picks in order instead of the seeded draw
- `save(slot)`: emits `save` and answers the state
- `frame`, `ending`, `state`, `game`, `scene`, `persistent`: where the play stands, `persistent` with every lasting extension slice
- `transcript` and `events`: every line, option and interaction so far, and every event emitted (the novel's own listeners receive them too)
- `play`: the generator underneath, for `rollback()` or raw frames

#### `check(novel: Novel): Promise<CheckReport>`

Reads every mapped scene without playing a line. Errors break a play or a save: a key used twice in a scene, a jump to a scene with no module, an undeclared asset or character, a module that fails to load. Warnings may be intended: two characters in one column, a menu whose every option is conditional, an `introduce` of a character declared `known` (`known-introduced`), a scene the initial one never reaches. Every `oneOf` candidate counts as reachable and is checked for a module, and a `notify` key a catalog lacks is a `missing-message` error scoped to its scene and locale. `ok` is true when no problem is an error.

#### `explore(novel: Novel, options?: ExploreOptions): Promise<ExploreReport>`

Plays every enabled option of every menu, and every output `interactions` answers for each interaction, from each seed, skipping a stop already reached with the same state, so loops and hubs end. It reports each ending with its shortest path, dead-end menus, unexplored interactions, errors, unreachable scenes, missing messages by locale, missing assets, which caps stopped the walk, and `check()`'s problems. A `oneOf` with more than one candidate branches over every candidate it can take there, adding a `{ type: "pick", scene }` step after the reply whose run reached it, and `notify` keys count toward missing messages. Every path replays in `createTestPlay(novel, { seed }).follow(steps)`.

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
- `reset({ seen?, chosen?, unlocked?, endings?, chapters?, introduced? })`: clears parts of persistent data (all of it when empty) and restarts the play
- `problems(): Promise<DevProblems>` and `graph(): Promise<SceneGraph>`: `check()`'s report with the missing messages, and the scene graph
- `dispose()`: stops listening to the novel

#### `NovelDevTools`

`<NovelDevTools devtools>` renders the panel: position and state, a jump with state edited as JSON, persistent data with resets, the scene graph as a flowchart, the event log, and the problems. The graph and problems load on request.

#### `toMermaid(graph: SceneGraph): string` and `describeEvent(event: DevEvent): string`

The scene graph as a [Mermaid](https://mermaid.js.org) flowchart (a box per scene grouped by chapter, solid arrows for `goto`, dotted for `call`, one per candidate of a `oneOf`, a rounded node per ending, and a slanted box for a scene with no module), and one line summing up a logged event.

#### Types from `@sdxc/novel/dev`

- `DevToolsOptions`, `DevEvent`, `ReloadResult`, `ResetOptions`, `DevProblems`: The options and answers above; a logged event carries an `id` counting up and `at`, its `Date.now()`.
- `SceneGraph`, `GraphScene`, `GraphEdge`, `MissingMessage`: Every declared scene (with `mapped` and its endings), every `goto` and `call` between them, and a key one locale's catalog lacks.
- `NovelDevTools.Props`: The panel's props.

### `@sdxc/novel/offline`

The page side of an opt-in offline cache. A page that never registers caches nothing.

#### `registerOffline(novel: Novel, options: RegisterOptions): Promise<Result<ServiceWorkerRegistration, Error>>`

Registers your worker script and sends it the novel's declared files, again whenever a new worker takes control. It fails when the browser has no service workers or refuses the script.

- `options.url`: The worker script's URL, served from a path whose scope covers the game's page
- `options.scope`: The worker's scope
- `options.type`: `"module"` for a worker built as an ES module (default `"classic"`)
- `options.extra`: More files to cache, such as voice files, which no declaration lists

#### `offlineAssets(novel: Novel, extra?: Iterable<string>): string[]`

Every file the novel declares (each asset in every locale, every sprite and layer) plus `extra`, each once in declaration order, leaving out `data:` and `blob:` URLs and Blobs.

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

### `@sdxc/novel/storage/local-storage`

#### `LocalStorageStore`

`new LocalStorageStore({ prefix? })` keeps a novel's saves, settings and persistent record in `localStorage` under `<prefix>:saves`, `<prefix>:settings` and `<prefix>:persistent` (`prefix` defaults to `"novel"`). `read()` answers `{ saves, settings, start }` to spread onto a player, `sync()` is the player mixin that stores each `novel:save`, `novel:settings` and `persist`, `putSave(slot, state)`, `putSettings(settings)` and `putPersistent(value)` store one value, and `clear()` removes all three. Every access is guarded: blocked or full storage reads as nothing stored and a write answers `false`.

## Pattern: Storing Saves, Settings And Persistent Data

The novel stores nothing: it emits JSON and the app keeps it. `LocalStorageStore` keeps it in the browser: `read()` answers the player's `saves`, `settings` and `start`, and `sync()` stores every save, settings change and `persist` from then on. Read it once the entry runs in the browser.

```tsx
import type { Handle } from "remix/component";

import { NovelPlayer } from "@sdxc/novel/ui";
import { LocalStorageStore } from "@sdxc/novel/storage/local-storage";
import { clientEntry } from "remix/component";

import { novel } from "./novel.js";

let storage = new LocalStorageStore({ prefix: "cafe" });

export let Game = clientEntry("/app/game.tsx#Game", function Game(handle: Handle) {
	let stored: LocalStorageStore.Stored | undefined;
	handle.queueTask(() => {
		stored = storage.read();
		void handle.update();
	});

	return () =>
		stored === undefined ? null : (
			<NovelPlayer.Default novel={novel} {...stored} mix={storage.sync()} />
		);
});
```

A save the schemas refuse fails `novel.start()` with `invalid-state`, and the player shows the error. When saved state changes shape in a way schema defaults cannot fill, append a step to `migrate`:

```typescript
import { createNovel } from "@sdxc/novel";
import { success } from "@sdxc/result";

import { SCENES, STATE } from "./declarations.js";

let novel = createNovel({
	scenes: SCENES,
	state: STATE,
	initial: SCENES.opening,
	migrate: [(save) => success({ ...save, state: { ...(save.state as object), charm: 0 } })],
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

Declare the interaction's input and output, hand the screen to it from a scene, and draw the custom frame through one `NovelPlayer.Interaction` over your `interactions()` map. Its children function narrows the frame by `frame.interaction` and must return something for every interaction, so a switch that misses one fails to compile. The component finishes by dispatching an `InteractionCompleteEvent`, typed by the output schema; the part answers the frame, and the engine validates the output and stores it at `into`.

```tsx
import type { Handle } from "remix/component";

import * as s from "remix/data-schema";
import { createScene, interaction, interactions } from "@sdxc/novel";
import { InteractionCompleteEvent, NovelPlayer } from "@sdxc/novel/ui";
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

function Fishing(handle: Handle<{ input: { difficulty: number } }>) {
	return () => (
		<button
			type="button"
			mix={on("click", (event) =>
				event.currentTarget.dispatchEvent(
					new InteractionCompleteEvent(INTERACTIONS.fishing, { caught: 4 }),
				),
			)}
		>
			Reel in
		</button>
	);
}

let player = (
	<NovelPlayer.Default novel={novel}>
		<NovelPlayer.Interaction interactions={INTERACTIONS}>
			{(frame) => {
				switch (frame.interaction) {
					case "fishing":
						return <Fishing input={frame.input} />;
				}
			}}
		</NovelPlayer.Interaction>
	</NovelPlayer.Default>
);
```

Add `interactions: typeof INTERACTIONS` to `NovelTypes` so `ctx.custom()` and `into` are checked, and give `explore()` the outputs to try: `explore(novel, { interactions: { fishing: () => [{ caught: 0 }, { caught: 5 }] } })`.

## Pattern: Affection As A Story Extension

An extension adds a game's own directives and its own saved state to every scene. Its slice lives at `state.<name>`, so it is saved, rolled back, explored and tested like the rest of the state, and a save made before the extension existed loads with `initial`. Methods answer ordinary directives, written with the scene directives plus `ctx.update()` for the slice.

```typescript
import type { CharacterDeclaration } from "@sdxc/novel";

import { createNovel, createScene, extension } from "@sdxc/novel";
import * as s from "remix/data-schema";

import { CAST, SCENES, STATE } from "./declarations.js";

export let affection = extension("affection", {
	state: s.record(s.string(), s.number()),
	initial: {},
	directives: (ctx) => ({
		increase: (character: CharacterDeclaration, amount: number) =>
			ctx.update((value) => ({ ...value, [character.id]: (value[character.id] ?? 0) + amount })),
	}),
});

export let extensions = [affection] as const;

declare module "@sdxc/novel" {
	interface NovelTypes {
		extensions: typeof extensions;
	}
}

export let novel = createNovel({
	scenes: SCENES,
	state: STATE,
	initial: SCENES.opening,
	extensions,
});

let cafe = createScene(SCENES.cafe, (ctx) => [
	ctx.affection.increase(CAST.mika, 10),
	ctx.when((state) => (state.affection.mika ?? 0) >= 30, [ctx.goto(SCENES.confession)]),
]);
```

Extensions change what the story can do, so they act only through the play. How the reader experiences it (reveal, auto, skip, saves) belongs to the player's behaviors, which never enter the game state.

## Pattern: Replacing A Player Behavior

Each reader behavior is an interface (`AutoBehavior`, `SkipBehavior`…) with a built-in class as its default. Pass your own through `behaviors`, read once at mount, and keep the instance to reach members beyond the interface:

```tsx
import { AutoModel, NovelPlayer } from "@sdxc/novel/ui";

import { novel } from "./novel.js";

class SlowAuto extends AutoModel {
	override delay(line: AutoModel.Line) {
		return line.delay * 2;
	}
}

let auto = new SlowAuto();
let player = <NovelPlayer.Default novel={novel} behaviors={{ auto }} />;
```

A behavior that follows the play listens to the player's context, which dispatches `frame`, `phase` and `ending` as each changes; a provider part of your own creates it and publishes it:

```tsx
import type { Handle, RemixNode } from "remix/component";

import { NovelPlayer } from "@sdxc/novel/ui";
import { TypedEventTarget } from "remix/component";

class Pulse extends TypedEventTarget<{ change: Event }> {
	constructor(player: NovelPlayer.Context, signal: AbortSignal) {
		super();
		player.addEventListener("frame", () => this.dispatchEvent(new Event("change")), { signal });
	}
}

export function PulseProvider(handle: Handle<{ children?: RemixNode }, Pulse>) {
	handle.context.set(new Pulse(handle.context.get(NovelPlayer), handle.signal));
	return () => handle.props.children;
}
```

Place `<PulseProvider>` inside the player, around the parts that read `handle.context.get(PulseProvider)`.

## Pattern: A Title Screen

`NovelPlayer.Default` opens on a title screen when given `titleScreen`, with the author's art, and swaps to the play the reader starts: a new game, Continue from the newest save, or a chapter replay. An ending, or the end of a replay begun there, brings the reader back to the title. Restyle it through the `--novel-title-*` variables:

```tsx
import { NovelPlayer } from "@sdxc/novel/ui";
import { css } from "remix/component";

<NovelPlayer.Default
	novel={novel}
	{...storage.read()}
	titleScreen={{ heading: "The Café", art: <img src={keyArt} alt="" /> }}
	mix={[
		storage.sync(),
		css({ "--novel-title-heading-color": "#f6e6bd", "--novel-title-button-radius": "0" }),
	]}
/>;
```

A game that mounts its own player renders `NovelPlayer.Title` and starts a player from each `novel:start`, whose `start` holds the save to resume or the chapter to replay, and gives that player `returnsToTitle` to show the title again on each `novel:title`.

## Pattern: Achievements That Last Across Playthroughs

An achievement outlives the play that earned it, so it is lasting extension data: `remember` writes it into the persistent record the app already stores from `persist`, and `notify` shows its toast through `NovelPlayer.Notifications`. The updater gives the same list when repeated, which a rollback may do.

```typescript
import type { Directive, LineKey } from "@sdxc/novel";

import { createScene, extension } from "@sdxc/novel";
import * as s from "remix/data-schema";

import { SCENES } from "./declarations.js";

export let achievements = extension("achievements", {
	persistent: { state: s.array(s.string()), initial: [] },
	directives: (ctx) => ({
		unlock: (id: string, key: LineKey) => [
			ctx.remember((all) => (all.includes(id) ? all : [...all, id])),
			ctx.notify(key),
		],
		ifUnlocked: (id: string, directives: Directive[]) =>
			ctx.when((_state, tools) => tools.persistent.achievements.includes(id), directives),
	}),
});

let lake = createScene(SCENES.lake, (ctx) => [
	ctx.when(
		(state) => state.lastCatch.caught >= 3,
		[ctx.achievements.unlock("angler", "achievements.angler")],
	),
]);
```

A title screen reads the list from the stored record as `persistent.achievements`.

## Pattern: A Day Loop With `goto.oneOf`

A date sim plays one event a day, drawn from the candidates the state allows. The draw is seeded, so a reload or a rollback lands on the same day, and when no event qualifies the scene falls through to a quiet day.

```typescript
import { createScene } from "@sdxc/novel";

import { SCENES } from "./declarations.js";

export default createScene(SCENES.week.day, (ctx) => [
	ctx.set("day", (day) => day + 1),
	ctx.when((state) => state.day > 7, [ctx.goto(SCENES.week.weekend)]),
	ctx.goto.oneOf(
		[SCENES.week.beachMika, SCENES.week.libraryYuki, SCENES.week.rain],
		(scene, state) => (scene === SCENES.week.libraryYuki ? (state.affection.yuki ?? 0) >= 10 : 2),
	),
	ctx.narrate("week.quiet"),
	ctx.goto(SCENES.week.day),
]);
```

`explore()` walks every event a day can draw, and a path it reports replays with `follow()`.

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
				<NovelPlayer.Default key={restarts} novel={novel} start={start} />
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
