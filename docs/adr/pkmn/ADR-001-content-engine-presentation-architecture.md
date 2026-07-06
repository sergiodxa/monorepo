# ADR-001: Content, Engine, and Presentation Architecture

## Status

**Accepted** - 2026-07-06

Content and engine are largely implemented; the Part 3 presentation layer is now implemented as a playable canvas client in `src/presentation/` (with procedural placeholder graphics in place of real art/audio). The Phase 1 engine loop (write-back, capture, item use, encounters, escape, experience) is still open. See Current Progress.

## Background

The `apps/pkmn` app is a Pokemon-like game built as three strictly separated layers: **content** (the data that makes it a Pokemon game), **engine** (the franchise-agnostic rules), and **presentation** (rendering and input). The long-term goal is to open source the engine so anyone can build their own monster-collecting game by authoring content and writing a presentation layer, without touching the rules.

This ADR is the single, self-contained specification for the whole game. A developer or an AI agent should be able to build the entire app from this document alone: the content schemas, the engine architecture and mechanics, and the canvas-based presentation layer. Where the codebase already implements a section, the ADR documents what exists; where it does not, the ADR is the build plan. Items that are specified but not yet built are marked **(planned)**.

## Context

### Current State

| Layer        | Location            | Status                                                                                                                                          |
| ------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Content      | `src/content/`      | 151 Gen 1 species, 429 moves, 331 items, natures, type chart                                                                                    |
| Engine       | `src/game/`         | Hybrid ECS world, command/event/selector boundary, playable battle core                                                                         |
| Presentation | `src/presentation/` | Canvas client per Part 3: GameClient/loop/input/assets/audio, overworld, event-driven battle, menus — procedural placeholder art, no assets yet |

Supporting material: `docs/battle.md` and `docs/breeding.md` hold long-form mechanic specs, `TODO.md` tracks parity gaps, `AGENTS.md` holds coding conventions. This ADR supersedes none of them but is complete without them.

### Constraints

- TypeScript everywhere, run with Bun; the game itself targets the browser.
- No game framework or rendering library; the platform APIs (`<canvas>`, Web Audio, Gamepad) are enough.
- The engine layer MUST NOT contain franchise vocabulary or franchise-specific rules; `src/content/` is the only layer allowed to mention Pokemon terms.
- Feature target is Generation III parity, with newer mechanics backported when they are cheap to support (data can always opt out of them).
- Simplicity is a feature: plain data contracts, small systems, explicit state. The engine is meant to be read, understood, and extended by strangers.

### Vocabulary

The engine speaks generic terms. Content maps franchise concepts onto them:

| Franchise term  | Engine term                 |
| --------------- | --------------------------- |
| Pokemon         | creature                    |
| Species/Dex No. | species                     |
| Pokedex         | bestiary                    |
| Pokeball        | capture item                |
| PC / Box        | storage box                 |
| Trainer         | player                      |
| Ability         | passive trait **(planned)** |
| TM/HM           | teachable move item         |
| Battle UI       | presentation layer          |

"Presentation" is the deliberate term for the third layer (rather than "UI"): it is the game-industry name for the rendering/input half of a simulation/presentation split, and it matches the scene/window/sprite vocabulary this design borrows from RPG Maker XP.

## Decision

Build the game as three layers with a strict dependency direction:

```
content  ──implements──▶  engine data contracts
presentation  ──calls──▶  engine boundary (dispatch / select / events)
engine  ──imports──▶  nothing outside src/game/
```

- The engine never imports from `src/content/` or `src/ui/`.
- Content implements the engine's data contracts and is validated at load time.
- The presentation layer reads engine state only through selectors, changes it only through commands, and animates from ordered events. It never reaches into world internals.

---

## Part 1: Content

### 1.1 Layer rules

`src/content/` is authored TypeScript data. It is the only layer allowed to use franchise names ("BULBASAUR", "POTION"). Everything it exports must satisfy the engine's data contracts from `src/game/data/`. Content is pure data plus small authoring helpers — no game logic. If authoring a mechanic requires logic, the mechanic belongs in the engine as data-driven behavior, and the content only declares it.

Content modules and what they export:

| Module                    | Export          | Contract                       |
| ------------------------- | --------------- | ------------------------------ |
| `src/content/species.ts`  | `SPECIES`       | `Record<string, Species>`      |
| `src/content/moves.ts`    | `MOVES`         | `Record<string, Move>`         |
| `src/content/items.ts`    | `ITEMS`         | `Record<string, Item>`         |
| `src/content/natures.ts`  | `NATURES`       | `Record<string, Nature>`       |
| `src/content/matchups.ts` | `TYPE_MATCHUPS` | `Matchup<string>` (type chart) |

### 1.2 Identifier conventions

- Content ids are `UPPER_SNAKE_CASE` strings: `"BULBASAUR"`, `"RAZOR_LEAF"`, `"POTION"`, `"HARDY"`, `"NIDORAN_F"`.
- Ids double as display names until a game supplies its own naming/localization in the presentation layer. An optional `name` field on data records is a future content concern, not an engine one.
- Type ids are lowercase strings (`"fire"`, `"water"`); the engine ships a canonical 18-type enum but the data contracts accept any string type ids as long as the type chart covers them.

### 1.3 Species contract

```typescript
interface Species {
	number: number; // ordering/dex number
	size: { weight: number; height: number }; // kg, meters
	types: [string] | [string, string];
	baseExperience: number; // experience award base on faint
	catchRate: number; // 1..255, used by the capture formula
	growthRate: GrowthRate; // experience curve, see 2.10
	stats: StatSet; // base stats: hp/attack/defense/special-attack/special-defense/speed
	evYield: Partial<StatSet>; // EVs awarded on faint (planned field)
	evolutions: Evolution[];
	learnset: LearnsetEntry[];
	gender: Genderless | { male?: number; female?: number }; // percentage ratios
	eggGroup: [EggGroup] | [EggGroup, EggGroup];
}

type LearnsetEntry =
	| { level: number; moveId: string } // learned on reaching level
	| { tmhm: number } // teachable by machine item (item carries the moveId)
	| { tutor: true; moveId: string }
	| { egg: true; moveId: string };

enum EvolutionMethod {
	Level = "level",
	Item = "item",
	Trade = "trade",
	Friendship = "friendship",
	Place = "place",
} // string-valued enum (values are serialized into content data)

type Evolution =
	| { method: Level; speciesId: string; level: number }
	| { method: Item; speciesId: string; itemId: string }
	| { method: Trade; speciesId: string; heldItemId?: string } // heldItemId (planned)
	| { method: Friendship; speciesId: string; level: number } // level is unused by the friendship trigger; its removal is planned
	| { method: Place; speciesId: string; placeId: number };
```

Egg groups and gender ratios exist for the breeding system (Gen 3 target; spec in `docs/breeding.md`, summarized in 2.9.8).

### 1.4 Move contract

```typescript
interface Move {
	type: string; // must exist in the type chart
	damageClass: "physical" | "special" | "status";
	power: number; // 0 for status/fixed-damage moves
	accuracy: number; // percentage; 0 means "bypasses the accuracy check"
	pp: number;
	criticalHitStages?: number; // extra crit stages (high-crit moves)
	effect: MoveEffect; // "none" | "compound" | one of the kinds below
}
```

`MoveEffect` is a discriminated union interpreted by the battle engine. `compound` nests a list of effects; every other kind is one behavior. The full set:

```typescript
type MoveEffect =
	| { kind: "none" }
	| { kind: "compound"; effects: MoveEffect[] }
	// ordering / classification
	| { kind: "priority"; value: number }
	// volatile conditions
	| { kind: "confuse"; turns: number }
	| { kind: "flinch"; chance: number } // 0..1
	| { kind: "taunt"; turns: number }
	| { kind: "encore"; turns: number }
	| { kind: "disable"; turns: number; slot: 0 | 1 | 2 | 3 }
	| { kind: "identify" } // negates ghost-style immunity
	| { kind: "attract" }
	| { kind: "trap" } // prevents switching
	| { kind: "partial-trap"; turns: number } // trap + residual damage
	| { kind: "leech-seed" }
	| { kind: "protect" }
	| { kind: "endure" }
	| { kind: "destiny-bond" }
	| { kind: "focus-energy" }
	| { kind: "aqua-ring" }
	| { kind: "charged-electric" } // doubles next electric attack
	| { kind: "curse" } // ghost/non-ghost split behavior
	| { kind: "follow-me" } // redirects single-target moves
	// statuses
	| {
			kind: "apply-status";
			status: "burn" | "paralysis" | "poison" | "sleep" | "freeze";
			chance: number;
			poisonVariant?: "regular" | "escalating";
	  }
	// stat stages
	| { kind: "modify-stat"; stat: BattleStatStage; stages: number; target: "self" | "target" }
	| { kind: "reset-stat-stages"; target: "self" | "target" | "all-active" }
	| { kind: "boost-on-ko"; stat: BattleStatStage; stages: number }
	// side effects (one side of the field)
	| {
			kind: "side-effect";
			effect: "reflect" | "light-screen" | "tailwind" | "safeguard" | "mist" | "lucky-chant";
			turns: number;
			target: "self" | "target";
	  }
	| {
			kind: "side-effect";
			effect: "spikes" | "toxic-spikes";
			layers: number;
			target: "self" | "target";
	  }
	| { kind: "side-effect"; effect: "stealth-rock" | "sticky-web"; target: "self" | "target" }
	| { kind: "clear-side-effects"; target: "self" | "target" | "both"; effects: SideEffectType[] }
	// field effects (whole battlefield)
	| {
			kind: "field-effect";
			effect:
				| "trick-room"
				| "wonder-room"
				| "magic-room"
				| "gravity"
				| "sun"
				| "rain"
				| "sand"
				| "hail"
				| "snow"
				| "fog"
				| "electric-terrain"
				| "grassy-terrain"
				| "misty-terrain"
				| "psychic-terrain";
			turns: number;
	  }
	// damage pipeline modifiers
	| { kind: "multi-hit"; hits: number | [number, number] }
	| { kind: "ohko" }
	| { kind: "fixed-damage"; value: number }
	| { kind: "fixed-damage-user-hp" } // damage equal to user's remaining HP
	| { kind: "fixed-damage-target-hp-gap" } // target HP - user HP (fails if not lower)
	| { kind: "counter-last-physical-hit" } // 2x last physical damage taken this turn
	| { kind: "recoil"; ratio: number } // fraction of damage dealt
	| { kind: "drain"; ratio: number; requiresSleepingTarget?: boolean }
	| { kind: "crash-on-miss"; ratio: number } // fraction of user max HP
	| { kind: "self-destruct" }
	| { kind: "cannot-ko" } // leaves target at >= 1 HP
	| { kind: "double-power-on-damaged-target" } // target at or below half HP
	| { kind: "double-power-if-target-damaged-this-turn" }
	| { kind: "double-power-on-status-target" }
	| { kind: "power-from-target-speed" }
	| { kind: "power-from-user-speed" }
	| { kind: "power-from-user-hp" }
	| { kind: "power-from-weight" }
	// flow control
	| { kind: "charge"; invulnerable?: boolean } // two-turn moves
	| { kind: "recharge" } // skip next action
	| { kind: "rampage"; turns: number } // locked move, confusion after
	| { kind: "delayed-attack"; turns: number } // future-sight style
	| { kind: "first-turn-only" }
	| { kind: "fail-if-user-damaged-this-turn" }
	| { kind: "break-protect" }
	| { kind: "belly-drum" } // pay half max HP, attack to +6
	| { kind: "healing-wish" } // self-KO, heal next switch-in
	| { kind: "switch-self"; preserveStatStages?: boolean }
	| { kind: "force-switch-target" };
```

