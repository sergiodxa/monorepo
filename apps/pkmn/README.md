# pkmn

A Pokemon-like game built as three strictly separated layers: **data**, **game engine**, and **UI**. The long-term goal is to open source the engine so anyone can build their own monster-collecting game by authoring data and customizing the presentation, without touching the core rules.

## The idea

Classic monster-collecting games are three different things glued together:

1. **Content** — the creatures, moves, items, natures, and type matchups that make a specific game what it is.
2. **Rules** — how battles resolve, how teams and boxes work, how capturing, experience, evolution, and the bestiary behave.
3. **Presentation** — how all of that is rendered and interacted with.

This project keeps those three things physically apart so each can change without dragging the others along:

| Layer          | Location       | Status                                                                 |
| -------------- | -------------- | ---------------------------------------------------------------------- |
| Data (content) | `src/content/` | Gen 1 roster authored; used to validate engine features                |
| Game engine    | `src/game/`    | Playable battle core plus world systems; see `TODO.md` for parity gaps |
| UI             | `src/ui/`      | Placeholder demo shell; real UI not started                            |

## Ground rules

### The engine never mentions Pokemon

The engine (`src/game/`) MUST stay franchise-agnostic. It never uses Pokemon vocabulary — no "Pokemon", "Pokeball", "Pokedex", or move/creature names. It speaks in generic terms instead: _creature_, _species_, _capture_, _bestiary_, _storage box_, _trainer_. This is what makes the engine reusable: swap the data and you have a different game.

The one exception is `src/content/`, which is intentionally full of Pokemon data. Authoring the real thing is how we prove the engine supports every mechanic an actual game needs. When the engine is extracted for open sourcing, the content layer stays behind (or ships as an example replaced by your own data).

### Feature target: Generation III, with backports

The engine aims to support at least everything the third-generation games do: battles (including doubles), major and volatile statuses, stat stages, weather, held items, traits/abilities, breeding, natures, EVs/IVs, capturing, evolution, experience groups, and box storage.

Where a newer-generation mechanic is easy to support (terrains, hazards like Stealth Rock, rooms, gravity, fairy type, physical/special split per move), we backport it — data can always choose not to use it. When generations disagree on a rule, the engine picks one behavior; those choices are documented in `docs/`.

### Simplicity is a feature

The engine is meant to be extended by games that use it. Custom mechanics, house rules, and new content kinds must be easy to add, so the code stays deliberately simple: plain data contracts, small systems, explicit state, no clever indirection. If a change makes the engine harder to follow, it is the wrong change even if it is more "correct" engineering.

## Architecture

The engine is a hybrid ECS with a command/event boundary:

- **World** (`src/game/world/`) — serializable component stores keyed by stable entity ids (`player:*`, `creature:*`, `battle:*`). Persistent stores survive save/load; battle mirrors are transient and rebuilt at runtime.
- **Systems** (`src/game/systems/`, `src/game/battle/`) — the rules. Small modules that mutate world state: inventory, storage, capture, bestiary, experience, evolution, and the turn-based battle resolver.
- **Engine boundary** (`src/game/engine.ts`) — the only entry point for the outside world. Callers `dispatch(command)` to change state and receive ordered `GameEvent`s back, and `select(selector)` to read derived view models. The UI never touches internal state.
- **Data contracts** (`src/game/data/`) — the schemas content must satisfy (`Species`, `Move`, `Item`, `Nature`, type chart) plus `GameData`, which validates cross-references at load time.
- **Battle** (`src/game/battle/`) — a resumable generator session: it yields narratable events (`move-used`, `damage-dealt`, `creature-fainted`, …), suspends when it needs player input, and accepts commands to continue. The event stream is the UI contract; any renderer (DOM, canvas, CLI, tests) replays the same events.

Specifications for the mechanics live in `docs/` (`battle.md`, `breeding.md`) and are the source of truth the implementation is tested against. The complete architecture — content schemas, engine contracts and formulas, and the planned canvas presentation layer — is specified in [ADR-001](../../docs/adr/pkmn/ADR-001-content-engine-presentation-architecture.md), which is written to be buildable standalone.

## Development

```sh
bun start          # run the browser demo (src/index.html)
bun test apps/pkmn # run the engine test suite from the repo root
bun run typecheck  # tsc --noEmit
bun run download:pokeapi  # refresh the local PokeAPI snapshot used to author content
```

`AGENTS.md` documents the conventions for working on this codebase (layer rules, JSDoc requirements, TODO tracking).
