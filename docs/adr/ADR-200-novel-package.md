# ADR-200: Novel Package

## Status

**Accepted** - 2026-11-19

## Background

A visual novel is a story told as a sequence of lines over a stage: a background, characters
drawn in front of it, music, and a textbox. The player reads, advances, and at certain points
chooses, and those choices change state that later decides which scenes play and which ending
is reached. Engines such as Ren'Py, Ink, Naninovel and Yarn Spinner exist for this, each with
its own language, runtime and toolchain.

This repository builds web applications with Remix v3: route contracts mapped to handlers,
middleware that publishes onto a context, `remix/component` for UI, and declaration maps whose
handlers load lazily (`@sdxc/jobs`, `@sdxc/mail`, `@sdxc/mcp`). A novel written with the same
shapes reads like the rest of an app, renders with the same components, tests with the same
tools, and ships inside an ordinary web app rather than a separate engine.

## Context

### What a novel needs

| Concern             | Need                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Story               | Lines, narration, choices, conditions, state changes, jumps between scenes, endings        |
| Stage               | Backgrounds, full-screen images (CGs), characters with expressions, positions, transitions |
| Sound               | Music, ambience, one-shot sounds, a voice per line                                         |
| Player              | Advance, auto mode, skip read text, backlog, rollback, saves, settings                     |
| Across playthroughs | Lines read, choices taken, endings reached, gallery and music unlocks                      |
| Language            | Every line, name and choice translated; voices and images with text per language           |
| Authoring           | Typed references, static checks, a way to test every path, fast iteration                  |

### How other engines save a position

| Engine    | Position saved as                                                                          | When the script changes                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Ren'Py    | The current statement and its return stack, plus changed variables, shown images and music | Statement identity comes from compiled `.rpyc` files; a missing spot fails to load, and code added later never runs for an old save |
| Naninovel | Script name and the index of the command within it                                         | Edits shift the index; its forum recommends checkpoint-based saving                                                                 |
| Ink       | Content path and visit counts as JSON                                                      | Adding or removing a choice or gather desyncs old saves                                                                             |

A numeric position breaks when the script is edited, a named one survives, and every engine
treats compatibility across releases as best effort.

### Repository pieces this builds on

| Package                             | Used for                                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/messageformat`, `@sdxc/i18n` | Every line is a MessageFormat 2 message; keys and their values are typed from the app's catalog, and `Trans` renders markup through a components map |
| `@sdxc/random`                      | Seeded, serializable draws, so rollback, saves and exploration replay the same rolls                                                                 |
| `@sdxc/expression`                  | Conditions written as data (the future dating-sim event tables)                                                                                      |
| `@sdxc/result`                      | Every operation that can fail answers a `Result`                                                                                                     |
| `remix/data-schema`                 | The novel's state schema, which types state and validates loaded saves                                                                               |
| `remix/component`, `@sdxc/ui`       | The player UI                                                                                                                                        |

## Decision

Add `@sdxc/novel`: declaration maps for scenes, characters and assets; scene modules that
return a list of directives; a novel object that maps scenes to their modules and runs a
playthrough as an async generator of frames; and separate entry points for the UI, testing,
developer tools and offline play.

### Entry points

| Entry                                               | Contains                                                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/novel`                                       | `scenes`, `scene`, `chapter`, `cast`, `character`, `assets`, `interactions`, `interaction`, `createScene`, `createNovel`, `lazy`, the frame, reply, state and event types, `NovelTypes` |
| `@sdxc/novel/ui`                                    | `NovelPlayer` and its parts (stage, textbox, choice menu, backlog, save and settings screens, memories and gallery) as `remix/component` components                                     |
| `@sdxc/novel/test`                                  | `createTestPlay`, `check` and `explore`                                                                                                                                                 |
| `@sdxc/novel/dev`                                   | Developer tools: scene jumping, state inspection, flowchart, event log, hot reload                                                                                                      |
| `@sdxc/novel/offline`, `@sdxc/novel/offline/worker` | An opt-in service worker that caches declared assets: registration for the page, and the worker itself                                                                                  |

A dating-sim layer is planned as `@sdxc/novel/sim` under its own ADR.

### Declarations

Declarations hold no handlers, so importing them costs only data and types.

**Scenes** are a nested map, grouped by chapter when the novel has a chapter select:

```ts
export default scenes({
	prologue: chapter({
		title: "chapters.prologue",
		scenes: { opening: scene({ title: "scenes.opening" }), arrival: scene() },
	}),
	spring: chapter({
		title: "chapters.spring",
		scenes: {
			cafe: { meeting: scene({ title: "scenes.cafeMeeting" }), sit: scene(), leave: scene() },
		},
	}),
});
```

A scene's name is its dotted path (`spring.cafe.meeting`). Saves and the seen-line record are
keyed by it, so renaming a scene is a breaking change for old saves, the same as renaming a job.

**The cast** declares characters only. A character has a flat set of sprites, layers, or no
image at all, and the options `enter` accepts are typed from that shape:

```ts
export default cast({
	mika: character({
		name: "cast.mika.name",
		color: "#e86a92",
		sprites: { neutral: "/mika/neutral.webp", smile: "/mika/smile.webp" },
	}),
	ren: character({
		name: "cast.ren.name",
		layers: {
			body: { school: "/ren/body-school.webp", casual: "/ren/body-casual.webp" },
			face: { neutral: "/ren/face-neutral.webp", grin: "/ren/face-grin.webp" },
		},
	}),
	player: character({ name: "cast.player.name" }),
});
```

**Assets** declare the media scenes draw on:

```ts
import cafe from "./bg/cafe.webp";
import street from "./bg/street.webp";
import letterEn from "./cg/letter-en.webp";
import letterJa from "./cg/letter-ja.webp";
import chill from "./music/chill.ogg";
import rain from "./ambience/rain.ogg";
import door from "./sfx/door.ogg";

export default assets({
	backgrounds: { cafe, street },
	images: { letter: { en: letterEn, ja: letterJa } },
	music: { chill },
	ambience: { rain },
	sounds: { door: { src: door, caption: "captions.door" } },
});
```

Every asset, and every voice file, is either one URL or a map of locale to URL. A missing locale
falls back to its language (`pt-BR` → `pt`), then to the first file in the map.

- **URLs come from the bundler.** Importing a file through Vite answers its content-hashed URL
  (`/assets/cafe-a1b2c3d4.webp`) in a build, and a glob with `query: "?url"` declares a folder of
  sprites without one import per file and without putting file contents in the bundle. A URL
  from `public/` also works, unhashed.