Authoring rule: a move that only deals damage uses `{ kind: "none" }`. A move with several behaviors uses `compound`. Every OHKO, fixed-damage, or variable-power move must carry its effect kind — `power: 0` with `kind: "none"` deals no damage.

### 1.5 Item contract

```typescript
interface Price {
	buy: number;
	sell: number;
}

enum ItemAttribute {
	Countable,
	Consumable,
	UsableOverworld,
	UsableInBattle,
	Holdable,
	HoldablePassive,
	HoldableActive,
	Underground,
}

type Item = Base & (Capture | Medicine | BattleItem | TeachesMove | Misc);

interface Base {
	category: ItemCategory; // engine enum today; planned: widen to a content-defined string for bag pockets
	attributes: [ItemAttribute, ...ItemAttribute[]];
	price?: Price; // absent means "cannot be bought/sold"
}

interface Capture {
	effect: { multiplier: number; notes?: string };
} // ball bonus for the capture formula
interface Medicine {
	effect: MedicineEffect;
}
interface BattleItem {
	effect: BattleItemEffect;
}
interface TeachesMove {
	teachesMoveId: string;
} // machines and tutors

type MedicineEffect =
	| { kind: "heal-hp"; amount: number | "full" }
	| { kind: "cure-status"; status: State[] | "any" }
	| { kind: "heal-hp-and-cure-status"; amount: number | "full"; status: State[] | "any" }
	| { kind: "revive"; amount: "half" | "full" }
	| { kind: "restore-pp"; amount: number | "full"; target: "one-move" | "all-moves" }
	| { kind: "pp-boost"; amount: 1 | "max" }
	| { kind: "raise-ev"; stat: Stat; amount: number };

type BattleItemEffect =
	| { kind: "stat-stage"; stat: BattleStatStage; stages: number }
	| { kind: "critical-rate"; stages: number }
	| { kind: "mist" };
```

Behavior is derived from `attributes` (is it usable in battle, holdable, consumable) plus the effect payload. The engine routes item use by payload kind (see 2.9.6). Held-item passive effects are declared with the trait/held-item hook data model once that exists (see 2.12).

### 1.6 Natures, growth rates, type chart

```typescript
interface Nature {
	increases: Stat | null;
	decreases: Stat | null;
} // null/null = neutral

enum GrowthRate {
	Erratic /* planned */,
	Fast,
	MediumFast,
	MediumSlow,
	Slow,
	Fluctuating,
}

type Matchup<T extends string> = { [attacking in T]: { [defending in T]?: Effectiveness } };
enum Effectiveness {
	ZERO = 0,
	QUARTER = 0.25,
	WEAK = 0.5,
	NORMAL = 1,
	SUPER = 2,
	HYPER = 4,
}
```

The type chart is data: `TYPE_MATCHUPS[attackingType][defendingType]` returns a multiplier; missing entries mean neutral. Dual-type effectiveness is the product of both matchups.

### 1.7 Validation at load

`GameData.create(source)` (in `src/game/data/game-data.ts`) indexes the content into `ReadonlyMap`s and validates cross-references, returning a `Result` (from `@pkg/result`) instead of throwing:

- every `evolution.speciesId` exists in species
- every item-based evolution references an existing item
- every learnset `moveId` exists in moves
- every `teachesMoveId` exists in moves
- **(planned)** every species/move type id exists in the type chart, and every creature `natureId`/`moveId` referenced by a save resolves

The engine constructs `GameData` once at boot and treats it as immutable for the session.

### 1.8 Authoring workflow

- `bun run download:pokeapi` refreshes a local snapshot of the PokeAPI v2 dataset into `json/pokeapi-v2/` (checked-in JSON, no runtime network use). It is an authoring aid for transcribing data, not a runtime dependency.
- Content files use small helpers (`createSpecies`, `createStats`, `levelEvolution`, gender-distribution constants) to keep records readable. Helpers normalize defaults (catch rate, base experience, egg groups) so authored entries stay minimal.

### 1.9 Completeness checklist for a shippable game

A game built on this engine needs, at minimum:

- [ ] Species with stats, types, growth rates, catch rates, learnsets, evolutions, EV yields
- [ ] Moves with modeled effects (a move without its effect kind silently does nothing special)
- [ ] Items covering capture, healing, PP, revive, evolution, and machines
- [ ] Natures (the classic set is 25: 5 neutral plus every increase/decrease pair)
- [ ] A complete type chart over the game's type set
- [ ] Presentation-side content: sprites, tilesets, maps, encounter tables, audio (Part 3; the engine does not validate these)

---

## Part 2: Engine

### 2.1 Architectural style

The engine (`src/game/`) is a **hybrid ECS with a command/event boundary**:

- **Entities** are stable string ids. **Components** are plain serializable records in per-component stores. **Systems** are small modules of functions that mutate the world.
- Authored content stays in immutable data tables (`GameData`) — species are not entities.
- The outside world interacts only through the `Engine` class: `dispatch(command): GameEvent[]` to change state, `select(selector): Selection` to read derived views, `snapshot()` to save.
- Battles run as a resumable generator session that yields ordered, narratable events and suspends when it needs player input. The event stream is the presentation contract.

This is deliberately not "pure" ECS: there are no archetype queries or per-frame system schedulers. Stores are plain objects, systems are functions, and the battle is an orchestrated turn resolver. The ECS part that matters is stable identity plus component-shaped serializable state.

### 2.2 Entities and ids

```typescript
type EntityId = string; // "<kind>:<key>"
type EntityKind =
	| "player"
	| "creature"
	| "battle"
	| "battle-side"
	| "battle-member"
	| "encounter"
	| "world";

createEntityId("creature", "starter-1"); // "creature:starter-1"
parseEntityId("player:hero"); // { kind: "player", key: "hero", id }
```

Aliases `PlayerId`, `CreatureId`, `BattleId` (all `EntityId`) with factories `createPlayerId/createCreatureId/createBattleId`. Every id present in any store is registered once in `world.entities`.

### 2.3 World shape

```typescript
type ComponentStore<T> = Partial<Record<EntityId, T>>;

interface World {
	entities: EntityId[];
	playerId: PlayerId; // single player root per save
	// player-rooted persistent components
	playerProfile: ComponentStore<{ name: string }>;
	party: ComponentStore<{ creatureIds: CreatureId[] }>; // ordered, max 6
	inventory: ComponentStore<{ items: Partial<Record<ItemId, number>> }>;
	bestiary: ComponentStore<{ seen: SpeciesId[]; caught: SpeciesId[] }>;
	storageBoxes: ComponentStore<{
		boxes: Array<{ id: string; name: string; creatureIds: CreatureId[] }>;
	}>;
	// creature persistent components (one entry per creature entity)
	creatureIdentity: ComponentStore<{
		speciesId: SpeciesId;
		nickname?: string;
		gender?: "male" | "female" | "genderless"; /* planned */
	}>;
	creatureProgress: ComponentStore<{
		natureId: NatureId;
		experience: number;
		iv: StatSet;
		ev: StatSet;
		friendship?: number /* planned */;
		size?: Creature.SizeData;
	}>;
	creatureMoves: ComponentStore<{
		moveset: [MoveId, MoveId | null, MoveId | null, MoveId | null];
		pp: [number, number, number, number];
	}>;
	creatureHealth: ComponentStore<{ damage: number }>; // damage taken, not remaining HP
	creatureStatus: ComponentStore<{ state: State | null; poison?: "regular" | "escalating" }>;
	creatureHeldItem: ComponentStore<{ itemId: ItemId }>; // (planned)
	ownership: ComponentStore<{ ownerId: PlayerId }>;
	creatureLocation: ComponentStore<CreatureLocation>;
	// transient battle mirrors (rebuilt at runtime, never saved)
	activeBattle: ComponentStore<{ battleId: BattleId }>;
	battleParticipants: ComponentStore<{
		playerId: PlayerId;
		enemyId: PlayerId;
		playerParty: CreatureId[];
		enemyParty: CreatureId[];
	}>;
	battlePhase: ComponentStore<{
		turn: number;
		phase: BattlePhase;
		winnerSide: number | null;
		slots: 1 | 2 | 3;
	}>;
	battleField: ComponentStore<FieldEffectState>;
	battleSide: ComponentStore<BattleSideComponent>; // keyed by "battle-side:<battleId>:<index>"
	battlePendingTurn: ComponentStore<{ requests: BattlePosition[] }>;
	battlePendingReplacement: ComponentStore<{ requests: ReplacementSelection[] }>;
	battleLog: ComponentStore<{ events: BattleEvent[] }>;
	battleMember: ComponentStore<BattleMemberComponent>; // per-combatant mirror for selectors
}

type CreatureLocation =
	| { kind: "party"; playerId: PlayerId; slot: number }
	| { kind: "storage"; playerId: PlayerId; boxId: string; slot: number }
	| { kind: "encounter"; encounterId: string }
	| { kind: "battle"; battleId: BattleId; side: number; slot: number };
```

