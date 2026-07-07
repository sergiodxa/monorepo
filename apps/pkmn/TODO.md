# PKMN TODO

## ECS Foundation

- [x] Replace the remaining aggregate and wrapper-style runtime objects with pure component data where possible.
- [x] Define a stable entity creation strategy for players, creatures, battles, and future world entities.
- [x] Add helper utilities for creating, validating, and querying component stores in `src/game/world/`.
- [x] Decide which component stores are persistent save data versus transient runtime-only data.

## Engine Boundary

- [x] Expand `src/game/engine.ts` into the single dispatch/select entrypoint for the game runtime.
- [x] Define engine-level commands for battle, inventory, storage, capture, experience, and evolution flows.
- [x] Define engine-level events as the public contract between the engine and the UI.
- [x] Stop exposing internal mutable structures directly when selectors can provide the same information.

## World Model

- [x] Split creature save data into smaller components instead of storing `Creature.Arguments` as one blob.
- [x] Add ownership and location-related components for creature placement across party, storage, encounters, and battles.
- [x] Add battle-related component stores for transient battle entities in the ECS world.
- [x] Add migration helpers to convert existing bootstrap world data into the final ECS shape.

## Battle Integration

- [x] Replace the current battle bridge with battle entities and battle-specific components in the world.
- [x] Model battle participants, turn state, side effects, field effects, and volatile creature state as components.
- [x] Move battle startup through `Engine.dispatch` instead of constructing battle sessions manually.
- [x] Introduce engine-level battle commands with stable entity ids instead of positional-only APIs.
- [x] Adapt battle selectors so the UI reads battle state through the engine, not through battle internals.

## Battle Refactor

- [x] Break `src/game/battle/battle.ts` into smaller systems without changing behavior.
- [x] Extract turn ordering into a dedicated battle system.
- [x] Extract move resolution into a dedicated battle system.
- [x] Extract damage calculation into a dedicated battle system.
- [x] Extract status and volatile effects into dedicated battle systems.
- [x] Extract switching, replacement, and victory resolution into dedicated battle systems.

## Battle Spec Parity