- **The server and the browser must agree.** `novel.links()` renders prefetch tags on the
  server, so the Worker build has to resolve an imported asset to the same URL as the client
  build. Phase 1 verifies this first.
- **Small files may be inlined.** Vite inlines files under `build.assetsInlineLimit` (4 KB by
  default) as `data:` URLs; the package accepts them, and they get no prefetch link.

**Interactions** declare custom scenes the app renders itself, such as a minigame, with schemas
for what goes in and what comes back:

```ts
export default interactions({
	fishing: interaction({
		input: s.object({ difficulty: s.number() }),
		output: s.object({ caught: s.number() }),
	}),
});
```

**Types.** An app declares its state, catalog and interactions once, the way `@sdxc/mail` apps
augment `MailTypes`, and every scene is typed from that:

```ts
declare module "@sdxc/novel" {
	interface NovelTypes {
		state: StandardSchemaV1.InferOutput<typeof STATE>;
		messages: typeof en;
	}
}
```

### Scenes are lists of directives

```ts
export default createScene(scenes.spring.cafe.meeting, (ctx) => [
	ctx.show(assets.backgrounds.cafe, { transition: "fade" }),
	ctx.play(assets.music.chill),
	ctx.enter(cast.mika, { at: "1/3", expression: "smile" }),
	ctx.say(cast.mika, "cafe.meeting.greeting"),
	ctx.when((state) => state.affection.mika >= 40, [ctx.say(cast.mika, "cafe.meeting.hoping")]),
	ctx.say(cast.mika, "cafe.meeting.gold", (state) => ({ gold: state.gold })),
	ctx.choose({
		"cafe.meeting.sit": [
			ctx.set("affection.mika", (value) => value + 5),
			ctx.goto(scenes.spring.cafe.sit),
		],
		"cafe.meeting.leave": [ctx.goto(scenes.spring.cafe.leave)],
	}),
]);
```

- **The builder runs once**, when the module loads, and returns data. `ctx` carries no live
  state; state is read only inside callbacks (`when`, `set`, message values), which the engine
  calls at play time with `(state, { random, persistent })`.
- **A scene is inspectable without running it**: every line, asset, jump and choice is in the
  array, which is what the static checks, `explore`, the flowchart and prefetching read.
- **Waits are implicit.** The engine stops at every `say`, `narrate`, `choose`, `wait` and
  `custom`; staging directives run through to the next stop.
- **Message keys identify lines.** A key appears at most once per scene (a static check), and it
  is what saves, the seen-line record, the backlog and voice files are keyed by.
- **Randomness** is `random` in callbacks, drawn from the play's seeded stream in `GameState`:
  `ctx.when((state, { random }) => random.bool(0.6), …)`.

| Directive                                        | Effect                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `show(asset, options)`                           | Sets the background or a full-screen image, with a transition                   |
| `hide(asset, options)`                           | Removes a full-screen image                                                     |
| `enter(character, options)`                      | Puts a character on stage at a position, with an expression or layers           |
| `exit(character, options)`                       | Takes a character off stage                                                     |
| `express(character, options)`                    | Changes a character's expression or layers                                      |
| `move(character, options)`                       | Moves a character to another position                                           |
| `say(character, key, values?)`                   | A line spoken by a character, or by several at once; stops for the player       |
| `narrate(key, values?)`                          | A line with no speaker; stops for the player                                    |
| `choose(options, menu?)`                         | A menu; stops for the player's choice                                           |
| `when(condition, directives, otherwise?)`        | Runs directives when the condition holds                                        |
| `set(path, update)`                              | Changes state at a typed path                                                   |
| `goto(scene)`                                    | Continues in another scene                                                      |
| `call(scene)` / `back()`                         | Plays a scene and returns to the next directive                                 |
| `wait(duration)`                                 | A pause with no line; stops for the UI to advance after the duration            |
| `play(asset, options)` / `stop(target, options)` | Music, ambience and sounds                                                      |
| `custom(interaction, { input, into })`           | Hands the screen to an app-rendered interaction; its output is stored at `into` |
| `ending(key)`                                    | Records an ending and finishes the play                                         |

Message values are evaluated once, when the line is shown, and stored with it, so the backlog,
rollback and the seen-line record show the text as the player read it. Values must be JSON.

### Choices

An option is a list of directives, or an object when it needs more:

```ts
ctx.choose({
	"cafe.meeting.sit": [ctx.goto(scenes.spring.cafe.sit)],
	"cafe.meeting.flirt": {
		when: (state) => state.charm >= 50,
		visibility: "disabled",
		reason: "choices.needCharm",
		do: [ctx.set("affection.mika", (value) => value + 10), ctx.goto(scenes.spring.cafe.date)],
	},
	"cafe.meeting.leave": [ctx.goto(scenes.spring.cafe.leave)],
});
```

- **`visibility`** decides what a failed `when` looks like: `"hidden"` (the default) removes the
  option, and `"disabled"` shows it locked with the `reason` message.
- **`once: true`** removes an option after it has been taken in this play. With the menu option
  `repeat: true`, the menu comes back after a branch that stays in the scene, which is how a
  question hub is written.
- **An option's ID is its label key**, stored internally with the scene name so a shared label
  such as `common.yes` never collides. Tests, analytics and the chosen-option record use it.
- **`option.chosen`** is true when the option was taken in any playthrough, from `Persistent`;
  the UI decides how that looks.
- **`timeout` and `default`** on the menu make a timed choice. The engine puts them on the frame
  and the UI runs the countdown.
- A menu with no available option is reported by the static checks and `explore`; at run time the
  engine continues past it and emits `error`.

### Stage

- **Positions** are `` `${n}/${d}` ``: column `n` of `d`. `1/3`, `2/3` and `3/3` are left, center
  and right; `1/2` and `2/2` split the stage; `1/1` centers. A character's width is capped to its
  column. `left`, `center` and `right` are aliases a novel can redefine, and two characters in one
  slot is a static warning.
- **Speaker focus.** On a line, every character on stage carries `speaking`: true for the
  speaker, false for the rest. With two or more characters on stage, the UI enlarges the speaker
  slightly, brings it to the front and darkens the others, so the player sees who talks. When
  nobody on stage speaks (narration, the player, an off-stage voice), nobody is darkened.
  `say([cast.mika, cast.ren], key)` marks both as speaking for a line said together. Whether and
  how to show it is the UI's: `NovelPlayer` turns it off with `focus={false}`, and the look is
  CSS the app can restyle.
- **Transitions** are named in the directive and implemented in CSS by the UI. Built in for
  backgrounds and images: `fade`, `dissolve`, `slide` in four directions, `wipe`, `zoom`, `flash`,
  `shake`; for characters: `fade` and `slide`. A custom name is a CSS class the app styles.
