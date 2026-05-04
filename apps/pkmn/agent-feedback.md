# Agent Feedback

## Overall impression

The current `apps/pkmn/src` implementation is a solid headless rules engine, but it is not yet close to the hybrid ECS model described in `apps/pkmn/feedback.md`.

My read is:

- You are already doing some of the most valuable ECS-adjacent things well: static data is separate, battle-only state is separated from persistent creature state, and the battle engine emits ordered events that a UI could consume.
- The main gap is architectural shape. Right now the code is centered on mutable classes (`Battle`, `Creature`, `Inventory`, `Bestiary`) and a large orchestrator, not on entities, components, world queries, and small systems.
- So I would describe the project today as `headless OO engine with event streaming`, not `hybrid ECS` yet.

## Where the current code already aligns well with the ECS direction

### 1. Static data is clearly separated from live state

This is one of the strongest parts of the current design.

- `src/content/species.ts`
- `src/content/moves.ts`
- `src/content/items.ts`
- `src/domain/game-data.ts:32-101`

That matches the spirit of the feedback document very well: species, moves, items, and type data are authored as static content and loaded through `GameData`.

This is exactly the kind of split ECS benefits from:

- static authored content in data tables
- mutable runtime state elsewhere

### 2. Battle-only state is separated from persistent creature state

This is also a real strength.

- `src/engine/creature.ts:26-89`
- `src/engine/combatant-state.ts:5-16`
- `src/engine/battle-state.ts:13-153`

`Creature` holds persistent-ish state like species, experience, moveset, damage, PP, IV/EV, and status.

`CombatantState` layers temporary battle state on top:

- volatile flags
- temporary stat stages

That lines up closely with the distinction in `feedback.md` between permanent creature state and temporary battle state.

### 3. Events are already treated as a UI-facing contract

This is probably the most ECS-compatible part of the engine.

- `src/engine/battle.ts:100-278`
- `src/engine/battle.ts:390-464`

The battle engine yields ordered events like:

- `move-used`
- `damage-dealt`
- `status-applied`
- `stat-stage-changed`
- `creature-fainted`
- `request-turn-commands`
- `request-replacements`

That matches the feedback doc almost exactly in spirit: the UI should react to narratable events instead of peeking into internal mutation details.

### 4. The engine is already fairly headless and testable

- `src/engine/battle.ts:315-319`
- `src/engine/battle.test.ts`

The generator-based `BattleSession` is a decent headless boundary. Tests exercise behavior by driving commands and asserting on emitted events and resulting mutable state.

This gives you a good base to evolve toward an ECS-style engine without throwing everything away.

## Where the current implementation diverges from ECS

### 1. There is no world model, entity identity, or component storage

This is the biggest structural gap.

I could not find a `World`, `Entity`, `Party`, or `Player` abstraction in `src/`.

- search result: no `World`, `Entity`, `Player`, or `Party` types under `src/`

Instead, the code is built around object graphs:

- `Battle` owns `BattleState`
- `BattleState` owns sides and active slots
- active slots point to `CombatantState`
- `CombatantState` points to `Creature`

That works, but it is not ECS. In ECS terms, the system has no stable entity IDs and no component stores to query from.

Practical consequence:

- battle logic can work well in isolation
- broader game-state composition will get harder as soon as you add party management, capture flow, storage, dex, overworld effects, and the boundary between overworld state and a transient in-battle sub-world

### 2. Behavior lives mostly in classes, especially one very large orchestrator

The `Battle` class is doing the work of many systems at once.

- `src/engine/battle.ts:338-1745+`

It currently owns, among other things:

- turn ordering
- command validation
- switching
- targeting/redirection
- damage calculation
- status application orchestration
- side effects
- field effects
- hazard processing
- delayed attacks
- replacement flow
- victory resolution

That is the opposite of the ECS mental model from `feedback.md`, where rules live in smaller systems operating over state.

`Effects` helps, but only partially:

