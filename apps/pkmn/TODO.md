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