Notes on the model:

- **HP is stored as damage taken.** Max HP is derived from stats, so healing to full is `damage = 0` and a stat recalculation (level up) never desyncs current HP.
- Creature state is split into identity/progress/moves/health/status so systems touch only what they own and saves stay diffable.
- The `Creature` class in `src/game/world/creature.ts` is a thin read-model aggregate built from those components for the battle runtime; it is not the storage format.

### 2.4 Persistence

- `PERSISTENT_WORLD_STORE_KEYS` lists the save-backed stores (player-rooted and creature stores plus ownership and location). `TRANSIENT_WORLD_STORE_KEYS` lists battle mirrors and `activeBattle`.
- `Engine.snapshot()` returns a deep-cloned world containing only persistent stores. This document names that return shape `PersistentWorld`; today it is the inferred return type of `pickPersistentWorld` (no exported type alias yet — naming/exporting it is a trivial planned cleanup). **(planned)** the `entities` array in a snapshot is filtered to ids that still own a persistent component, so transient `battle:*` ids never leak into saves.
- `migrateWorld(input)` upgrades any older or bootstrap payload into the current shape: it accepts a legacy `creature` blob store, splits it into the component stores, infers `ownership` and `creatureLocation` from party/box membership, and initializes empty transient stores. All world loading goes through it; there is no in-place save versioning.
- Saving mid-battle is unsupported by design: battles are ephemeral. The presentation layer only offers saving outside battle.

### 2.5 Engine boundary

```typescript
class Engine {
	static create(options: { content: GameDataSource; world: World }): Engine;
	dispatch(command: Command): GameEvent[];
	select(selector: Selector): Selection;
	snapshot(): PersistentWorld;
	// typed selector conveniences: selectPlayer, selectParty, selectInventory,
	// selectBestiary, selectStorage, selectCreatureSummary, selectActiveBattle, selectBattle
}
```

`create` validates content (throwing on invalid cross-references) and migrates the given world. The engine owns its world exclusively — callers keep no references into it. **(planned)** `Engine.Options.random?: () => number` threads a seedable RNG into battles so whole sessions are reproducible.

### 2.6 Commands

Implemented commands (`src/game/commands.ts`):

| Command                      | Payload                                                            | Effect                               |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| `start-battle`               | `battleId, playerId, enemyId, playerParty[], enemyParty[], slots?` | Creates the transient battle session |
| `submit-battle-turn`         | `battleId, commands: TurnCommand[]`                                | Advances one turn                    |
| `submit-battle-replacements` | `battleId, commands: ReplacementCommand[]`                         | Fills empty slots                    |
| `add-inventory-item`         | `playerId, itemId, count`                                          | Adds stack count                     |
| `remove-inventory-item`      | `playerId, itemId, count`                                          | Removes when available               |
| `mark-species-seen`          | `playerId, speciesId`                                              | Bestiary progress                    |
| `mark-species-caught`        | `playerId, speciesId`                                              | Bestiary progress (implies seen)     |
| `store-creature`             | `playerId, creatureId, boxId`                                      | Party to box                         |
| `withdraw-creature`          | `playerId, creatureId, boxId`                                      | Box to party                         |
| `capture-creature`           | `playerId, creatureId`                                             | Encounter creature becomes owned     |
| `grant-creature-experience`  | `creatureId, experience`                                           | Adds experience, reports level delta |
| `evolve-creature`            | `creatureId, speciesId`                                            | Swaps species identity               |

**(planned)** commands required to close the game loop; an implementer should add these shapes:

```typescript
| { type: "spawn-encounter"; encounterId: string; speciesId: SpeciesId; level: number;
    natureId?: NatureId; iv?: Partial<StatSet>; moveIds?: MoveId[] }
  // creates a creature entity at an encounter location, rolling nature/IVs/gender/moves
  // (last 4 learnset moves at that level) for anything omitted

| { type: "use-item"; playerId: PlayerId; itemId: ItemId;
    targetCreatureId?: CreatureId; moveSlot?: 0|1|2|3; battleId?: BattleId }
  // validates possession, routes by item payload kind (medicine/capture/battle/teaches-move),
  // consumes the item when the attributes say Consumable, emits the outcome events

| { type: "learn-move"; creatureId: CreatureId; moveId: MoveId; slot: 0|1|2|3 }
  // validates the species learnset allows the move, writes moveset+pp for that slot

| { type: "heal-party"; playerId: PlayerId }
  // creature-center behavior: damage 0, status null, full PP for the party
```

`capture-creature` remains the state transition (ownership + placement + bestiary); the capture _attempt_ (formula, shakes) is part of `use-item` with a capture item during battle (see 2.9.4).

### 2.7 Events

`dispatch` returns ordered `GameEvent`s describing what happened:

```typescript
type GameEvent =
	| { type: "battle-started"; battleId }
	| { type: "battle-events-appended"; battleId; events: BattleEvent[] } // ordered battle narration
	| { type: "battle-input-requested"; battleId; request: "turn" | "replacement" }
	| { type: "battle-finished"; battleId; winnerSide: number | null } // null = draw
	| { type: "inventory-updated"; itemId; count }
	| { type: "bestiary-updated"; speciesId; status: "seen" | "caught" }
	| { type: "creature-placement-changed"; creatureId; placement: "party" | "storage"; boxId? }
	| { type: "creature-captured"; creatureId; placement; boxId? }
	| { type: "creature-experience-granted"; creatureId; levelBefore; levelAfter; totalExperience }
	| { type: "creature-evolved"; creatureId; speciesId };
```

**(planned)** additions: `item-used`, `capture-attempted { shakes: 0..3; success: boolean }`, `move-learned`, `creature-can-learn { creatureId; moveId; slots: (0|1|2|3)[] }` (emitted when a level-up move needs a slot choice), `party-healed`, `encounter-spawned`, and `creature-can-evolve { creatureId; choices: SpeciesId[] }` (emitted after level-ups so the presentation can offer evolution).

### 2.8 Selectors and views

Selectors return derived read models so the presentation never assembles component data:

| Selector           | View                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `player`           | name plus nested party/inventory/bestiary/storage views, activeBattleId                     |
| `party`            | ordered `CreatureSummaryView[]`                                                             |
| `inventory`        | entries `{ id, name, category, count }`                                                     |
| `bestiary`         | entries `{ speciesId, name, seen, caught }`                                                 |
| `storage`          | boxes with `CreatureSummaryView[]`                                                          |
| `creature-summary` | `{ id, name, speciesId, level, maxHP, currentHP, status, moves[], location }`               |
| `active-battle`    | `BattleView` for the player's current battle or `null`                                      |
| `battle`           | `BattleView { id, turn, phase, winnerSide, pendingRequest, allies[], enemies[], events[] }` |

During a battle, creature summaries inside `BattleView` prefer the transient `battleMember` mirrors (live damage/status) over persistent components. Selectors are pure reads: no mutation, no caching.

### 2.9 World systems

Each system is a module of plain functions over `(world, ...)` in `src/game/systems/`.

#### 2.9.1 Inventory

Stack counts per item id on the player. `addInventoryItem` and `removeInventoryItem` enforce non-negative counts and delete empty stacks. No capacity limits.

#### 2.9.2 Storage

`moveCreatureToStorage` / `moveCreatureToParty` / `ensureStorageBox` keep `party`, `storageBoxes`, and every affected `creatureLocation` in sync (slots are reindexed after every move). Invariants: party holds 1..6 creatures — depositing the last party member is rejected **(planned enforcement)**; a box must exist before deposit; ownership is verified **(planned enforcement)**. Box capacity is a game choice; the engine defaults to unlimited.

#### 2.9.3 Bestiary

`markSpeciesSeen` / `markSpeciesCaught`; caught implies seen; both idempotent. Bestiary updates are also triggered by battle start (opponents seen), successful capture, and evolution (new species counts as seen and caught) — wiring for those triggers is **(planned)** alongside battle write-back.

#### 2.9.4 Capture **(formula planned)**

The state transition exists (`captureCreature`: set ownership, place into party or, when the party is full, the first storage box, set location). It does **not** yet mark the bestiary — that is one of the **(planned)** bestiary triggers (2.9.3), wired as part of the battle write-back (2.11.11). The Gen 3 capture attempt formula to implement in front of it:

```
a = floor((3*maxHP - 2*currentHP) * catchRate * ballMultiplier / (3*maxHP)) * statusBonus
statusBonus: sleep/freeze = 2, paralysis/poison/burn = 1.5, none = 1
if a >= 255: caught
else:
  b = floor(1048560 / floor(sqrt(floor(sqrt(floor(16711680 / a))))))
  perform 4 shake checks: random integer in [0, 65535] < b
  caught only if all 4 pass; report the number of successful shakes (0..3) on failure
```

