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

- [ ] Implement PP legality, PP spending-on-commit, and the fallback move flow when no regular move can be selected.
- [ ] Replace the current equal-speed tie breaker with deterministic RNG-based action ordering that matches the battle spec.
- [ ] Distinguish in battle result resolution between an unfinished battle and a simultaneous-elimination draw, and emit the correct finished event for draw outcomes.
- [ ] Add full start-of-turn major-status handling, including sleep turn tracking, wake-up rules, freeze thaw checks, thaw-on-use rules, and paralysis action loss.
- [ ] Expand major-status application legality to cover type immunities, terrain prevention, and other battle-state restrictions defined in `docs/battle.md`.
- [ ] Implement toxic-style poison tracking and escalating residual damage when the applied poison variant requires it.
- [ ] Add the missing volatile-condition rules from `docs/battle.md`, including infatuation duration/behavior, identify state interactions, and any unimplemented lock, charge, or delayed-action states.
- [ ] Rework move targeting so actions can target a combatant, ally, side, or the battlefield instead of always requiring a single active-slot target.
- [ ] Implement targeting-class-based doubles behavior, including adjacency rules, ally targeting, invalid-target failure vs retargeting, and spread targeting.
- [ ] Implement spread-move damage reduction and per-target protection/immunity resolution for multi-target moves in doubles.
- [ ] Add explicit pre-hit failure checks for move rules such as first-active-turn requirements, duplicate side or field effects at cap, minimum-HP floor rules, and user-damaged-this-turn requirements.
- [ ] Split move resolution into explicit spec phases for target validation, pre-hit legality, redirection, hit/immunity checks, main effect application, secondary effects, self-effects, and immediate faint processing.
- [ ] Expand hit resolution to support always-hit moves that still respect stronger invalid/protection/immunity rules.
- [ ] Implement critical-hit stage behavior that ignores the required attacker and defender stage modifiers instead of only applying a flat damage multiplier.
- [ ] Add the missing damage modifiers from the spec, including burn's physical-damage penalty, spread modifiers before final rounding, and any passive-trait or held-item hooks needed by the damage pipeline.
- [ ] Expand type-effectiveness handling to support the full effectiveness result set from `docs/battle.md`, including quarter and hyper-effective outcomes where applicable.
- [ ] Implement entry-hazard edge cases from the spec, including toxic-spikes absorption/blocking behavior and fixed hazard processing order when multiple hazards trigger together.
- [ ] Complete field-effect rules for weather, terrain, gravity, and room effects so their legality, grounded-state, accuracy, damage, status-prevention, and item-suppression interactions match the spec.
- [ ] Implement passive-trait hooks as first-class timing windows across entry, action selection, move resolution, damage, switching, end-of-turn, and fainting.
- [ ] Implement held-item hooks, including passive modifiers, timed triggers, consumption rules, and suppression under magic-room-style effects.
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
- [x] Revisit naming and folder boundaries once the battle refactor is complete.