- **Audio** goes through four channels, each with its own volume setting in the UI:

| Channel    | Behavior                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------ |
| `music`    | One loop at a time, crossfaded when it changes                                             |
| `ambience` | Loops that layer                                                                           |
| `sound`    | One-shots that overlap, each with an occurrence ID so a re-rendered frame never replays it |
| `voice`    | One per line, found by character and message key; stops on advance and lowers the music    |

### Playing: an async generator of frames

```ts
type Play = AsyncGenerator<Frame, Ending, Reply | undefined>;
```

A frame is everything the UI needs to show one stop, so a renderer never replays history:

| Frame    | Carries                                                                           | Answered by                 |
| -------- | --------------------------------------------------------------------------------- | --------------------------- |
| `line`   | Speaker (or none), message key and values, voice, whether it was seen             | `frame.advance()`           |
| `choice` | Prompt, options (ID, label, `disabled`, `reason`, `chosen`), `timeout`, `default` | `frame.choose(id)`          |
| `pause`  | A duration                                                                        | `frame.advance()`           |
| `custom` | The interaction and its parsed input                                              | `frame.complete(output)`    |
| `error`  | The error and the frame to retry                                                  | The carried frame's methods |

Every frame also carries `stage` (background, image, characters with positions, sprites and `speaking`) and
`audio` (what each channel should be playing), both complete, plus the scene and a frame ID.

- **Replies are built from frames.** `next()` accepts only a `Reply`, which only frame methods
  create, so after narrowing on `frame.type` TypeScript prevents choosing on a line or advancing
  through a menu. A reply from a frame that is no longer current, or an option that is not
  available, yields an `error` frame.
- **The engine has no clock.** It never waits, animates or times out; durations and timeouts are
  facts on frames that the UI acts on. A test advances through a `wait` instantly.
- **Outside the generator**: `play.state` is the current `GameState`, `play.rollback()` restores
  the previous stop (bounded by `createNovel({ rollback })`, default 100), and `play.save(slot)`
  emits `save`.

```ts
let play = novel.start({ from: saved });
let step = await play.next();

while (!step.done) {
	let frame = step.value;
	let reply = await iife(async () => {
		if (frame.type === "choice") return frame.choose(await pick(frame.options));
		if (frame.type === "custom") return frame.complete(await runInteraction(frame));
		if (frame.type === "error") return showError(frame); // answers through the carried frame
		await waitForPlayer(frame);
		return frame.advance();
	});
	step = await play.next(reply);
}
```

`novel.start({ from })` answers a `Result`: a loaded save is untrusted, so it is migrated and
validated against the state schema before a play starts.

### Game state and saves

```ts
interface GameState {
	version: number;
	position: { scene: string; line: string };
	stack: { scene: string; line: string }[];
	stage: Stage;
	audio: Audio;
	state: NovelTypes["state"];
	random: RandomState;
	taken: string[]; // options taken in this play, which `once` reads
	meta: { scene: string; savedAt: string; playTime: number };
}
```

- **The position is anchored on a message key.** The player can only be stopped at a line or a
  menu, and both have a key, so inserting or removing beats anywhere in a scene leaves a save
  valid. When the key no longer exists, the play resumes at the start of its scene; a pause,
  interaction or call anchored as `<key>+<n>` whose count no longer resolves resumes at `<key>`.
- **The stage and audio are saved**, so loading draws what was on screen without replaying the
  scene.
- **New state fields take their schema default.** For larger changes,
  `createNovel({ version, migrate })` upgrades an older `GameState` step by step.
- **The package stores nothing.** It emits `GameState` as JSON on `save`, and the app keeps it in
  `localStorage`, IndexedDB, a server or anywhere else.

### Persistent data

Data that outlives a playthrough is separate from `GameState` and is never rolled back:

```ts
interface Persistent {
	seen: Record<string, Record<string, JsonValue>>; // `<scene>:<key>` → the values it was shown with
	chosen: string[];
	endings: string[];
	chapters: string[];
	unlocked: { images: string[]; music: string[] };
}
```

It feeds skip-read-text, the chosen-option mark, a Memories screen that lists each scene's seen
lines in order by reading the scene arrays, the CG gallery, the music room, the endings list,
scene replay and the chapter select. It is emitted on `persist`, and the app stores it.

### Events and plugins

The novel is a typed event emitter. Handlers receive the payload and the play they fired for, so
concurrent plays in tests stay apart:

```ts
novel.on("save", ({ slot, state }) => localStorage.setItem(`save:${slot}`, JSON.stringify(state)));
novel.on("persist", (persistent) => localStorage.setItem("persistent", JSON.stringify(persistent)));
novel.use(achievements({ "endings.good": "ACH_GOOD_END" }));
```

| Event                         | When                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| `scene`                       | A scene starts                                                        |
| `line`, `choice`              | A line is shown; an option is taken                                   |
| `ending`, `unlock`, `chapter` | An ending is reached; an image or track unlocks; a chapter is reached |
| `save`, `persist`             | A save is requested; persistent data changed                          |
| `error`                       | A missing asset, message or mapping, or a dead-end menu               |

A plugin is a function that registers listeners. Handlers run side effects only and cannot change
the story, which keeps a play deterministic; a handler that fails is reported on `error`.

### Language

- Every line, name, choice label, chapter and caption is a message key in the app's catalog,
  typed by `@sdxc/i18n`: keys are checked, and each message's values are checked against the
  variables its text declares.
- Inline effects use MessageFormat 2 markup (`{#shake}No way!{/shake}`, `{#b}…{/b}`); the UI
  decides which names it supports by passing elements to `Trans`'s `components`.
- The frame carries keys and values, so changing language re-renders the same frame.

### What belongs to the UI

The engine decides what happens next; the UI decides how and when it is shown.

| Concern                                               | Owner                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| Text speed, auto mode and its delay                   | UI                                                               |
| Skip                                                  | UI, from the frame's `seen`                                      |
| Volumes, voice lowering the music                     | UI                                                               |
| Language                                              | UI                                                               |
| Transition durations                                  | UI                                                               |
| The look of disabled and chosen options               | UI                                                               |
| Timed choices                                         | Engine puts `timeout` and `default` on the frame; UI counts down |
| Rollback depth, option availability, `once`, `repeat` | Engine                                                           |

`createNovel` takes story options only; `NovelPlayer` takes presentation settings through its
`settings` prop and reports changes through `onSettingsChange`, for the app to store.

### `@sdxc/novel/ui`

- **`NovelPlayer`** is the component that owns a play, rendered inside the app's own client
  entry, keeps the current frame as state, and renders
  it; every other part is a presentational component over frame types, so a game can replace any
  of them.