- [x] Implement PP legality, PP spending-on-commit, and the fallback move flow when no regular move can be selected.
- [x] Replace the current equal-speed tie breaker with deterministic RNG-based action ordering that matches the battle spec.
- [x] Distinguish in battle result resolution between an unfinished battle and a simultaneous-elimination draw, and emit the correct finished event for draw outcomes.
- [x] Add full start-of-turn major-status handling, including sleep turn tracking, wake-up rules, freeze thaw checks, thaw-on-use rules, and paralysis action loss.
- [x] Expand major-status application legality to cover type immunities, terrain prevention, and other battle-state restrictions defined in `docs/battle.md`.
- [ ] Add passive-trait and held-item major-status immunity hooks once those systems expose runtime legality checks to battle resolution.
- [x] Implement toxic-style poison tracking and escalating residual damage when the applied poison variant requires it.
- [x] Add the missing volatile-condition rules from `docs/battle.md`, including infatuation duration/behavior, identify state interactions, and any unimplemented lock, charge, or delayed-action states.
- [x] Add the repeated-use declining success model for protect/endure-style volatile protection states.
- [ ] Rework move targeting so actions can target a combatant, ally, side, or the battlefield instead of always requiring a single active-slot target.
- [ ] Implement targeting-class-based doubles behavior, including adjacency rules, ally targeting, invalid-target failure vs retargeting, and spread targeting.
- [ ] Implement spread-move damage reduction and per-target protection/immunity resolution for multi-target moves in doubles.
- [x] Add explicit pre-hit failure checks for move rules such as first-active-turn requirements, duplicate side or field effects at cap, minimum-HP floor rules, and user-damaged-this-turn requirements.
- [x] Separate toggle-style room-effect legality from duplicate-at-cap failure checks so `trick-room`-style moves can remove an active room state instead of always failing as duplicates.
- [ ] Split move resolution into explicit spec phases for target validation, pre-hit legality, redirection, hit/immunity checks, main effect application, secondary effects, self-effects, and immediate faint processing.
- [x] Expand hit resolution to support always-hit moves that still respect stronger invalid/protection/immunity rules.
- [x] Route missing-active-target failures through move resolution so stale single-target actions emit explicit invalid-target outcomes instead of silently skipping during turn iteration.
- [x] Implement critical-hit stage behavior that ignores the required attacker and defender stage modifiers instead of only applying a flat damage multiplier.
- [x] Extend the critical-hit chance model beyond `focus-energy` so high-crit moves and crit-rate item hooks contribute their documented stage bonuses.
- [ ] Add the missing damage modifiers from the spec, including burn's physical-damage penalty, spread modifiers before final rounding, and any passive-trait or held-item hooks needed by the damage pipeline.
- [ ] Reorder the extracted damage pipeline so major-status, side, field, trait, item, and spread modifiers run in the spec-defined stage order instead of the current mixed base-damage path.
- [ ] Expand type-effectiveness handling to support the full effectiveness result set from `docs/battle.md`, including quarter and hyper-effective outcomes where applicable.
- [ ] Implement entry-hazard edge cases from the spec, including toxic-spikes absorption/blocking behavior and fixed hazard processing order when multiple hazards trigger together.
- [x] Make terrain damage/status checks and hazard/healing grounded-state logic respect gravity-based grounding without adding the full trait/item hook system.
- [ ] Complete the remaining field-effect rules for weather, terrain, gravity, and room effects so their legality, accuracy, damage, priority, and item-suppression interactions match the spec.
- [ ] Block grounded-target priority interactions under `psychic-terrain` during move resolution.
- [ ] Suppress held-item effects under `magic-room` once held-item runtime hooks exist.
- [ ] Reconcile `gravity` with semi-invulnerable charge states and other airborne move-specific exceptions.
- [ ] Implement passive-trait hooks as first-class timing windows across entry, action selection, move resolution, damage, switching, end-of-turn, and fainting.
- [ ] Implement held-item hooks, including passive modifiers, timed triggers, consumption rules, and suppression under magic-room-style effects.
- [ ] Route usable-in-battle `critical-rate` item activation through battle turn resolution so Dire Hit-style items apply their runtime crit-stage bonus without manual state mutation.
- [ ] Unify switching and forced-switch pipelines so every switch path consistently clears only the temporary state the spec says should reset, preserves the persistent state the spec says should remain, and applies switch-in triggers in the documented order.
- [ ] Add acceptance tests that mirror every behavior listed in the `docs/battle.md` acceptance criteria, especially PP exhaustion, fallback moves, deterministic tie breaks, draw resolution, spread moves, and status-duration rules.

## Game Systems

- [x] Introduce inventory systems that operate on world components instead of the `Inventory` wrapper class.
- [x] Introduce bestiary systems that operate on world components instead of the `Bestiary` wrapper class.
- [x] Add storage systems for moving creatures between party and boxes.
- [x] Add capture systems for converting encounter creatures into owned creatures.
- [x] Add experience and evolution systems that operate on world components.

## Selectors

- [x] Add selectors for player, party, inventory, bestiary, storage, and battle views.
- [x] Add selectors for creature summaries that combine static content with runtime components.
- [x] Keep selectors UI-oriented and free of mutation side effects.

## UI Integration

- [x] Move the current `src/ui/` placeholder from hardcoded text to selector-driven rendering.
- [x] Ensure the UI uses engine commands and selectors only, never direct state mutation.
- [x] Add battle-facing UI views that consume ordered engine events.
- [x] Add a small bootstrap flow in `src/index.ts` that demonstrates command dispatch and selector rendering.

## Cleanup

- [x] Remove or shrink legacy wrapper classes once the ECS replacements fully cover their use cases.
- [x] Remove duplicate concepts between battle runtime objects and world components.
- [x] Review JSDoc across the new engine files to ensure every exported symbol is documented.
- [x] Add focused tests for engine dispatch, selectors, and ECS world helpers.
- [ ] Add tests for the world systems in `src/game/systems/` (inventory, storage, bestiary, capture placement, experience/level math, evolution swap); today only `battle/`, `data/`, `world/`, and the engine boundary have coverage.
- [x] Revisit naming and folder boundaries once the battle refactor is complete.

## Review Findings 2026-07-06: Bugs