Only encounter-located creatures in an active wild battle can be captured; capturing ends the battle.

#### 2.9.5 Experience and level-ups

`grantCreatureExperience` adds experience (clamped to non-negative; the level-100 total-for-the-growth-rate cap is a **(planned clamp)**) and reports `levelBefore`/`levelAfter` and the new `totalExperience`. **(planned)** on faint in battle, award to each non-fainted participant:

```
exp = floor(baseExperience * faintedLevel / 7 / participants) * battleModifier   // 1.5 for player-vs-player battles, 1.0 for wild
```

and add the species `evYield` to each participant's EVs, capped at 255 per stat and 510 total. **(planned)** after a level-up, check the learnset for moves at the new level (emit a learn opportunity; auto-learn into a free slot, otherwise ask via `creature-can-learn` event) and check evolution eligibility (2.9.7).

#### 2.9.6 Item use **(planned)**

`use-item` routes by payload: medicine effects mutate health/status/PP/EV components (revive only on fainted targets, others only on non-fainted); capture items are only legal during a wild battle and run 2.9.4; battle items apply their stat-stage/crit effect to the active combatant; `teachesMoveId` items forward to `learn-move`. Consumable attribute controls whether the stack decrements.

#### 2.9.7 Evolution

`evolveCreature` swaps `creatureIdentity.speciesId` (nickname preserved; stats derive automatically). **(planned)** `getEligibleEvolutions(gameData, world, creatureId, trigger)` evaluates the species' evolution rules: `Level` (level >= threshold after a level-up), `Item` (matching evolution item used), `Trade` (trade event, optional held item), `Friendship` (friendship >= 220 after a level-up), `Place` (level-up while the presentation reports the matching placeId). The engine emits eligibility; the presentation runs the evolution scene and confirms with `evolve-creature` (allowing cancellation).

#### 2.9.8 Breeding **(planned)**

Two creatures of compatible egg groups and opposite genders (or one plus a member of the **universal breeding group** — the content-defined egg group that pairs with anything) can produce an egg. The offspring derives from the **family source parent** — the female, or the non-universal-group parent when breeding with a universal-group member (not simply "the mother"): species = that parent's breedable base species, subject to family-specific overrides (incense/split families); inherited moves = the offspring's level-1 moves plus any egg-tagged moves currently known by **either** parent plus special-family moves, deduped and trimmed to 4; IVs = 3 stats inherited from the parents at random by default (5 with a Destiny-Knot-style held item), the rest rolled; nature = random, or the nature of an everstone-style item's holder (either parent). Eggs are creature entities with a `hatchCounter` progress field that decrements per overworld step-cycle. Full spec in `docs/breeding.md`; this summary is the contract.

### 2.10 Creature math

**Stats** (Gen 3 formula; all divisions floored):

```
HP    = floor((2*base + iv + floor(ev/4)) * level / 100) + level + 10
other = floor((floor((2*base + iv + floor(ev/4)) * level / 100) + 5) * natureMod)
natureMod: 1.1 if nature increases the stat, 0.9 if it decreases it, else 1.0
```

IVs are 0..31 (rolled at creature creation), EVs 0..255 per stat / 510 total. Level is derived from total experience by scanning the growth curve down from the cap (`LEVEL_CAP = 100`).

**Experience curves** (total experience to be level n; floored):

| Growth rate           | Formula                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Erratic **(planned)** | n<=50: `n^3*(100-n)/50` ; 50<n<=68: `n^3*(150-n)/100` ; 68<n<=98: `n^3*floor((1911-10n)/3)/500` ; n>98: `n^3*(160-n)/100` |
| Fast                  | `4*n^3/5`                                                                                                                 |
| MediumFast            | `n^3`                                                                                                                     |
| MediumSlow            | `6*n^3/5 - 15*n^2 + 100*n - 140`                                                                                          |
| Slow                  | `5*n^3/4`                                                                                                                 |
| Fluctuating           | n<=15: `n^3*(n+73)/150` ; 15<n<=36: `n^3*(n+14)/50` ; n>36: `n^3*(n+64)/100`                                              |

**Size**: species carry height/weight; individual creatures may carry a size record (`scale` 0..255, `alpha` flag) that buckets into `xs/sm/md/lg/xl/alpha` display classes and scales height. Weight feeds `power-from-weight` moves.

**Major status enum**: `State` is a string enum **(planned change from numeric)** whose values match the status strings used everywhere else in this spec (`apply-status`, `cure-status`, the 2.11.8 table, the capture bonus): `"burn" | "paralysis" | "poison" | "sleep" | "freeze"` — string values because the enum is serialized into saves and displayed by the presentation.

### 2.11 Battle system

#### 2.11.1 Session protocol

A battle is a resumable generator produced by the `Battle` class's `start()` method (`new Battle(args).start(): BattleSession`, where `BattleSession = Generator<BattleEvent, BattleEvent, BattleInput>`) that:

1. yields lifecycle and narration events in exact presentation order,
2. suspends by yielding `request-turn-commands { requests: BattlePosition[] }` or `request-replacements { requests: ReplacementSelection[] }`,
3. resumes when the caller passes the matching command array to `session.next(input)`,
4. returns `battle-finished { winnerSide }` when one side has no usable creatures (or `winnerSide: null` on a simultaneous wipe = draw).

The `Engine` wraps the session: `start-battle` builds battle creatures from world components, drains events until the next input request, mirrors state into the transient world stores, and returns `GameEvent`s wrapping the battle events. The presentation never touches the generator directly.

```typescript
interface BattlePosition {
	side: number;
	slot: number;
}
type TurnCommand =
	| { type: "fight"; move: 0 | 1 | 2 | 3; target: BattlePosition; creature?: number } // creature for switch-self moves
	| { type: "switch"; target: BattlePosition; creature: number }
	| { type: "leave-battle" };
type ReplacementCommand =
	| { type: "replace"; target: BattlePosition; creature: number }
	| { type: "leave-battle"; target: BattlePosition };
```

Battle events (the full narration vocabulary):

`battle-started`, `turn-started`, `request-turn-commands`, `request-replacements`, `move-used`, `effectiveness` (non-neutral matchups), `critical-hit`, `damage-dealt { damage, remainingHP }`, `move-missed`, `move-failed { reason }`, `move-blocked` **(planned, for protect)**, `status-applied`, `volatile-applied { effect }`, `stat-stage-changed { stat, stages, value }`, `side-effect-applied`, `field-effect-applied`, `hazard-triggered`, `creature-switched`, `creature-fainted`, `healed` **(planned; today healing reuses damage-dealt with damage 0)**, `turn-ended`, `battle-finished`.

#### 2.11.2 Formats

`slots: 1 | 2 | 3` (singles, doubles, triples). Each side provides either one team (it fills all its slots) or exactly `slots` teams (multi-player sides). Teams hold 1..6 creatures. Wild battles are a 1v1 where the wild side is a single-creature team and the player side has `canLeaveBattle: true`.

#### 2.11.3 Turn lifecycle

1. If any slots are empty and benches have creatures: request replacements, apply them through the switch-in pipeline, re-check the winner.
2. Increment turn, yield `turn-started`, request one command per active slot.
3. **Commit**: for each `fight`, spend 1 PP now (even if the move later fails). A slot whose chosen move has no PP falls back: if any other move has PP the command is invalid (presentation must not send it — legality comes from the pending-request selector); if no move has PP, the slot uses the **fallback move** (typeless 50-power physical attack that bypasses accuracy and deals 1/4 of damage dealt as recoil **(recoil and typeless behavior planned)**).
4. **Order actions**: `leave-battle` first (priority +inf), then `switch` (priority 6), then moves by move priority (protect/endure +4), ties by effective speed (inverted while trick room is active), remaining ties by a per-action RNG roll, with a final deterministic side-then-slot fallback.
5. **Resolve each action** (2.11.4). Skip actions whose user left the field.
6. **End of turn** (2.11.7).
7. Winner check: side with no usable creatures loses; both = draw. Otherwise loop.

Effective speed = stat x stage modifier, halved by paralysis, doubled by tailwind, x1.5-style boosts reserved for traits/items later. Speed is sampled when actions are ordered.

#### 2.11.4 Move resolution pipeline

For one `fight` action, in order:

1. **Before-move gates** (first failure ends the action): recharging; taunt (status moves); encore (forces the encored slot); disable (blocks the disabled slot); attract (50% skip if the source is still active); sleep (decrement counter, act only if it hits 0); freeze (20% thaw, or thaw if the used move is fire-type — there is no per-move "thaws user" flag today); flinch; paralysis (25% full stop); confusion (decrement, 50% self-hit with a typeless 40-power physical self-attack, which can faint the user).
2. **Charge handling**: a charge move's first turn sets charging (+ optional semi-invulnerability), consumes the turn; its second turn releases automatically.
3. **Target check**: single-target moves whose slot is now empty fail with `move-failed: invalid-target`.
4. **Redirection**: follow-me redirects redirectable moves to the redirector's slot.
5. **Pre-hit failure checks**: declining protect/endure streak (success chance `1 / 2^consecutiveUses`); first-turn-only moves; fail-if-user-damaged-this-turn; belly drum HP floor; HP-gap moves against lower-HP targets; side effects already at cap; non-toggle field effects already active.
6. **Accuracy check** (2.11.5). On miss: crash-on-miss damage if declared, `move-missed`.
7. **Protect**: if the target is protecting and the move is affected, block damage and blockable effects (emit `move-blocked` **(planned)**); break-protect effects run first.
8. **Damage** (2.11.6) for damaging moves: multi-hit rolls its count (2-5 distribution from data range), each hit applies damage until the target faints; then drain healing, recoil, self-destruct, on-KO boosts, destiny bond (if the target just fainted with it active, the user faints).
9. **Effects**: apply the move's remaining effect list in authored order (statuses respect legality: existing major status, safeguard, type immunities, terrain rules; chance rolls per effect).
10. **Aftermath**: healing-wish self-KO; schedule delayed attacks; record last move slot; rampage counter (locks the move, confuses when it ends); switch-self; force-switch-target (random eligible bench member, blocked by protect and by empty benches).
11. **Faint processing**: any combatant at 0 HP is cleared from its slot immediately with `creature-fainted`.