- **One frame renders in order**: apply the stage and await its transitions; start the voice and
  the typewriter; wait for a click, auto mode or skip; reply. A click during a transition
  finishes it.
- **Transitions** use the View Transitions API for stage changes and CSS for characters; the
  player awaits `transition.finished` and `getAnimations({ subtree: true })`, so built-in and
  custom transitions end the same way. `prefers-reduced-motion` and skip finish them at once.
- **Audio** uses the Web Audio API: one `AudioContext`, a gain node per channel and a master gain.
  Voice and sounds are decoded buffers whose `ended` event drives auto mode; music and ambience
  stream through `MediaElementAudioSourceNode`. The context resumes on the first interaction.
- **Images** are `<img>` elements, decoded with `img.decode()` before a transition starts.
- **Speaker focus** is a `data-speaking` attribute on each character: the default stylesheet
  scales the speaker to about 105%, raises it above the others, and dims the rest with
  `filter: brightness(0.6)`, all through a short CSS transition so focus glides between speakers.
- **The stage** is a fixed 16:9 logical surface scaled with container query units and
  letterboxed, with full-screen mode through the Fullscreen API.
- **Input**: click, Space and Enter advance; Ctrl skips; the wheel and arrow keys reach the
  backlog and rollback; tap and swipe on touch; gamepad focus navigation.
- **Accessibility**: the textbox is a live region, sounds show their captions, and font size, a
  dyslexia-friendly font and self-voicing are settings.
- **Screens**: backlog, save and load slots (thumbnails drawn from the saved `stage`), settings,
  Memories, gallery, music room, endings and chapter select.

### Loading and prefetch

- `novel.map(scenes.x, lazy(() => import("./scenes/x.js")))` loads a scene's module on first use.
- `novel.links(scene, { depth })` answers `<link>` descriptors, `preload` for what the scene
  shows and `prefetch` for the scenes its jumps reach, which a page renders into its head.
- While a play runs, the player prefetches the modules and assets of the scenes reachable from
  the current one.

### Testing: `@sdxc/novel/test`

```ts
let play = createTestPlay(novel, {
	seed: "mika",
	state: { affection: { mika: 40 } },
	scene: scenes.spring.cafe.meeting,
});

let frame = await play.advanceUntil("choice");
expect(frame.options.map((option) => option.id)).toEqual([
	"cafe.meeting.sit",
	"cafe.meeting.leave",
]);

await play.choose("cafe.meeting.sit");
expect(play.state.affection.mika).toBe(45);
expect(play.scene).toBe(scenes.spring.cafe.sit);
```

`explore(novel, options)` walks every combination of choices from the initial scene, copying the
state at each menu and skipping a position already visited with an identical state, so loops and
hubs terminate. It reports the endings reached with the shortest choice path to each,
unreachable scenes, dead-end menus, missing messages per locale and missing assets.
`maxPaths` and `maxDepth` cap a very branchy novel, the report says when a cap was hit, and draws
come from seeded streams so every reported path replays exactly in `createTestPlay`.

### Developer tools: `@sdxc/novel/dev`

A panel built with `remix/component` that connects through the novel's events: jump to any scene
with an edited state, inspect state and persistent data, see the scene graph as a flowchart, read
the event log, see missing assets and messages, and reset seen lines and unlocks. With the dev
server, an edited scene module reloads and the play stays on the same line, since positions are
anchored on message keys. It is a separate entry so it never ships in a production bundle.

### Offline: `@sdxc/novel/offline`

An opt-in service worker that caches only the novel's declared assets, under fingerprinted URLs,
and its scene modules. An unhashed URL (a file from `public/`) is cached only with revalidation,
so a changed file is never served stale. It never caches HTML or app routes, caches assets as they are first
fetched, clears caches from older versions on activation, and takes an optional size budget.

### Out of scope

| Feature                     | Why                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------- |
| NVL (full-screen text) mode | Adding a mode to frames later breaks nothing                                        |
| DLC                         | Chapters cover the structure when it is needed                                      |
| Dating-sim layer            | `@sdxc/novel/sim`, with its own ADR, after the core works                           |
| Canvas or WebGL effects     | An optional effects layer later; frames assume nothing about how the stage is drawn |
| Desktop builds and Steam    | Depend on a desktop shell decision                                                  |

## Usage Examples

### A whole novel

```ts
// novel/state.ts
export const STATE = s.object({
	affection: s.object({ mika: s.defaulted(s.number(), 0) }),
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
});

// novel/types.ts
declare module "@sdxc/novel" {
	interface NovelTypes {
		state: StandardSchemaV1.InferOutput<typeof STATE>;
		messages: typeof en;
	}
}

// app/initializers/novel.ts
export const novel = createNovel({
	scenes,
	cast,
	assets,
	interactions,
	state: STATE,
	initial: scenes.prologue.opening,
	version: 1,
});

novel.map(
	scenes.prologue.opening,
	lazy(() => import("~/novel/scenes/prologue/opening")),
);
novel.map(
	scenes.spring.cafe.meeting,
	lazy(() => import("~/novel/scenes/spring/cafe/meeting")),
);
```

### A custom interaction

```ts
ctx.custom(interactions.fishing, { input: { difficulty: 2 }, into: "lastCatch" }),
ctx.when((state) => state.lastCatch.caught >= 3, [ctx.say(cast.mika, "lake.impressed")]),
```

The app renders the `custom` frame with its own component and replies with
`frame.complete({ caught: 4 })`, which the engine validates against the declared output schema.

### Rendering a page with the player

The app's own client entry imports the novel and renders `NovelPlayer`, since a novel holds
functions and cannot travel from the server as props. The page renders that entry and the
prefetch links for the opening scene:

```tsx
router.get(routes.play, async (ctx) =>
	ctx.render(
		<Document assets={ctx.assets} links={await novel.links(scenes.prologue.opening, { depth: 1 })}>
			<Game />
		</Document>,
	),
);
```

### Storing saves and settings

```ts
novel.on("save", ({ slot, state }) => db.put("saves", state, slot));
novel.on("persist", (persistent) => db.put("persistent", persistent, "main"));
```

## Consequences

### Positive

- **One set of patterns.** Scenes are declared, handled and mapped the way routes, jobs, emails
  and MCP tools are, and the UI is `remix/component`.
- **Typed throughout.** Scene jumps, characters' expressions and layers, state paths, message
  keys and their values, interaction inputs and outputs, and replies are all checked by the
  compiler.
- **Saves survive edits.** Anchoring on message keys keeps old saves valid when beats are added
  or removed.