- [x] Persist battle outcomes back into the world: `writeBackPlayerBattleResults` (in `src/game/world/battle.ts`) copies final damage/status/PP into the persistent stores at battle finish (toxic downgraded to regular poison).
- [ ] Fix the hit check in `src/game/battle/battle.ts` (`moveCanConnect`): the early return when both accuracy and evasion stages are 0 skips the base-accuracy roll entirely, so 70%-accuracy and even 30%-accuracy moves never miss at neutral stages. `docs/battle.md` requires base accuracy to always be considered.
- [x] Clear `world.activeBattle[playerId]` on finish and reclaim battle/side/member mirrors + their entity ids (`cleanupBattle`, invoked from `Engine.startBattle` for ended battles); `activeBattle` is cleared in `finalizeBattle`.
- [x] Stop leaking transient battle entity ids into saves: `pickPersistentWorld` now filters `entities` to persistent-component owners, so `battle:*` ids never reach snapshots.
- [ ] Give the fallback move in `src/game/battle/systems/turn-order.ts` its documented behavior: it currently has no recoil and is typed `normal`, so type immunity zeroes it out; the spec expects a typeless last-resort attack with self-damage.
- [ ] Wire OHKO move content to the `ohko` effect: `FISSURE`, `GUILLOTINE`, and `SHEER_COLD` in `src/content/moves.ts` have `power: 0` and `effect: { kind: "none" }`, so they deal no damage at all.

## Review Findings 2026-07-06: Engine gaps for the Gen 3 target