#### 2.11.5 Accuracy

```
if move bypasses accuracy (accuracy = 0): hit, unless the target is semi-invulnerable
chance = (accuracy / 100)
       * stageModifier(user accuracy stage)        // (3+s)/3 up, 3/(3+|s|) down
       / stageModifier(target evasion stage)
gravity active: chance * 5/3
fog weather:    chance * 0.6
hit if random() < chance
```

The base-accuracy roll always runs — there is no shortcut at neutral stages **(spec target; today `moveCanConnect` short-circuits and auto-hits when both the accuracy and evasion stages are 0, so sub-100% moves never miss at neutral stages — known deviation, see Notes)**. OHKO moves use `accuracy = 30 + (userLevel - targetLevel)` and fail against higher-level targets **(planned; today they read accuracy 30 from data)**. Semi-invulnerable targets (charge moves) can only be hit by moves that declare it or under gravity.

#### 2.11.6 Damage

```
base = floor(floor(floor(2*level/5 + 2) * power * A / D) / 50) + 2
```

- `A/D`: attack vs defense for physical, special attack vs special defense for special. Stage modifiers apply as `(2+s)/2` up, `2/(2+|s|)` down. A critical hit ignores the attacker's negative stages and the defender's positive stages. Wonder room swaps the defender's defense stats.
- Variable-power effects override `power` first (HP-ratio tables, speed ratios, weight ratios, charged-electric doubling, double-on-status and the other conditional doublers).
- Then multiply, flooring after each step, **all applicable modifiers in this order**. Steps 4–9 stack as written. **Spec target: steps 1–3 (screens/weather/terrain) also stack with no early exit; the code currently folds them into base damage as mutually exclusive early-returns (only the first match applies) and does not exempt screens on crits — known deviation, see Notes.**
  1. screens: reflect halves physical, light screen halves special (not on crits)
  2. weather: sun fire x1.5 / water x0.5; rain water x1.5 / fire x0.5
  3. terrain (grounded users): electric/grassy/psychic boost their type x1.3; misty halves dragon vs grounded targets
  4. STAB x1.5 when the move type matches a user type
  5. type effectiveness (product of matchups; 0 prevents damage entirely and emits `effectiveness 0`)
  6. critical hit x1.5
  7. burn halves physical damage from burned attackers
  8. spread modifier x0.75 when a spread move hits multiple targets **(planned with multi-target support)**
  9. random factor: `* (85 + randomInt(0..15)) / 100`
- This numbered order is the normative sequence (it supersedes the looser conceptual list in `docs/battle.md`). Final damage for any connecting damaging move floors to at least 1, except when type effectiveness is 0 (which prevents damage entirely and emits `effectiveness 0`).
- Fixed-damage effects (fixed value, user-HP, HP-gap, counter x2) bypass the formula. `cannot-ko` leaves 1 HP; endure leaves 1 HP.

#### 2.11.7 End of turn

Order is fixed:

1. Delayed attacks that mature this turn resolve (standard damage pipeline).
2. Residuals per active combatant, faints processed immediately: burn 1/8 max HP; poison 1/8; escalating poison `n/16` with n incrementing per turn (reset to 1 on switch); leech seed drains 1/8 to the seeder's side; partial-trap 1/8 while its counter runs; aqua ring heals 1/16; curse 1/4; grassy terrain heals grounded 1/16; sandstorm 1/16 except rock/ground/steel; hail 1/16 except ice.
3. Timers tick: side effect turns (screens, safeguard, mist, tailwind, lucky chant), one-turn flags (protect/endure/flinch/follow-me/last-damage), taunt/encore/disable counters, weather/terrain/room/gravity turns (weather and terrain clear at 0).
4. Empty slots collect replacement requests; winner side is recomputed.

#### 2.11.8 Statuses

| Status    | Apply blocked by                                        | In battle                                                | Residual                       |
| --------- | ------------------------------------------------------- | -------------------------------------------------------- | ------------------------------ |
| burn      | fire types, safeguard, existing status                  | physical damage halved                                   | 1/8 max HP                     |
| paralysis | electric types, safeguard, existing status              | 25% full stop; speed halved                              | none                           |
| poison    | poison/steel types, safeguard, existing status          | none                                                     | 1/8 (regular), n/16 escalating |
| sleep     | electric terrain (grounded), safeguard, existing status | cannot act 1..3 turns                                    | none                           |
| freeze    | ice types, safeguard, existing status                   | cannot act; 20% thaw per attempt; thaw-on-use moves thaw | none                           |

Misty terrain blocks all major statuses on grounded targets. Statuses persist after battle and outside battle until cured. Volatile conditions (confusion, attract, taunt, encore, disable, trap, seeded, protect streaks, crit stages, charge/recharge/rampage state, identify, destiny bond, and the rest of the effect list) live only in battle combatant state and reset on switch-out and at battle end.

#### 2.11.9 Hazards and switch-in

Switch-in pipeline (used by voluntary switches, forced switches, and replacements alike): reset volatile state (rebuilt fresh from a factory, not field-by-field) → occupy slot, emit `creature-switched` → hazards in fixed order: stealth rock (rock-effectiveness x 1/8 max HP), spikes (grounded: 1/8, 1/6, 1/4 by layer), toxic spikes (grounded: poison or escalating poison at 2 layers; grounded poison types absorb them instead), sticky web (grounded: speed -1) → healing wish restores if pending → immediate faint check.

Grounded = not a flying type (data-driven airborne flag **(planned)**), overridden by gravity.

#### 2.11.10 Escape **(planned)**

Only sides with `canLeaveBattle` (wild battles) may flee. Gen 3 odds:

```
F = floor(playerSpeed * 128 / max(1, wildSpeed)) + 30 * attemptsThisBattle
escape if F > 255 or randomInt(0..255) < F
```

Trapping volatiles block escape. A successful escape ends the battle with no winner.

#### 2.11.11 Battle end and write-back

When the session finishes (or the player escapes/captures):

1. **(planned)** copy every player-side combatant's final state into persistent stores: `creatureHealth.damage`, `creatureStatus` (major status persists; toxic downgrades to regular poison), `creatureMoves.pp`.
2. **(planned)** award experience and EV yields for fainted opponents (2.9.5).
3. **(planned)** clear `activeBattle`, delete all `battle*` mirror components and their entity ids.
4. Emit `battle-finished` and, afterwards, any `creature-can-evolve` events produced by level-ups.

This is the step that closes the game loop: battles must have consequences in the saved world.

#### 2.11.12 RNG and determinism

All randomness flows through one injected `random(): number` (defaults to `Math.random`). With a seeded generator, a battle is fully reproducible from its inputs plus the command sequence — this is the testing and replay strategy. The engine never calls `Math.random` directly anywhere else.

### 2.12 Extension model

Move behavior is data (`MoveEffect`) interpreted by the engine — content never ships code. Two implementation decisions:

- **Today**: effect kinds are split between an effect resolver (applies statuses, volatiles, stages, side/field effects) and pipeline steps that read modifier-style kinds (multi-hit, recoil, power rules). The battle systems receive one shared `BattleContext` interface implemented by the battle orchestrator **(planned consolidation; currently several ad hoc context objects)**.
- **Direction**: passive traits and held items will be implemented as **timing-window hooks** — named windows (`on-switch-in`, `on-modify-speed`, `on-modify-power`, `on-modify-accuracy`, `on-before-move`, `on-after-damage`, `on-status-legality`, `on-end-of-turn`, `on-faint`) with data-declared handlers. Move effect kinds will migrate onto the same windows where it simplifies the pipeline. One extension mechanism for moves, traits, and items is the priority for the open source goal; magic room suppresses held-item hooks, and status/immunity checks consult trait hooks.

Adding a mechanic must not require touching more than: the data contract (new effect/hook kind) and one engine module that implements it.

### 2.13 Ruleset choices

Where generations disagree, the engine picks one behavior. Current decisions:

| Rule                                                             | Choice                                        | Origin           |
| ---------------------------------------------------------------- | --------------------------------------------- | ---------------- |
| Critical chance table                                            | 1/24 base; +1 stage 1/8; +2 1/2; +3 always    | Gen 7+           |
| Critical multiplier                                              | x1.5, ignores adverse stages, ignores screens | Gen 6+ / Gen 3   |
| Paralysis speed                                                  | x0.5                                          | Gen 7+           |
| Electric-type paralysis immunity                                 | yes                                           | Gen 6+           |
| Sleep duration                                                   | 1..3 turns                                    | Gen 5+           |
| Confusion self-hit                                               | 50%, 40 power                                 | Gen 3            |
| Physical/special split                                           | per move, not per type                        | Gen 4+           |
| Hazards beyond spikes                                            | stealth rock, toxic spikes, sticky web        | Gen 4/5 backport |
| Terrains, rooms, gravity                                         | supported                                     | Gen 4-7 backport |
| Fairy type                                                       | in the default chart                          | Gen 6 backport   |
| Escape odds, capture formula, experience formulas, stat formulas | Gen 3 formulas                                | Gen 3            |

The table is normative: implementations and tests follow it, and changing a row is an ADR-worthy decision.

### 2.14 Error handling

- Content validation returns `Result` values (`@pkg/result`); the engine unwraps at boot so invalid content fails fast with a `GameDataError` naming the broken reference.
- Missing runtime lookups (species/move/nature for an existing creature) throw `ReferenceError` — they indicate corrupted state, not user error.
- Invalid commands against current state (wrong replacement counts, illegal targets) throw `TypeError`/`RangeError`; the presentation avoids them by building choices from the pending-request selectors.