- `src/engine/effects.ts:19-1075`

It looks system-like at first, but it is still tightly coupled to the mutable battle object model and only handles a subset of responsibilities. A lot of move behavior still lives in `Battle` itself.

My impression is that `Effects` is a good step toward systemization, but `Battle` is still the god object.

### 3. The architecture is battle-centric, not game-state-centric

The feedback doc proposes a game engine that can model:

- player
- creatures
- battle
- inventory
- dex
- storage
- capture/evolution/experience flows

The current codebase covers only slices of that, and they are not composed through a shared runtime world.

- `src/engine/inventory.ts:18-88`
- `src/engine/bestiary.ts:10-61`
- `src/engine/creature.ts:43-89`
- `src/engine/battle.ts:338-1745+`

`Inventory` and `Bestiary` exist, but they are standalone mutable classes. There is no higher-level runtime that says:

- this player owns these creatures
- this inventory belongs to this player
- this battle references these participants
- capture updates ownership, party/storage, and dex together

That means the project has useful game primitives, but not yet the engine composition model described in `feedback.md`.

### 4. Commands are positional battle inputs, not world commands

Current commands are battle-session inputs like:

- `fight`
- `switch`
- `replace`
- `leave-battle`

References:

- `src/engine/battle.ts:60-99`

These are fine for a battle loop, but they are not yet the kind of engine-level commands described in the feedback file, such as:

- choose move
- use item
- switch creature
- attempt escape
- move creature between party and storage
- apply capture result

Also, targeting is based on battle positions and team indexes instead of stable entity IDs. That makes the current API good for a local battle session, but weaker for replay, persistence, cross-system coordination, and generalized selectors.

### 5. Object identity is doing work that ECS would normally assign to IDs

Examples:

- `DelayedAttackState.user` stores `CombatantState` directly in `src/engine/battle.ts:45-52`
- active slots store direct references to `CombatantState` in `src/engine/battle.ts:280-303`
- `CombatantState` wraps a `Creature` instance in `src/engine/combatant-state.ts:6-16`

This is convenient in memory, but it makes the model more implicit than an ECS world.

In a hybrid ECS model, these would usually be stable references like:

- `battleId` or an equivalent transient battle token
- `creatureId`
- `playerId` or a single fixed player root

Practical consequence:

- serialization and runtime inspection become more bespoke
- debugging/replay is harder because identity is partly pointer-based
- systems cannot easily query by component shape because state is navigated by object references

### 6. Domain and engine layers are not fully cleanly separated

There is a notable dependency inversion issue here:

- `src/domain/item.ts:1` imports `State` from `../engine/creature`

Static/domain definitions should not need to know about engine runtime classes or engine-layer enums.

This is small in scope right now, but it is exactly the kind of coupling that becomes painful when you try to build a broader ECS world with reusable domain schemas and multiple systems.

### 7. The engine mutates state in place instead of dispatching through a world transition boundary

Current style:

- mutate `battle.state`
- mutate `combatant.volatile`
- mutate `combatant.creature.status`
- emit events while mutating

Examples:

- `src/engine/effects.ts:515-527`
- `src/engine/battle.ts:156-1735+`

This is not inherently wrong, but it differs from the `dispatch(command) -> { world, events }` direction in the feedback file.

The current generator API is great for sequencing, but there is no single world transition contract yet.

That will matter if you want:

- deterministic replay
- generalized selectors
- tools that inspect world state independently from battle internals

## My opinion on how close you are

If I score the current code against the target in `feedback.md`:

- `static data separation`: strong
- `battle-only vs persistent state split`: good
- `event-driven battle narration`: strong
- `headless engine boundary`: good
- `entity/component/system architecture`: weak
- `shared world model across all game state`: missing
- `command/event/selectors as a unified engine API`: partial

So overall I would say:

- you are maybe `30%` of the way to the proposed hybrid ECS shape
- but you already have some of the hardest design instincts in place