- [x] Implement the capture formula: `computeCaptureAttempt` (in `src/game/systems/capture-system.ts`) runs the Gen 3 catch value + four-shake check, read through the `attempt-capture` command using the ball multiplier and target's live HP/status.
- [ ] Add EV yield to experience gain: experience is now awarded on victory (`awardBattleExperience`), but per-species `evYield` data and EV application on faint are still missing.
- [x] Add level-up move learning: crossing a level in `finalizeBattle` now resolves the species learnset via `movesLearnedBetween` (`src/game/systems/learn-system.ts`), auto-learns into a free slot (emitting `learned-move`) or emits `can-learn-move` when the four slots are full, and the `learn-move` command applies the player's replace/skip choice (`applyLearnedMove`/`learnMove`). `evolve-creature` still accepts any species swap without re-validating the rule.
- [x] Add the missing `Erratic` growth rate to `src/game/data/growth-rate.ts` (added to `GrowthRate` and `getExperienceForLevel`).
- [ ] Add per-creature instance state needed by Gen 2/3 mechanics: gender (species ratios exist but instances have none; breeding and attract depend on it), friendship (needed by `EvolutionMethod.Friendship`), and a held-item slot (needed by the planned held-item hooks).
- [ ] Extend evolution methods for Gen 3 coverage: trade-with-held-item, stat-comparison, and personality/random branches are missing, and `Evolution.ByFriendship` carries a `level` field that friendship evolutions do not use.
- [ ] Fix the damage modifier chain in `src/game/battle/systems/damage.ts` (`getBaseDamage`): screens, weather, and terrain modifiers are early returns, so only the first matching modifier applies instead of stacking in spec order.
- [ ] Make critical hits ignore Reflect/Light Screen per the Gen 3 rules, and document the chosen critical-hit chance table (the current 1/24 base is the modern table, not Gen 3's 1/16).
- [ ] Document (or revisit) modern-rule choices that differ from Gen 3: electric-type paralysis immunity, 50% paralysis speed cut, sleep duration 1-3, fixed rampage/confusion turn counts.
- [ ] Implement the breeding system specified in `docs/breeding.md` (egg groups and gender data exist; no system consumes them).

## Review Findings 2026-07-06: Architecture and extensibility

- [ ] Replace the per-call context objects in `src/game/battle/battle.ts` (`createMoveResolutionContext` exposes ~25 callbacks, plus damage/end-of-turn/roster variants) with a single `BattleContext` interface that `Battle` implements once; extracted systems currently cannot be understood or reused without the whole class, and every new mechanic must be threaded through the context lambdas.
- [ ] Split `MoveEffect` into pipeline modifiers vs. appliable actions, or move to timing-window hooks: about half the entries in the `Effects` resolver map are no-ops deferring to hardcoded pipeline steps, and adding one effect kind today touches the union, the resolver map, the pipeline, and often `isEffectBlockedByProtect`/`moveDealsDamage`. A hook/timing-window model would also be the natural home for the planned passive-trait and held-item hooks.
- [ ] Move type-tied mechanics out of engine code into data-driven type metadata: thaw-on-fire, status immunities by type, grounded-ness (`flying`), curse (`ghost`), identify (`ghost`/`normal`/`fighting`), toxic-spikes absorption (`poison`), weather immunities and boosts, terrain boosts, and charge consumption (`electric`) are all hardcoded against the fixed `Type` enum, which contradicts the content-agnostic goal.
- [ ] Replace the franchise-specific `ItemCategory` enum in `src/game/data/item.ts` (ApricornBalls, MegaStones, ZCrystals, DynamaxCrystals, TeraShard, …) with content-defined category strings; this is Pokemon vocabulary inside the engine layer.
- [x] Make `State` in `src/game/data/status.ts` a string enum (burn/paralysis/poison/sleep/freeze), so saved status is stable and renders directly.
- [ ] Rebuild volatile state on switch from `createCombatantVolatileState()` instead of the ~35-line manual field reset in `resetSwitchVolatiles`; every new volatile field added to state.ts must currently be remembered there by hand.
- [x] Thread a seedable RNG through `Engine` (`Engine.Options.random`) into every battle and into encounter/capture rolls, so engine-driven sessions are reproducible.
- [ ] Emit an explicit event when Protect blocks a move (nothing is emitted today, so a UI cannot narrate it) and consider a dedicated heal event instead of `damage-dealt` with `damage: 0`.
- [ ] Track attraction sources by battle position or creature id instead of holding a direct `Creature` object reference in `volatile.attractedBy`.
- [ ] Derive `pickPersistentWorld` from `PERSISTENT_WORLD_STORE_KEYS` instead of hand-listing the same keys a second time.
- [ ] Cache creature levels during battle: `getCreatureLevel` scans from level 100 downward on every call and is invoked several times per damage calculation.
- [ ] Enforce party/storage invariants in `src/game/systems/storage-system.ts`: depositing the last party member is currently allowed, boxes have no capacity, and ownership is not verified before moving a creature.
- [ ] Fix `syncBattleState` member mapping for multi-team sides: creature ids are resolved from `playerParty`/`enemyParty` by index, which is wrong once a side has more than one team (latent until multi-team battles are exposed).
- [ ] Delete or archive `agent-feedback.md`: it reviews the pre-ECS layout (`src/engine/`, `src/domain/`) and is now almost entirely stale.

## Move Learning

- [ ] Author full per-species level-up learnsets: only the three starter families (Bulbasaur/Ivysaur/Venusaur, Charmander/Charmeleon/Charizard, Squirtle/Wartortle/Blastoise) have accurate Gen 3 level-up entries wired into the learn flow in `src/content/species.ts`; every other species still needs its level-up moves authored so `movesLearnedBetween` (in `src/game/systems/learn-system.ts`) has data to work from.

## Review Findings 2026-07-06: Replay harness limitations

- [ ] Let the replay harness record a live session: the `Engine` (`src/game/engine.ts`) exposes neither a seed accessor nor a log of dispatched commands, so a `Recording` (`src/game/replay.ts`) can only be assembled by hand. Add a way to read the seed the engine booted with and to capture the ordered command stream so record-from-live-session becomes possible.
- [ ] Make `submit-battle-turn` replay-friendly: `getTurnActions` in `src/game/battle/systems/turn-order.ts` throws `RangeError("Turn command count must match the number of requested active slots.")` unless the submitted command count exactly matches the requested active slots. A blind multi-turn replay that does not re-read each turn's request count therefore crashes; the harness needs the request shape surfaced per turn (or a lenient submission path) to replay battles without live selector reads.

## Dev Tools: Sprite Drawing (Phase 1) follow-ups

- [ ] Assemble exported sprites into atlas `regions` for in-game rendering: `runSpriteExport` (in `src/dev/export.ts`) only registers the PNG under the manifest `images` map. A later phase should let the tool place a sprite into a named atlas region (manifest `atlases[id].regions`) so renderers can blit by region name, and/or pack multiple sprites into a single sheet.
- [ ] Consider extra editor affordances the Phase 1 tool omits: undo/redo history, a fill-bucket tool, an eyedropper, a recent-color palette, and importing an existing PNG back into the grid for editing. State currently lives entirely in `SpriteEditor`/`PixelGrid` (`src/dev/editors/`), so these are additive.