- **Testable without a browser.** The engine is a pure generator; `createTestPlay` covers a scene
  and `explore` covers the whole story.
- **Translation from the start.** Every visible string is a typed message, and voices and images
  localize per asset.
- **Storage stays the app's.** Saves, persistent data and settings are JSON on events.

### Negative

- **Writers author keys.** Lines live in a catalog, not inline in the scene, which is less direct
  than a script language; tooling that generates keys from a draft can close the gap later.
- **No script language.** A novel is TypeScript, which suits developers more than writers who
  know Ren'Py or Ink.
- **Static analysis stops at callbacks.** `when` and `set` callbacks are opaque to `explore` and
  the flowchart, which see the branch but not its condition.
- **Large surface.** Five entry points and a full player UI are a significant build and a large
  public API to keep stable.

### Neutral

- **Renaming a scene breaks old saves**, the same contract as renaming a job.
- **Compatibility is best effort**, as in every engine studied: a removed line resumes at its
  scene's start.

## Implementation Plan

### Phase 1: Declarations and the engine

**Priority:** High

1. Verify that an asset imported from a declaration resolves to the same URL in the Worker build
   and the client build.
2. Write the playthrough specs first: a small fixture novel with lines, a menu, a hub, a jump, a
   call, an ending and a custom interaction, asserted through the generator.
3. Declarations (`scenes`, `chapter`, `scene`, `cast`, `character`, `assets`, `interactions`),
   `NovelTypes`, `createScene` and its directives.
4. `createNovel`, `map`, `lazy`, `start`, frames and replies, `GameState`, rollback.
5. `createTestPlay`.

### Phase 2: Saves, persistence and events

**Priority:** High

1. Message-key anchoring, stage and audio snapshots, `version` and `migrate`, `start({ from })`
   validation.
2. `Persistent` with seen-line values, chosen options, endings, chapters and unlocks.
3. The event emitter, `use`, and `error` reporting with placeholders.

### Phase 3: Static checks and exploration

**Priority:** High

1. Static checks over the scene arrays: duplicate keys, unmapped jumps, unknown assets, shared
   slots, dead-end menus.
2. `explore` with its report.

### Phase 4: The player UI

**Priority:** High

1. `NovelPlayer`, stage, textbox, choice menu, frame sequencing, transitions and the Web Audio
   mixer, with browser tests.
2. Auto mode, skip, backlog, rollback, save and load slots, settings and full screen.
3. Memories, gallery, music room, endings and chapter select.

### Phase 5: Loading and developer tools

**Priority:** Medium

1. `links` and runtime prefetch.
2. `@sdxc/novel/dev` with hot reload.

### Phase 6: Offline

**Priority:** Low

1. `@sdxc/novel/offline`.

## Alternatives Considered

### 1. Imperative handlers on a context

`createScene(scene, async (ctx) => { await ctx.say(…); ctx.goto(…) })`.

**Rejected because**: the waits are implicit and easy to get wrong without `await`, a suspended
async function cannot be saved mid-scene, and nothing about a scene can be read without running
it, which removes static checks, exploration, the flowchart and prefetching.

### 2. A script language

A text format compiled to the same directives, like Ren'Py's or Ink's.

**Rejected for now because**: it needs its own parser, editor support and error reporting before
the first scene runs, and TypeScript already gives typed references and checking. A text format
can later compile to the same directive arrays.

### 3. JSX as the scene language

**Rejected because**: `remix/component` renders to the DOM or to HTML and has no custom-renderer
API, and JSX in the same project already means UI.

### 4. Canvas rendering

**Rejected because**: `<img>` layers, CSS, the View Transitions API and `remix/component` cover the
stage, and the DOM gives text layout, accessibility and focus without reimplementing them.

### 5. Raw input objects for `next()`

`play.next({ type: "choose", option })`.

**Rejected because**: a generator's `next()` has one parameter type for every step, so the
compiler could not stop a choice being sent to a line. Replies built by frame methods restore
that check.

### 6. Saving a numeric beat position

**Rejected because**: any edit before the saved beat shifts the index, which is the failure
Naninovel and Ink saves show.

### 7. Timing inside the engine

**Rejected because**: tests and `explore` would wait on timers, and text speed, auto mode and
transitions are presentation the player configures.

## References