The good news is that the missing 70% is mostly architectural composition, not “the rules are wrong.”

## What I would do next

I would not do a big-bang ECS rewrite.

I would evolve the current design in this order.

### 1. Introduce stable IDs and a minimal `World`

Before rewriting behavior, give the runtime a stable shape.

At minimum:

- `playerId` or one implicit player root
- `creatureId`
- an optional transient battle handle

And one serializable world object that owns:

- creatures
- player state
- inventory
- bestiary/dex

Then model battle as a transient sub-world or runtime session layered on top of that game world, not as a fully general persisted world of its own.

Given your constraints:

- there is only one player
- there can only be one active battle at a time
- you cannot save in the middle of a battle

I do not think you need a generalized multi-player or persistable battle-world model. I still think you want stable creature identity and a clean game-world boundary, but the battle can stay ephemeral.

This is the single biggest step toward the architecture described in `feedback.md`.

### 2. Keep static data exactly as it is

`content/` plus `GameData` is already the right direction.

I would keep this model and make it the static-data half of a hybrid ECS.

### 3. Replace wrapper classes with component-shaped state gradually

The first migration target should not be battle rules. It should be runtime state representation.

For example:

- `Creature` becomes serializable creature components keyed by `creatureId`
- `Inventory` becomes inventory data attached to the player root
- `Bestiary` becomes dex data attached to the player root

Even if you temporarily keep helper functions, getting to component-shaped state will unlock the rest.

### 4. Split `Battle` into systems without changing behavior first

`Battle` is the biggest pressure point.

I would eventually separate it into concerns like:

- turn-order system
- move-resolution system
- damage system
- status system
- switch/replacement system
- end-of-turn system
- victory system

`Effects` already hints at this direction. I would treat it as a starting seam, not the final shape.

### 5. Move from positional battle APIs toward entity-oriented commands

Current battle commands are good session inputs, but the long-term engine should center commands on IDs and intent.

For example, the engine-level command should look more like:

- choose move for creature X in battle Y
- switch creature X with creature Z in battle Y
- use item X from player Y on target Z

That will make battle only one consumer of the same world model.

### 6. Add selectors once the world exists

The feedback file is right that selectors matter.

Right now callers mostly inspect mutable battle internals directly in tests, for example through `battle.state...` in `src/engine/battle.test.ts`.

That is fine for now, but once a world exists I would add selectors for:

- battle view
- creature summary
- party view
- inventory view
- dex view

That will keep UI concerns out of the rule systems.

### 7. Fix layering before the codebase grows more systems

The `domain -> engine` dependency in `src/domain/item.ts:1` is a warning sign.

Before adding capture, evolution, storage, and overworld systems, I would make sure:

- domain schemas do not depend on engine classes
- runtime state types are defined in a neutral game-state layer
- battle-specific runtime types stay battle-specific

## What I would not do

I would not chase “pure ECS” for everything.

The feedback doc is right to recommend a hybrid approach. For this project, I would avoid:

- turning every item stack into an entity
- turning every authored move/species/item into mutable runtime entities
- replacing all ergonomics with abstract ECS machinery too early

The strongest path here is:

- keep the current strong data authoring model
- keep the event contract
- add a proper world and IDs
- progressively split the large battle object into systems

## Bottom line

My honest take is:

- the current implementation is good engine code
- it already has several ECS-friendly instincts
- but it is still structurally object-oriented, not ECS-shaped

If the goal is to follow the architecture in `feedback.md`, the biggest missing pieces are not battle mechanics. They are:

- world ownership
- entity identity
- componentized runtime state
- smaller systems instead of a dominant `Battle` class

So I would not say “you are doing ECS badly.”

I would say:

- you are building a strong battle-first engine
- you have the right static-data and event ideas already
- the next milestone is to turn this from a set of battle-centric runtime classes into a shared game-state model with IDs, components, and system boundaries