### 2.15 Testing strategy

- Battle tests drive full sessions with a seeded RNG sequence and assert on the ordered event stream — events are the behavior, not internal fields.
- Engine boundary tests dispatch commands and assert on returned events plus selector output.
- Every acceptance criterion in the mechanics tables above gets at least one test; regressions in ruleset rows are treated as spec violations.
- Content sanity tests: every species reference resolves, every move with special behavior carries a modeled effect (guards against `power: 0` + `kind: "none"` dead entries).
- Gap **(planned)**: the `src/game/systems/` world systems (inventory, storage, bestiary, capture, experience, evolution) have no dedicated tests yet; today's coverage lives under `battle/`, `data/`, `world/`, and the engine boundary. Their behaviors (storage reindexing, capture placement, experience/level math) still need acceptance tests.

---

## Part 3: Presentation

The presentation layer replaces `src/ui/` with a canvas renderer at `src/presentation/`, modeled on the Game Boy Advance games and RPG Maker XP: a fixed low-resolution screen, scene stack, tile-based overworld, windowskin menus, and an event-driven battle scene. It owns everything the engine deliberately does not: maps, movement, NPCs, scripts, rendering, audio, input, and save files.

### 3.1 Technology decisions

- **One `<canvas>`**, internal resolution **240x160** (GBA) scaled to the largest integer multiple that fits the window, letterboxed, `image-rendering: pixelated`, `ctx.imageSmoothingEnabled = false`. All drawing code works in internal pixels and ignores the scale.
- **Fixed-timestep loop**: update at 60 Hz with an accumulator; render once per `requestAnimationFrame`; cap the accumulator to avoid spiral-of-death after tab suspension; pause on `visibilitychange`.
- **No framework**: 2D canvas API, Web Audio API, `KeyboardEvent`, and the Gamepad API cover everything at this resolution.
- Tiles are **16x16** (GBA-style; RPG Maker XP's 32x32 equivalent at half scale). Creature battle sprites are 64x64 front and back. Character sprites are 16x32 (occupying one tile footprint, drawn two tiles tall), 4 directions x 4 walk frames.

### 3.2 Directory layout

```
src/presentation/
  core/        game-client.ts, scene.ts, scene-stack.ts, loop.ts,
               input.ts, assets.ts, audio.ts, save.ts
  render/      sprite-sheet.ts, animation.ts, tilemap.ts, camera.ts,
               window.ts, text.ts
  overworld/   overworld-scene.ts, map-loader.ts, player-controller.ts,
               npc.ts, triggers.ts, encounters.ts
  battle/      battle-scene.ts, animation-queue.ts, event-animations.ts,
               command-menu.ts, hp-bar.ts
  scenes/      boot.ts, title.ts, menu.ts, party.ts, summary.ts, bag.ts,
               bestiary.ts, storage.ts, evolution.ts, save.ts, dialogue.ts
  assets/      manifest.ts (typed asset registry)
```

Asset files (png/json/ogg) live under `src/presentation/assets/` and are served statically; only the manifest is TypeScript.

### 3.3 The GameClient class

The composition root the user starts. It owns the canvas, subsystems, engine, and the loop; scenes receive it as their context.

```typescript
export class GameClient {
	readonly engine: Engine;
	readonly input = new InputManager();
	readonly assets = new AssetStore(MANIFEST);
	readonly audio = new AudioManager();
	readonly scenes = new SceneStack(this);
	readonly save = new SaveStore("pkmn-save");

	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private accumulator = 0;
	private lastTime = 0;
	private static readonly STEP = 1000 / 60; // fixed update step in ms

	constructor(root: HTMLElement, engine: Engine) {
		this.engine = engine;
		this.canvas = document.createElement("canvas");
		this.canvas.width = 240;
		this.canvas.height = 160;
		this.ctx = this.canvas.getContext("2d")!;
		this.ctx.imageSmoothingEnabled = false;
		root.append(this.canvas);
		new ResizeObserver(() => this.fitToWindow(root)).observe(root);
	}

	start() {
		this.input.attach(window);
		this.scenes.replace(new BootScene()); // BootScene loads assets, then Title
		this.lastTime = performance.now();
		requestAnimationFrame(this.frame);
	}

	/** Dispatches to the engine and hands resulting events to the active scene. */
	dispatch(command: Command): GameEvent[] {
		const events = this.engine.dispatch(command);
		this.scenes.current?.onEngineEvents?.(events);
		return events;
	}

	private frame = (now: number) => {
		this.accumulator = Math.min(this.accumulator + (now - this.lastTime), 250);
		this.lastTime = now;
		while (this.accumulator >= GameClient.STEP) {
			this.input.poll(); // gamepad + edge detection
			this.scenes.update(GameClient.STEP);
			this.accumulator -= GameClient.STEP;
		}
		this.ctx.clearRect(0, 0, 240, 160);
		this.scenes.render(this.ctx);
		requestAnimationFrame(this.frame);
	};

	private fitToWindow(root: HTMLElement) {
		const scale = Math.max(
			1,
			Math.floor(Math.min(root.clientWidth / 240, root.clientHeight / 160)),
		);
		this.canvas.style.width = `${240 * scale}px`;
		this.canvas.style.height = `${160 * scale}px`;
	}
}
```

Boot sequence: `BootScene` drives `assets.loadAll(progress => ...)`, unlocks audio on the first input (browser autoplay policy), then replaces itself with `TitleScene`. `TitleScene` offers New Game / Continue and constructs or restores the world before pushing `OverworldScene`.

### 3.4 Scene system

```typescript
export interface Scene {
	/** Called once when the scene becomes part of the stack. */
	enter(game: GameClient): void;
	exit(game: GameClient): void;
	/** Called when a scene is pushed on top / popped off again. */
	suspend?(): void;
	resume?(): void;
	update(game: GameClient, dt: number): void;
	render(game: GameClient, ctx: CanvasRenderingContext2D): void;
	/** True if scenes below should still render (menu over map). */
	readonly translucent?: boolean;
	/** Engine events produced by dispatches while this scene is active. */
	onEngineEvents?(events: GameEvent[]): void;
}

export class SceneStack {
	push(scene: Scene): void; // suspend current, enter new
	pop(): void; // exit current, resume previous
	replace(scene: Scene): void;
	update(dt: number): void; // top scene only
	render(ctx): void; // renders from the deepest non-translucent scene up
	get current(): Scene | null;
}
```

Scene catalog:

| Scene     | Purpose                                   | Engine interaction                                     |
| --------- | ----------------------------------------- | ------------------------------------------------------ |
| Boot      | Load manifest assets, show progress       | none                                                   |
| Title     | New game / continue                       | build world, `Engine.create`, restore save             |
| Overworld | Tile map, movement, NPCs, triggers        | dispatches from scripts and encounters                 |
| Dialogue  | Message/choice windows over any scene     | none directly (scripts dispatch)                       |
| Menu      | Pause menu root (party/bag/bestiary/save) | selectors                                              |
| Party     | Reorder, inspect, choose targets          | `selectParty`, item targets                            |
| Summary   | One creature's stats/moves                | `selectCreatureSummary`                                |
| Bag       | Inventory by category, use items          | `selectInventory`, `use-item`                          |
| Bestiary  | Seen/caught list                          | `selectBestiary`                                       |
| Storage   | Box management                            | `selectStorage`, `store-creature`, `withdraw-creature` |
| Battle    | Full battle presentation                  | battle commands, battle events                         |
| Evolution | Evolution cinematic + confirm/cancel      | `evolve-creature`                                      |
| Save      | Write save file                           | `engine.snapshot()`                                    |

### 3.5 Input

Logical buttons decouple scenes from devices. Keyboard and gamepad both feed the same state; edge detection distinguishes "pressed this frame" from "held".

```typescript
export enum Button {
	Up,
	Down,
	Left,
	Right,
	A,
	B,
	Start,
	Select,
	L,
	R,
}

const KEY_BINDINGS: Record<string, Button> = {
	ArrowUp: Button.Up,
	ArrowDown: Button.Down,
	ArrowLeft: Button.Left,
	ArrowRight: Button.Right,
	KeyW: Button.Up,
	KeyS: Button.Down,
	KeyA: Button.Left,
	KeyD: Button.Right,
	KeyZ: Button.A,
	Enter: Button.A, // confirm / interact
	KeyX: Button.B,
	Escape: Button.B, // cancel / run
	ShiftLeft: Button.Select,
	KeyM: Button.Start,
};

// Standard gamepad mapping (https://w3c.github.io/gamepad/#remapping)
const PAD_BINDINGS: Record<number, Button> = {
	12: Button.Up,
	13: Button.Down,
	14: Button.Left,
	15: Button.Right,
	0: Button.A,
	1: Button.B,
	9: Button.Start,
	8: Button.Select,
	4: Button.L,
	5: Button.R,
};

export class InputManager {
	private held = new Set<Button>();
	private pressed = new Set<Button>(); // edges, cleared every poll
	private released = new Set<Button>();
	private keyboardHeld = new Set<Button>();

	attach(target: Window) {
		target.addEventListener("keydown", (e) => {
			const b = KEY_BINDINGS[e.code];
			if (b === undefined || e.repeat) return;
			e.preventDefault();
			this.keyboardHeld.add(b);
		});
		target.addEventListener("keyup", (e) => {
			const b = KEY_BINDINGS[e.code];
			if (b !== undefined) this.keyboardHeld.delete(b);
		});
		target.addEventListener("blur", () => this.keyboardHeld.clear());
	}

	/** Called once per fixed update: merges keyboard + gamepad, computes edges. */
	poll() {
		const next = new Set(this.keyboardHeld);
		for (const pad of navigator.getGamepads()) {
			if (!pad) continue;
			for (const [index, button] of Object.entries(PAD_BINDINGS)) {
				if (pad.buttons[Number(index)]?.pressed) next.add(button);
			}
			if (pad.axes[0]! < -0.5) next.add(Button.Left);
			if (pad.axes[0]! > 0.5) next.add(Button.Right);
			if (pad.axes[1]! < -0.5) next.add(Button.Up);
			if (pad.axes[1]! > 0.5) next.add(Button.Down);
		}
		this.pressed.clear();
		this.released.clear();
		for (const b of next) if (!this.held.has(b)) this.pressed.add(b);
		for (const b of this.held) if (!next.has(b)) this.released.add(b);
		this.held = next;
	}

	isHeld(b: Button) {
		return this.held.has(b);
	}
	isPressed(b: Button) {
		return this.pressed.has(b);
	} // this frame only
	isReleased(b: Button) {
		return this.released.has(b);
	}

	/** Menu navigation helper: fires on press, then repeats after 250ms every 80ms. */
	isRepeating(b: Button, heldMs: number): boolean {
		return this.isPressed(b) || (this.isHeld(b) && heldMs > 250 && heldMs % 80 < GameClient.STEP);
	}
}
```

Scenes read input in `update` (`if (game.input.isPressed(Button.A)) ...`). Nothing else in the app listens to DOM input events.

### 3.6 Assets

A typed manifest enumerates every asset; the store loads them all at boot (the game is small enough for eager loading) and exposes typed getters.

```typescript
interface AssetManifest {
	images: Record<string, string>; // id -> url (sprite sheets, tilesets, windowskin, backgrounds)
	audio: Record<string, { url: string; loopStart?: number; loopEnd?: number }>;
	maps: Record<string, string>; // id -> url of tilemap JSON
	fonts?: Record<string, string>; // bitmap font sheets
}

class AssetStore {
	async loadAll(onProgress: (loaded: number, total: number) => void): Promise<void>;
	image(id: string): HTMLImageElement; // throws if missing = manifest bug
	audioBuffer(id: string): AudioBuffer;
	map(id: string): TileMap;
}
```

**Sprite sheets** are grids of fixed-size frames addressed by index:

```typescript
class SpriteSheet {
	constructor(
		readonly image: HTMLImageElement,
		readonly frameWidth: number,
		readonly frameHeight: number,
	) {}
	draw(ctx: CanvasRenderingContext2D, frame: number, x: number, y: number, flipX = false): void;
}

/** Frame sequence with per-frame durations; drives walk cycles and battle effects. */
class SpriteAnimation {
	constructor(
		readonly frames: number[],
		readonly frameDuration: number,
		readonly loop = true,
	) {}
	update(dt: number): void;
	get frame(): number;
}
```

Conventions: creature sprites ship as `creatures-front.png` / `creatures-back.png` sheets indexed by species `number`; character sheets hold 4 rows (down/left/right/up) x 4 columns (stand, step1, stand, step2).

**Audio** uses Web Audio with three gain channels:

```typescript
class AudioManager {
	playBgm(id: string): void; // stops current with a short fade; loops using loopStart/loopEnd
	stopBgm(fadeMs?: number): void;
	playSfx(id: string): void; // fire-and-forget, overlapping allowed
	playCry(speciesNumber: number): void;
	setVolume(channel: "bgm" | "sfx" | "cries", value: number): void;
	unlock(): void; // resume AudioContext on first user input
}
```

BGM loop points (`loopStart`/`loopEnd` seconds) come from the manifest so intro-then-loop tracks work: set `source.loop = true; source.loopStart = a; source.loopEnd = b`.

### 3.7 Tile maps and the overworld

Map JSON format (authored by hand or exported from a map editor):

```typescript
interface TileMap {
	id: string;
	tileset: string; // image asset id; tiles indexed left-to-right, top-to-bottom
	width: number;
	height: number; // in tiles (16px each)
	layers: { ground: number[]; decor: number[]; overhead: number[] }; // width*height tile indices, -1 = empty
	collision: number[]; // 0 walkable, 1 solid, 2 water, 3 ledge-down, ...
	encounters: Array<{
		zone: number[];
		table: Array<{ speciesId: string; minLevel: number; maxLevel: number; weight: number }>;
		rate: number;
	}>;
	warps: Array<{ x: number; y: number; to: { map: string; x: number; y: number } }>;
	npcs: Array<{
		id: string;
		x: number;
		y: number;
		sheet: string;
		facing: Direction;
		movement: "static" | "wander" | { route: Direction[] };
		script: ScriptCommand[];
	}>;
	triggers: Array<{ x: number; y: number; once?: boolean; flag?: string; script: ScriptCommand[] }>;
	bgm: string;
}
```

Rendering: `ground` and `decor` draw below actors, `overhead` above (tree tops, roofs). The camera centers on the player, clamped to map bounds; only visible tiles draw. The two static layers are pre-rendered once per map onto offscreen canvases and blitted per frame.

Movement is grid-locked, RPG Maker style: actors occupy a tile and tween to the next over ~250ms (running: 125ms) with a 4-frame walk cycle; input is sampled on tile arrival. Collision checks the target tile's collision value plus actor occupancy. Ledges are one-way hops. Tall grass tiles roll encounters on entry: `if random() < rate/255`, pick from the weighted table, then:

```typescript
game.dispatch({ type: "spawn-encounter", encounterId, speciesId, level });
game.dispatch({
	type: "start-battle",
	battleId,
	playerId,
	enemyId: wildId,
	playerParty,
	enemyParty: [creatureId],
	slots: 1,
});
game.scenes.push(new BattleScene(battleId));
```

**Scripts** are small declarative command lists so NPCs and triggers stay data:

```typescript
type ScriptCommand =
	| { do: "message"; text: string }
	| { do: "choice"; options: string[]; branches: ScriptCommand[][] }
	| { do: "give-item"; itemId: string; count: number } // engine dispatch
	| { do: "heal-party" } // engine dispatch
	| { do: "start-trainer-battle"; trainerId: string } // engine dispatch + scene
	| { do: "set-flag"; flag: string }
	| { do: "if-flag"; flag: string; then: ScriptCommand[]; else?: ScriptCommand[] }
	| { do: "warp"; toMap: string; toX: number; toY: number }
	| { do: "face-player" }
	| { do: "move"; route: Direction[] };
```

Game flags/variables live in the presentation save slice, not the engine world: they are game scripting state, not creature rules.

### 3.8 Windows and text

RPG Maker's windowskin concept: one 9-slice texture provides every menu frame.

```typescript
class Window {
	/** Draws the 9-slice frame (corners fixed, edges/center tiled or stretched). */
	static frame(ctx, skin: HTMLImageElement, x: number, y: number, w: number, h: number): void;
}

class Typewriter {
	constructor(text: string, charsPerSecond = 40) {}
	update(dt: number): void;
	skip(): void; // A button reveals everything
	get visibleText(): string;
	get done(): boolean;
}
```

Text renders with a bundled pixel font (bitmap font sheet drawn glyph-by-glyph for crispness; canvas `fillText` with a web font is an acceptable first pass). Utilities: measure, wrap to window width, page long dialogue with the "press A" arrow. The dialogue scene owns a message window (bottom 48px) and an optional choice window; menus compose list windows with a cursor sprite and `isRepeating` navigation.

### 3.9 Battle scene

The battle scene is a consumer of the engine's ordered battle events; it never computes rules. Core piece is the **animation queue**: engine events arrive in bursts (everything between two input requests) and are translated into sequential animation tasks.

```typescript
interface AnimationTask {
	update(dt: number): boolean; /* done */
}

class AnimationQueue {
	enqueue(...tasks: AnimationTask[]): void;
	update(dt: number): void; // runs tasks strictly in order
	get idle(): boolean;
}
```

Event-to-animation mapping (each battle event appends tasks; the queue drains before the scene reads the next pending request):

| Battle event               | Presentation                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `battle-started`           | slide-in sprites, intro message, battle BGM                                                                              |
| `turn-started`             | nothing (bookkeeping)                                                                                                    |
| `move-used`                | message "X used Y!", attacker lunge/flash animation, move SFX                                                            |
| `move-missed`              | message "It missed!"                                                                                                     |
| `move-failed`              | reason-specific message ("X is paralyzed!", "But it failed!")                                                            |
| `move-blocked` _(planned)_ | protect shield flash, "X protected itself!"                                                                              |
| `critical-hit`             | message "A critical hit!" + screen shake                                                                                 |
| `effectiveness`            | message ("It's super effective!" / "not very effective" / "It doesn't affect X")                                         |
| `damage-dealt`             | target flicker + HP bar tween from event's `remainingHP` (never from selector diffs); low-HP bar turns yellow/red + beep |
| `healed` _(planned)_       | green flash + HP bar tween up                                                                                            |
| `status-applied`           | status icon + message; poison/burn palette flash                                                                         |
| `volatile-applied`         | effect-specific animation (confusion birds, attract hearts, ...)                                                         |
| `stat-stage-changed`       | rising/falling stat glow + message with the new direction                                                                |
| `side-effect-applied`      | screen/hazard placement animation                                                                                        |
| `field-effect-applied`     | weather/terrain overlay change (rain streaks, sun tint, fog alpha)                                                       |
| `hazard-triggered`         | hazard hit animation before the damage event that follows                                                                |
| `creature-switched`        | recall ball animation, send-out with cry                                                                                 |
| `creature-fainted`         | sprite drop + cry + message                                                                                              |
| `turn-ended`               | nothing                                                                                                                  |
| `battle-finished`          | victory/defeat message + BGM change, then pop the scene                                                                  |

Flow: when the queue is idle and `selectBattle(battleId).pendingRequest` is `turn`, open the command menu (Fight / Bag / Creatures / Run) per requested slot; Fight lists the four moves with PP and disables empty ones; Bag pushes the bag scene in battle mode (`use-item` with `battleId`); Creatures pushes party for a `switch` command; Run submits `leave-battle`. Submissions dispatch `submit-battle-turn`, and the returned `battle-events-appended` payload feeds the queue. `replacement` requests open the forced-switch party view. HP bars, names, levels, and status icons render from `BattleView`; wild battles hide the enemy HP numbers, showing only the bar.

### 3.10 Saving and loading

```typescript
interface SaveFile {
	version: 1;
	savedAt: string; // ISO timestamp
	world: PersistentWorld; // engine.snapshot()
	presentation: {
		mapId: string;
		x: number;
		y: number;
		facing: Direction;
		flags: Record<string, boolean>;
		variables: Record<string, number>;
		options: { textSpeed: 1 | 2 | 3; volume: { bgm: number; sfx: number; cries: number } };
	};
}
```

`SaveStore` wraps `localStorage` (single slot to start): `save()` composes the envelope, `load()` validates the version, runs the world through `migrateWorld`, and returns both halves. Saving is only offered outside battle. Version bumps get explicit migration functions.

### 3.11 Performance notes

At 240x160 nothing here is expensive; the rules that keep it that way: pre-render static tile layers per map; never allocate in `update`/`render` hot paths (reuse task objects and strings where easy); a single canvas, no per-sprite canvases; audio buffers decoded once at boot.

---

## Consequences

### Positive

- **The engine is reusable**: franchise-agnostic vocabulary, data-driven mechanics, and a single boundary make the OSS goal realistic — a new game is new content plus a new presentation.
- **Every layer is independently testable**: content by validation, engine by event-stream tests with seeded RNG, presentation by driving scenes with fake input against a real engine.
- **The event stream makes the battle UI tractable**: animation is a fold over ordered events, never a diff of before/after state, which is exactly how the original games sequence their narration.
- **This document is sufficient**: contracts, formulas, orderings, and class designs are all specified inline, so a fresh implementer does not need the codebase's history.

### Negative

- **The ADR duplicates knowledge that also lives in code and `docs/battle.md`**; when mechanics change, both must be updated or they drift. The ruleset table (2.13) is the guard: changes there are deliberate.
- **Canvas-from-scratch presentation** means building sprite, tilemap, window, and audio plumbing that a framework would give for free. Accepted for zero dependencies, full control, and the small fixed scope of a GBA-style renderer.
- **Fixed 240x160 presentation** limits UI density (storage box grids, long move descriptions). Accepted as an aesthetic constraint; scenes paginate.
- **Single-player, single-save architecture**: the world model assumes one player root; multiplayer (trades, link battles) would need a serialization boundary between engines and is out of scope.

### Neutral

- The engine mixes generational rules by explicit decision (2.13) instead of emulating one generation exactly.
- Overworld state (flags, position, scripts) deliberately lives outside the engine; a different game could move it inside, but then the engine stops being "rules only".
- Battle write-back, capture, experience award, item use, and escape are specified here but pending implementation; until they land, the game loop does not close (`TODO.md` tracks the same gaps).

## Implementation Plan

### Phase 1: Close the engine loop

**Priority:** High

1. Battle end write-back (2.11.11), including `activeBattle`/mirror cleanup and snapshot entity filtering.
2. Accuracy fix (always roll base accuracy), fallback-move recoil/typeless behavior.
3. Capture formula + `use-item` + `spawn-encounter` + escape support + experience/EV award + level-up learnset and evolution eligibility events.
4. `State` string enum, `Erratic` growth rate, seedable engine RNG.

### Phase 2: Presentation core

**Priority:** High

1. `GameClient`, loop, `InputManager`, `AssetStore`, `AudioManager`, `SceneStack`, Boot/Title scenes.
2. Window/text/typewriter rendering, menu widgets.

### Phase 3: Overworld

**Priority:** Medium

1. Tilemap loader/renderer, camera, grid movement, collision.
2. NPCs, scripts, warps, dialogue scene, flags, save/load.
3. Encounter zones wired to `spawn-encounter` + `start-battle`.

### Phase 4: Battle presentation

**Priority:** Medium

1. Battle scene, animation queue, event-animation mapping, command menus, HP bars.
2. Bag/party integration in battle, capture and escape flows, evolution scene after battles.

### Phase 5: Menus and polish

**Priority:** Low

1. Party/Summary/Bag/Bestiary/Storage scenes.
2. Options, audio channels, title continue flow, content completeness pass (model the 247 moves still carrying `kind: "none"`).

### Phase 6: Parity extensions

**Priority:** Low

1. Passive traits and held items as timing-window hooks (2.12): the hook data model, the named windows, and migrating the move-effect kinds that simplify onto them; magic-room held-item suppression and trait-driven status/immunity checks.
2. Breeding (2.9.8): egg creation from compatible egg groups/genders, inherited moves and IVs, egg entities with a `hatchCounter`, and the overworld step-cycle that hatches them.

These are the two **(planned)** systems that Phases 1–5 do not schedule; they are deferred because the game loop closes without them.

## Alternatives Considered

### 1. DOM or React for the presentation layer

Render menus and battles as HTML/CSS (the current mock's direction).

**Rejected because**: the target aesthetic (tile maps, sprite animation, palette effects, screen shake) fights the DOM; a canvas renderer at fixed resolution is simpler than synchronizing DOM state with game state at 60 Hz, and keeps the presentation portable to other canvas hosts.

### 2. A rendering framework (Pixi.js, Phaser, Kaplay)

**Rejected because**: the monorepo convention is minimal dependencies; the needed feature set (blit sprites, tile layers, one canvas, chip-tune audio) is a small fraction of any framework, and frameworks impose their own loop/scene/asset models that would compete with this design.

### 3. Pure ECS for everything (archetypes, queries, scheduled systems)

**Rejected because**: the game state is small and heterogeneous; dogmatic ECS adds machinery without gameplay benefit. The hybrid keeps ECS's serialization and identity wins while staying readable — restated from the original design notes that motivated the current world model.

### 4. Scripted move effects (functions in content)

Let content ship arbitrary effect callbacks per move.

**Rejected because**: content must stay data (serializable, validatable, portable across engine versions); arbitrary code in content would leak rules out of the engine and break the OSS story. The effect union plus timing-window hooks covers the space.

### 5. Emulating one generation exactly

**Rejected because**: the goal is a good engine for new games, not an emulator; exact per-generation quirks (badge boosts, Gen 3 screen crit interaction, RNG artifacts) cost complexity that no new game needs. The ruleset table documents each deviation deliberately.

## References

- `apps/pkmn/README.md` - project goal summary
- `apps/pkmn/docs/battle.md` - long-form battle spec (superset of 2.11 with acceptance criteria)
- `apps/pkmn/docs/breeding.md` - breeding spec behind 2.9.8
- `apps/pkmn/AGENTS.md` - coding conventions (layer rules, JSDoc, TODO tracking)
- `apps/pkmn/TODO.md` - tracked parity gaps matching the planned items here
- Damage/stat/capture/experience formulas follow the community-documented Gen 3 mechanics (Bulbapedia: "Damage", "Statistic", "Catch rate", "Experience")

## Current Progress

- [x] Content layer: schemas, Gen 1 roster, moves, items, natures, type chart, validation
- [x] Engine: world model, ids, migration, persistence split, snapshot
- [x] Engine: command/event/selector boundary with typed views
- [x] Engine: world systems (inventory, storage, bestiary, capture transition, experience grant, evolution swap)
- [x] Engine: battle core (formats, turn lifecycle, move pipeline, statuses, volatiles, hazards, side/field effects, replacements, draw handling)
- [ ] Phase 1: close the engine loop (write-back, capture formula, item use, encounters, escape, experience award, evolution eligibility)
- [x] Phase 2: presentation core (GameClient, fixed-step loop, input, assets, audio, scene stack, boot/title, window/text/typewriter)
- [x] Phase 3: overworld (tilemap render, grid movement, collision, camera, encounter rolling, save/load) — NPCs, scripts, warps, and dialogue wiring still pending
- [x] Phase 4: battle presentation (animation queue, event→animation mapping, command menu, HP bars, forced replacements) — in-battle bag/party, capture, escape, and post-battle evolution flows still pending
- [x] Phase 5: menus (party, summary, bag, bestiary, storage, save) — content-completeness pass still pending
- [ ] Phase 6: parity extensions (passive traits/held-item hooks, breeding)

## Notes

- The presentation replaced the `src/ui/` DOM mock: it now lives in `src/presentation/` and the mock was deleted rather than ported. It ships with procedural placeholder graphics (colored tiles and sprites, a drawn window frame, canvas text) so the game runs before any art/audio assets exist; real assets drop in through the (currently empty) `assets/manifest.ts` without touching rendering code.
- Known code deviations from this spec at the time of writing (all tracked in `TODO.md`): the neutral-stage accuracy shortcut; missing battle write-back; screens/weather/terrain applied as mutually-exclusive early-returns in `getBaseDamage` instead of stacking, and screens not exempted on critical hits; `ItemCategory` enum carrying franchise terms in the engine layer; a non-spec +10% speed boost under electric terrain; numeric `State` enum; missing `Erratic` curve; the `Evolution.ByFriendship` record still carrying an unused `level` field; and OHKO moves authored without their `ohko` effect.
- The fallback move exists so a battle can always progress under PP exhaustion; it is intentionally not part of any learnset and never appears in menus — the presentation shows a "no moves left" prompt that submits any `fight` command, and the engine substitutes the fallback.
- Battle mirrors are rebuilt wholesale after every engine step; selectors must treat them as ephemeral reads, never hold references across dispatches.
- Audio unlock must happen inside a user-gesture handler (`AudioContext.resume()`); the Boot scene's "press any button" screen exists for that reason, not just style.