- [Ren'Py: Saving, Loading, and Rollback](https://www.renpy.org/doc/html/save_load_rollback.html)
- [Naninovel: State Management](https://naninovel.com/guide/state-management)
- [inky issue #253: editing the story breaks saved state](https://github.com/inkle/inky/issues/253)
- [MessageFormat 2](https://messageformat.unicode.org/)
- [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [ADR-104: Random Package](./ADR-104-random-package.md)
- [ADR-105: Expression Package](./ADR-105-expression-package.md)

## Current Progress

- [x] Phase 1: Declarations and the engine
- [x] Phase 2: Saves, persistence and events
- [x] Phase 3: Static checks and exploration
- [x] Phase 4: The player UI
- [x] Phase 5: Loading and developer tools (the player's runtime prefetch, which reads
      `novel.reachable()`, is wired with the player)
- [x] Phase 6: Offline

## Notes

- The package is created only after this ADR is accepted. When it is, it follows the new-package
  checklist: a `description`, a `LICENSE.md`, the root README row, the `release:bootstrap`
  publish, its group in the docs site, and a guide.
- `NovelPlayer` is a client entry; its exported value needs a written type for the publish build.
- A small demo novel in an app would exercise every phase; it needs its own decision before an
  app is created.

### Phase 1 decisions

Made while building Phase 1, without a review, where this ADR left the detail open:

- **Asset URLs agree.** In a throwaway app on this repository's Vite + `@cloudflare/vite-plugin` +
  `@pitlane/vite-plugin-remix` setup, an imported asset and a `?url` glob resolved to the same
  hashed URL in the Worker build and the client build. `@pitlane/assets` forces
  `build.assetsInlineLimit` to `0`, even over an app's own value, so nothing is inlined as a
  `data:` URL in these apps; the engine still accepts any URL string.
- **`done: true` on an option leaves a repeating menu.** A hub needs a way out that continues in
  the same scene; without it every branch of a `repeat` menu would come back to the menu.
- **`GameState` carries `taken`** (options taken in this play, as `<scene>:<option>`), since `once`
  must survive a save. `version` is left to Phase 2, which reads a save without it as version 1.
- **Pauses, interactions and calls are anchored as `<previous key>+<n>`**, counting those three
  since the last line or menu in document order; a menu is anchored on its prompt key, or its first
  option's key without one. A call's return address uses the same anchor.
- **A stop's snapshot is taken before its callbacks run.** `play.state`, rollback and a resumed
  save re-evaluate the stop from the same state and random position, so message values and option
  conditions come out exactly as first shown.
- **The stage and audio keep each asset's id beside its URL.** A loaded save re-reads URLs from the
  current declarations by id and drops what no longer exists, so a rebuild with new hashes keeps
  old saves drawing.
- **Voices come from `createNovel({ voice })`**, a function of speaker id and message key that
  answers a URL or a locale map, which fits a `import.meta.glob` of voice files.
- **`seen` and `chosen` are per play until `Persistent` exists in Phase 2**, which widens them to
  every playthrough.
- **Transitions and sounds belong to one stop.** They appear on the frame where they happened and
  are cleared after it, so a re-rendered frame never animates or plays twice.
- **`NovelTypes` also takes `interactions`**, and a custom frame carries the interaction's name as
  `frame.interaction`, a top-level discriminant that narrows `input` and `complete()`.
- **Interaction input and output are typed from the schema's output** when its input type is
  `unknown`, as every `remix/data-schema` schema's is.
- **An error frame's `frame` is `null`** when the play cannot reach its first stop; calling
  `next()` again retries. A menu with no available option is passed silently until Phase 2's
  `error` event reports it.
- **`Ending` is `{ key, scene }`**, with `key: null` when the story runs out without an `ending`.
- **`stop()` takes `"music"`, `"ambience"` or one ambience asset**; `play()` takes `volume` and
  `fade`. The default aliases are `left` `1/3`, `center` `2/3`, `right` `3/3`, redefined through
  `createNovel({ positions })`.
- **`unicorn/no-thenable` is off for the package**, because an option's directives are named
  `then` as this ADR writes them; an app writing option objects sees the same warning.
- **`novel.map()` throws on a scene mapped twice**, as `@sdxc/mail` does for a setup mistake, and
  a play reports an endless loop after 10,000 directives without a stop.
- **The fixture novel lives inside its test file**, so its `NovelTypes` augmentation never reaches
  the published build.
- **`meta.scene` is the scene's title key**, or its name without one, and `meta.playTime` counts the
  time between a play's start and the read of `play.state`, carried over from a save.

### Phase 2 and 3 decisions

Made while building Phases 2 and 3, without a review, where this ADR left the detail open:

- **A menu option's directives are `do`, not `then`**, and so is a `when` directive's branch. An
  object with a `then` member is a thenable, which `unicorn/no-thenable` flags in every app that
  writes option objects; the package's lint override is gone and apps need none.
- **Voices receive `{ speaker, key, locale }`.** With `createNovel({ locales })`, or the locales of
  `messages`, the novel asks once per locale and the frame carries a map of locale to URL, which a
  Vite `import.meta.glob` table per locale folder answers; without locales it asks once.
- **`Persistent` replaces Phase 1's per-play `seen` and `chosen`.** Lines and options are keyed as
  `<scene>:<key>`; a line keeps the values it was last shown with (`{}` without values).
  `start({ persistent })` validates the stored value and starts from empty data when it is missing
  or refused, and callbacks read it as `tools.persistent`.
- **A run's records settle with its stop.** Lines, choices, unlocks, chapters, endings and story
  errors are queued while the engine works on its copy and applied, then emitted in play order
  followed by one `persist`, only when the run reaches its stop, so a refused reply or a failed
  jump records nothing.
- **Event timing.** `scene` fires when a scene starts from its top (a new play, `goto`, `call`),
  never on a resumed save or a return; `chapter` whenever the play enters a scene of another
  chapter than the scene before it; `unlock` only the first time in any playthrough; `ending` for
  every ending, `key: null` included, recording only keyed ones.
- **`version` defaults to 1 and `migrate` is keyed by the version a step upgrades from.** A step
  receives a copy and answers a `Result`; the novel stamps the next version. A throw, a failure, a
  missing step or a save newer than the novel answers `migration-failed`; a save that is not an
  object answers `invalid-state`.
- **A counted anchor that no longer resolves resumes at its key's line**, and any other missing
  anchor at the scene's start.
- **`error` carries a `NovelError` with `subject`** (and `locale` for a message). It reports
  dead-end menus (`<scene>:<menu anchor>`), undeclared assets and characters (`cast.<id>`) or
  assets declared without a URL, keys a `createNovel({ messages })` catalog lacks, unmapped scenes,
  load failures, endless loops and failing listeners (`listener-failed`). Each story problem is
  reported once per play. Refused replies stay on the error frame alone, as a caller's mistake.
- **Placeholders.** An undeclared asset is still drawn from its declaration, a missing message
  still travels as its key, and a dead-end menu is passed. A jump to an unmapped scene keeps the
  error frame to retry, since there is nothing to continue with.
- **Listeners.** `on` returns an unsubscribe, `use` returns the novel, a rejected promise is
  reported like a throw, and a failing `error` listener is dropped so a report cannot loop.
  `play.save(slot)` takes a string slot and returns the state it emitted.
- **`check` and `explore` live in `@sdxc/novel/test`**, as tooling that never ships to players.
  `check` is async because lazy modules load, and answers a flat list of problems with a
  `severity`: errors for duplicate anchors (line keys and menu anchors), unmapped jumps, undeclared
  assets and failed loads; warnings for shared columns (walked in document order within a scene,
  branches on a copy), menus whose every option has `when`, and declared scenes the initial scene
  never reaches.
- **`explore` branches by resuming from a save** at each menu and interaction, so every path is
  exactly what `start({ from })` and `createTestPlay` replay. A stop is skipped when the same
  position, call stack, state, taken options and random position was already reached on an equal
  or shorter path, which keeps the shortest path to each ending; `Persistent` is left out of that
  key. A path is a seed and its steps, replayed with `TestPlay.follow(steps)`; endings, dead ends,
  unexplored interactions and errors each keep their shortest path. Defaults: `maxDepth` 100,
  `maxPaths` 1000, `seeds: ["explore"]`. Its plays are quiet, so the app's listeners never hear
  them, and missing messages are checked on every shown frame and every entered scene's titles.
- **`createTestPlay` logs the play's events** through a sink of its own while the novel's
  listeners still receive them, takes `persistent` like `start()`, and gains `save` and `follow`.

### Phase 4 decisions

Made while building steps 1 and 2 of Phase 4, without a review, where this ADR left the detail open:

- **`NovelPlayer` is a plain component, not a client entry.** A novel holds functions and cannot be
  serialized, so the app's own `clientEntry` renders it, as the page example above already does.
- **The typewriter paints instead of mutating the DOM.** The whole line renders through `Trans` at
  once and the unrevealed rest is a range in the `novel-unrevealed` CSS highlight, painted
  transparent: the line keeps its final layout, the live region holds the whole text, and markup
  effects keep running.
- **Markup shipped:** `b`, `i`, `shake` (a looping CSS animation), `speed` and standalone `pause`; an
  app passes its own elements or markup components through `markup`.
- **Built-in scenery transitions are View Transitions typed `novel-<name>`** over layers named per
  player with the `novel-scenery` class; the root snapshot does not animate during them. A custom
  name is the class on the new image. Characters animate through CSS transitions with
  `@starting-style` (fade, slide in from the nearer edge, a `left` transition for a move), and a
  replaced sprite fades out through `persistNode`; a character's exit is drawn as the frame
  authors it (see the step 3 decisions).
- **A frame waits only for the stage's finite animations**; the interface over it (textbox, menu
  countdown, interaction) and looping effects are left out. Rollback, error frames, skip and
  reduced motion present a frame at once.
- **Auto mode waits for the typewriter, the voice and self-voicing**, then `autoDelay` (default
  1000ms) plus 25ms per character for an unvoiced line.
- **Skip stops itself** at an unread line in read-only mode, at a menu and at an interaction; held
  Control resumes it while held. Sounds a skipped frame started are recorded as played, unheard.
- **Keys:** Space/Enter advance, `a` auto, `k` skip (Tab stays focus navigation), ↑/PageUp and the
  wheel up roll back, the wheel down advances, ←/`l` backlog, `q`/`w` quick save and load, `s`/`o`
  save and load screens, `h` hide, `f` full screen, Escape settings. Keys stand down while a dialog
  or a field has focus. Touch: a tap advances, a downward swipe opens the backlog, an upward swipe
  rolls back. Gamepad (standard mapping): A presses the focused control or advances, B closes a
  dialog or hides the interface, LB rolls back, RB skips, Start opens settings, the D-pad moves
  focus.
- **Saves go through `play.save(slot)`**, so they reach the novel's `save` event, and also through
  an `onSave` prop; the app passes stored saves back through `saves`. Slots are `quick` plus `slots`
  numbered ones (default 6), and loading carries the current play's persistent data over.
- **Settings are one JSON object** (`textSpeed` in characters per second with `0` for instant,
  `autoDelay`, `skip`, five volumes, `fontSize`, `dyslexiaFont`, `selfVoicing`), completed with
  defaults from whatever the app stored.
- **The interface's own words are a `labels` prop with English defaults**, since the story's catalog
  belongs to the app; the screens are built from `@sdxc/ui`'s `Dialog`, `Slider`, `Switch` and
  `Select`, so a game loads `@sdxc/ui/theme.css`.
- **The dyslexia-friendly font is a stack** (`OpenDyslexic`, `Atkinson Hyperlegible`, `Lexend`,
  Verdana) with wider tracking and spacing; the package ships no font file.
- **A localized asset falls back** from the exact locale to its language, then to the map's first
  file.
- **Browser tests declare their own small novel** with the keys of the package fixture's
  `NovelTypes` augmentation, which every file of the package shares when it is type checked.

### Phase 4 step 3 decisions

Made while building step 3 of Phase 4, without a review, where this ADR left the detail open:

- **Markup options.** `speed` and `pause` are `Trans` markup components: `{#speed rate=…}` types its
  span at `rate` times the reader's text speed (half without it), so a slowed line stays relative to
  the speed the reader chose, and `{#pause ms=…/}` holds for `ms` (400ms without it). A literal option
  arrives as a string and a variable one as its value; anything that is not a positive number falls
  back to the default.
- **Exits are a one-shot fact on the stage.** `stage.exits` lists each character an `exit` took off
  since the previous stop, as it last stood, with `transition` holding the exit's own transition
  (never its entrance's). It is set only on that stop, cleared like other transitions, left out of
  `play.state` and saves, and dropped when the character enters again before the stop. A character
  that was not on stage leaves no record.
- **The UI draws an exit as authored.** `Stage` keeps the character's element and marks it
  `data-exiting`: `fade` fades out, `slide` slides 30% toward the nearer edge while fading, and a
  custom name is the element's class, which an app animates under `[data-exiting]` and should end
  hidden. An exit without a transition, a removal no frame explains (a load, a rollback) and skip or
  reduced motion take the character off at once, so the old fade on every removal is gone.
- **Replay is an engine option**, `start({ replay: "scene" | "chapter" })`, since only the engine
  knows what a play records. A replay finishes, with a `null` ending key, at a `goto` out of the scene
  it started in, or out of that scene's chapter (scenes outside every chapter count as one); calls
  play through and return. It records only seen lines: `chosen`, `endings`, `chapters` and
  `unlocked` stay as they were, and `choice`, `ending`, `chapter` and `unlock` stay silent, while
  `scene`, `line`, `persist` and `error` still fire. Saving is the player's to refuse: `play.save()`
  still answers.
- **Chapter select and scene replay both start replays.** Chapter select starts a `"chapter"` replay
  at the chapter's first mapped scene, scene replay a `"scene"` replay. In `NovelPlayer` a replay
  hides save and quick save (their keys do nothing) and adds an "End replay" button; when it ends, on
  its own or from the button, the player resumes the play it interrupted at the same stop, with its
  backlog and the persistent data the replay recorded. A replay started with no play to resume (a
  title screen passing `start={{ scene, replay }}`) ends like a play and calls `onEnding`. Loading a
  save during a replay leaves it. Rollback history before the replay is not kept.
- **Reached is read from `Persistent`.** A scene is reached once a line in it was read or an option in
  it taken; a chapter once it is in `chapters` or one of its scenes is reached. Chapter select lists
  titled chapters and scene replay titled scenes, since an untitled scene is a beat no menu lists;
  Memories also shows an untitled scene's read lines, without a heading.
- **The library reads every mapped scene.** `readLibrary(novel, persistent, locale)` loads each
  mapped module (lazy ones included) so the endings list knows every `ending` key, collected
  statically with `endingKeys()`; reached keys no scene holds any more are appended. A module that
  fails to load lists the scene with `loaded: false` and no lines. `sceneLines()` walks conditions
  and menu options in document order; a line's values come from `Persistent.seen` and its voice
  from the novel's `voice` option for the reader's locale, with the asset fallback rule.
- **Screens are panels, the player puts them in dialogs.** `Memories`, `Gallery`, `MusicRoom`,
  `EndingsList`, `ChapterSelect` and `SceneReplay` each take `novel` and a persistent value and load
  their library themselves (showing `labels.loading` meanwhile), so a title screen lays them out as
  it likes. `NovelPlayer` lists them in an "Extras" menu (the `@sdxc/ui` `Menu` popover, turned off
  with `extras={false}`) and renders each inside a modal dialog only while it is open, reading the
  play's persistent data as it opens.
- **The gallery's lightbox is its own native `<dialog>`**, one per gallery showing the picked CG;
  a locked CG is a placeholder labeled `labels.locked`.
- **The music room plays through an `AudioMixer`**: the player's own, whose music and ambience the
  player restores from the frame when the room closes, or one the room makes and disposes. Tracks
  have no declared title, so a track shows its key unless `musicTitles` (or `titles`) maps its id to
  a message key.
- **Runtime prefetch lives in the director.** Each time a presented frame stands in a scene other
  than the last one prefetched for, `NovelPlayer` calls `novel.reachable(scene, { depth, locale })`
  (depth 1 by default, set with the `prefetch` prop, `false` for none), which also imports the
  reachable modules. The files are warmed as the player uses them: images decoded through
  `new Image()`, sounds and voices fetched and decoded into the mixer's buffer cache
  (`AudioMixer.preload`), music and ambience left to the HTTP cache through `<link rel="prefetch">`,
  since media elements stream them. Each URL is warmed once per player, `data:` and `blob:` URLs are
  skipped, and the reader's locale picks each localized file.
- **Prefetch never outruns the play.** At most four files warm at once; entering another scene drops
  the files still waiting (those in flight finish), and frames shown in skip mode prefetch nothing,
  so racing through scenes queues no work. A file that fails is left for the play to report.
- **New labels** (`extras`, `memories`, `gallery`, `musicRoom`, `endings`, `chapterSelect`,
  `sceneReplay`, `loading`, `locked`, `unknownEnding`, `noMemories`, `play`, `stop`,
  `endReplay`) default to English like the rest.

### Phase 5 and 6 decisions

Made while building Phases 5 and 6, without a review, where this ADR left the detail open:

- **`novel.links()` is async.** A lazy scene's directives exist only once its module is imported,
  so the server awaits the starting scene and every scene within `depth` (1 by default); the module
  stays cached for every later request. A scene that fails to load or has no module contributes no
  links, since links are a hint.
- **What is preloaded.** The starting scene's backgrounds, images and character images are
  `preload as="image"`, and its sounds `preload as="fetch" crossorigin="anonymous"`, which matches
  the player's own `fetch()`. Its music and ambience (streamed by media elements, which no preload
  matches) and its voices (one per line, too many to preload) are `prefetch`, as is every file of a
  farther scene. Each URL is listed once, at its first use; `data:` and `blob:` URLs are left out.
  A character entering without an expression lists its first sprite, the one the engine draws.
- **Localized files.** With `locale`, a map lists the exact locale's URL, then its language's, then
  the first one, the fallback the player uses; without it, every locale's URL.
- **`novel.reachable(scene, { depth, locale })`** answers each reached scene with its depth and its
  files (kind, id and URL). Reaching a scene imports its module, which is how a player prefetches
  scene modules: no separate list of loaders exists.
- **Developer tools are a connection plus a panel.** `createDevTools(novel, { restart })` listens to
  every event, follows the last play an event fired for (or one handed to `attach`), and keeps a
  log of 200 events. Every edited play reaches the app as `StartOptions` through `restart`, since
  the player owns its play; the app remounts `NovelPlayer` with them as `start`. The followed play
  is dropped on a restart until the new play fires its first event.
- **Hot reload is `devtools.reload(modules)`**, called from the app's
  `import.meta.hot.accept([...scene paths], …)`, since Vite needs the accepted paths written
  literally. It reads the followed play's save before swapping (the anchor is read from the old
  module), replaces each scene through the novel's internals, and restarts from that save only when
  the play stands in or was called from a replaced scene; a play elsewhere reaches the new module
  when it next loads the scene. It was tested without a dev server, through `reload()`.
- **Engine changes.** `novel.links()` and `novel.reachable()` are new public methods; the internals
  `check()` and `explore()` read gained `voice()` and `replace()`, and `map()` shares its binding
  with `replace()`. No event was added.
- **The jump editor validates against the state schema** before restarting, and keeps the
  followed play's persistent data. Missing messages are found statically (every line, prompt,
  label, reason and ending, then titles, names and captions) rather than by playing, so the panel
  answers without `explore()`. The panel's labels are English: it is a developer tool.
- **The flowchart uses `@sdxc/diagram/ui`**, which draws Mermaid in the browser as well: one box per
  scene grouped by chapter, a solid arrow per `goto`, a dotted one per `call`, a slanted box for a
  scene with no module and a rounded node per ending. It is drawn on request, since reading it
  imports every lazy scene; `@sdxc/diagram` became a dependency of the package.
- **Offline has two entries.** `@sdxc/novel/offline` is the page side (`registerOffline`,
  `offlineAssets`) and `@sdxc/novel/offline/worker` the worker side (`serveOffline`,
  `OfflineCache` and the policy functions), so a worker script imports none of the engine.
- **The page declares the files.** `registerOffline` posts every declared asset in every locale and
  every character sprite and layer, plus `extra` URLs (voice files, which only the `voice` function
  finds), and posts again when a new worker takes control. The worker keeps that list and each
  entry's size and last use in an index stored in its own cache, so it survives the worker being
  stopped; a new declaration deletes cached files no longer declared, such as an older build's.
- **Scene module chunks are named by the app** through `serveOffline({ modules })`, a URL rule such
  as Vite's `chunkFileNames` under `/assets/scenes/`, since neither the page nor the worker can learn
  a lazy module's URL. Without it no module is cached.
- **Hashed means a Vite build's `/assets/<name>-<8 characters>.<ext>`** by default, overridable with
  `immutable`. A miss on an unhashed file only costs a revalidation, so the rule errs toward it.
  Unhashed files are fetched with `cache: "no-cache"` and served from the cache only when the
  network fails.
- **Only a whole `200` is stored**: no opaque, failed or partial response, and no request with a
  `Range` header, which media elements send; the file is stored when it is next fetched whole.
- **Versions.** `version` is required and names the cache (`sdxc-novel:<version>`); a new worker
  calls `skipWaiting()`, deletes every other `sdxc-novel:` cache on activation and claims the open
  pages. Caches an app opens itself are never touched.
- **The budget evicts the least recently used files** after each store, never the file just
  stored; hits update an entry's last use.
- **No test registers a real service worker.** The browser project serves MSW's worker at the root
  scope and nothing under a scope a package worker could claim, so the worker's wiring is covered by
  its pure parts: the policy as unit tests and `OfflineCache` against Chromium's own Cache Storage,
  with MSW as the network.
