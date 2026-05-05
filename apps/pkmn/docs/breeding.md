# Breeding

This document defines the complete breeding design for `apps/pkmn`.

It is written as an implementation-target specification for a modern mainline-style breeding system. The goal is to make breeding deterministic to implement, easy to test, and complete enough that another session can build it without filling in hidden rules.

## Design Goals

The breeding system must satisfy these goals:

- reflect modern mainline-style breeding behavior
- fully define breeding legality, egg production, hatch results, and inheritance
- keep family-specific exceptions data-driven whenever possible
- separate compatibility, egg generation, inheritance, and hatching into testable steps
- produce stable outcomes for the same inputs when randomness is controlled

## System Overview

Breeding is a multi-step process:

1. Two parents are evaluated for breeding compatibility.
2. Compatible parents are assigned a compatibility rating.
3. Over time, the pair may generate an egg.
4. The egg stores the resolved offspring blueprint at the moment the egg is created.
5. The egg accumulates hatch progress until it hatches.
6. Hatching creates a level 1 newborn with inherited species traits, moves, IVs, nature, ability, ball, form, and other resolved metadata.

The system must distinguish between:

- whether a pair is legally allowed to breed
- how likely that pair is to produce eggs
- what the egg will hatch into

## Terminology

- **Parent A / Parent B**: the two creatures placed into breeding.
- **Egg**: a breed output that has not hatched yet.
- **Newborn**: the creature created when an egg hatches.
- **Ditto parent**: a parent whose species belongs to `EggGroup.Ditto`.
- **Non-Ditto parent**: the other parent when breeding involves a Ditto parent.
- **Family source parent**: the parent that determines the offspring family.
- **Breedable base species**: the species normally produced by breeding for a family before special overrides are applied.
- **Compatibility rating**: the breeding affinity tier used to determine egg-generation odds.
- **Egg move**: a move specifically marked as breed-inheritable on the offspring species learnset.

## Required Data Model

Every species that participates in breeding must provide or be resolvable to the following data:

- egg groups
- gender distribution
- growth rate
- hatch cycle count
- learnset, including `level: 1` entries and `egg: true` entries
- standard ability pool and hidden ability pool if abilities exist
- breedable base species for the family, or enough family metadata to resolve it
- regional-form breeding metadata if the species has alternate forms
- family-specific overrides for offspring species if the family has exceptions
- family-specific move overrides if the family has special move inheritance rules

Every breeding parent must expose or be resolvable to the following runtime state:

- species
- current gender
- current moveset
- IVs
- nature
- ability
- held item
- capture ball
- original trainer identity
- shiny-related metadata if shininess exists
- current form if forms exist

Every egg must store or be able to recompute the following data:

- resolved offspring species
- resolved offspring form
- resolved ball
- resolved nature
- resolved IVs
- resolved ability
- resolved moveset
- resolved gender if gender is chosen at egg creation time
- hatch progress remaining
- shiny roll seed or resolved shiny state if eggs lock rarity at creation time

## Breeding Legality

Breeding always evaluates exactly two distinct creatures.

The same creature cannot be used as both parents.

### Absolute breeding bans

Breeding fails immediately if either parent belongs to `EggGroup.NoEggs`.

Breeding also fails immediately if both parents belong to `EggGroup.Ditto`.

### Ditto rule

If exactly one parent belongs to `EggGroup.Ditto`, breeding succeeds when the other parent:

- does not belong to `EggGroup.NoEggs`
- does not belong to `EggGroup.Ditto`

When a Ditto parent is involved, the other parent's gender does not matter.

This means Ditto can breed with:

- male species
- female species
- genderless species

This also means:

- two Ditto-group parents always fail
- Ditto never overrides a `NoEggs` restriction

### Non-Ditto rule

If neither parent belongs to `EggGroup.Ditto`, breeding succeeds only when all of the following are true:

- one parent is male
- one parent is female
- neither parent belongs to `EggGroup.NoEggs`
- the parents share at least one egg group

Shared egg-group logic uses overlap, not exact list equality.

If one species has two egg groups and the other shares either one of them, the pair is compatible.

### Genderless rule

A genderless species cannot breed with a non-Ditto parent.

A genderless species can breed with a Ditto parent, provided the species is not in `EggGroup.NoEggs`.

### Evolution-stage rule

Evolution stage does not change breeding legality.

If a species is legally breedable, any stage in that family can be used as a parent.

## Compatibility Rating And Egg Generation

Legal breeding pairs are assigned a compatibility rating. This rating does not decide legality. It decides how efficiently the pair produces eggs.

The compatibility rating uses these tiers:

### Maximum compatibility

Use this tier when:

- both parents are the same species
- the parents have different original trainers

### High compatibility

Use this tier when either of the following is true:

- both parents are the same species and have the same original trainer
- the parents are different species and have different original trainers

### Low compatibility

Use this tier when:

- the parents are different species
- the parents have the same original trainer

### No compatibility

Use this tier when the pair is illegal.

### Egg generation behavior

The breeding system must perform periodic egg-generation checks for legal pairs.

Each successful check creates one egg.

The check cadence and probability must be configurable, but the system must preserve the ordering relationship between compatibility tiers:

- maximum compatibility must produce eggs more often than high compatibility
- high compatibility must produce eggs more often than low compatibility
- illegal pairs must never produce eggs

If the game wants exact probabilities, they should be defined as constants in the breeding system. The spec requires compatibility tiers even if the exact percentages are tuned later.

## Family Source And Offspring Species

### Family source parent

If exactly one parent is a Ditto parent, the family source parent is the non-Ditto parent.

If neither parent is Ditto, the family source parent is the female parent.

### Default species rule

The offspring species is not simply the current species of the family source parent.

Instead, breeding first resolves the family source parent's family and then selects that family's breedable base species.

Examples:

- a fully evolved female still produces the family's normal breedable base species
- a fully evolved species bred with Ditto still produces the non-Ditto family's normal breedable base species

### Family-specific species overrides

Some families do not follow the default base-species result. The breeding system must support explicit offspring-species overrides for these cases.

The override layer is responsible for cases like:

- baby species that require incense-style items
- split baby outcomes within one family
- special mythical-family exceptions

The system must resolve offspring species in this order:

1. choose the family source parent
2. resolve the family's default breedable base species
3. apply family-specific override rules
4. finalize the egg's species

### Mandatory family-exception support

The breeding system must support data-defined exceptions for families with special offspring results, including the pattern used by species such as:

- families where breeding can produce one of multiple related base species
- families where the bred species differs from the parent species even beyond normal base-stage resolution
- families where a baby species appears only when item conditions are met

The implementation should not hardcode specific species names into generic breeding logic. Generic logic should consume family exception data.

## Form Resolution

If a species has multiple regional or special forms, the offspring form must be resolved explicitly.

### Default form rule

Breeding uses the offspring species' default breeding form unless a form-preservation rule overrides it.

### Form preservation with held items

An `Everstone`-style held item must preserve the holder's eligible regional lineage when the family supports that behavior.

If both parents hold a valid form-preserving item and both can influence the offspring form, the system must use a deterministic tie-break rule. A random choice between the eligible parents is acceptable if the randomness is controlled and testable.

### Form-resolution requirement

Form inheritance must be resolved before moves, ability, and gender are finalized, because those may depend on the resolved form's species data.

## Incense And Baby-Species Rules

The breeding system must support family-specific item checks that change the offspring species.

The intended pattern is:

- without the required incense-style item, breeding produces the normal base offspring for that family
- with the required item, breeding produces the baby species for that family

This rule must be data-driven because only some families use it.

The incense check belongs in species resolution, after the family source is known and before the egg species is finalized.

## Special Family Exceptions

The breeding system must support species-specific exception tables for families that do not fit the normal inheritance pattern.

This includes cases equivalent to:

- a parent species that can produce one of two sibling species
- a family where a mythical parent produces a distinct non-evolving offspring
- families whose offspring outcome depends on a held item or form state

The generic breeding algorithm must call a family-exception resolver instead of embedding special names in the main legality flow.

## Egg Creation Snapshot

When an egg is generated, the game must snapshot the egg's inherited blueprint immediately.

This blueprint must include:

- offspring species
- offspring form
- offspring nature
- offspring IVs
- offspring ability
- offspring moveset
- offspring ball
- hatch-cycle total or remaining progress
- shiny roll inputs or resolved shiny state

After the egg is created, later changes to the parents must not retroactively alter the egg.

This is important for deterministic saves, previews, and tests.

## Newborn Base State

When an egg hatches, it creates a newborn with the following state:

- level 1
- experience set to the minimum for level 1 in the species growth-rate table
- all EVs set to zero
- no persistent status condition
- zero damage
- full PP on all known moves
- no inherited nickname unless explicitly provided by some separate naming system

## Gender Resolution

The newborn's gender is resolved from the offspring species' gender distribution.

It is not copied from either parent.

Parent genders matter only for compatibility.

If the offspring species is:

- female-only, the newborn is always female
- male-only, the newborn is always male
- genderless, the newborn is always genderless
- mixed-gender, the newborn is rolled from the species distribution

If the game wants all egg contents locked at creation time, gender should be resolved when the egg is created rather than when it hatches.

## Nature Inheritance

### Default rule

The newborn's nature is random by default.

This applies whether or not a Ditto parent is involved.

### Everstone-style rule

If exactly one parent holds an `Everstone`-style item, the offspring inherits that parent's nature.

If both parents hold an `Everstone`-style item, the offspring inherits the nature of one of those parents, chosen by a deterministic random roll.

Nature inheritance must be resolved at egg creation time.

## IV Inheritance

The newborn's IVs are inherited stat-by-stat, not by copying one parent's entire IV spread.

### Baseline IV rule

Without held-item overrides:

- choose three distinct stats for inheritance
- for each chosen stat, choose Parent A or Parent B
- copy that parent's IV in that stat
- generate all remaining stats randomly

### Destiny Knot-style rule

If either parent holds a `Destiny Knot`-style item:

- choose five distinct stats for inheritance instead of three
- for each chosen stat, choose Parent A or Parent B
- copy that parent's IV in that stat
- generate the remaining unchosen stat randomly

If both parents hold the item, the result is still five inherited stats, not more than five.

### Power-item rule

Power-style held items force inheritance of a specific stat.

If one parent holds a valid Power item:

- that stat must be one of the inherited stats
- the inherited value for that stat must come from the holder of the item

If both parents hold valid Power items:

- if the items target different stats, one of those forced stats is chosen according to the game's tie-break rule, then the rest of the inherited slots are filled normally
- if both items target the same stat, that stat is forced and the owning parent is chosen according to the game's tie-break rule

When Power items and Destiny Knot-style inheritance are both active:

- the total number of inherited stats remains five
- the Power-item forced stat consumes one of those five inherited slots

### Ditto interaction

If one parent is a Ditto parent, it still participates normally in IV inheritance.

Ditto does not automatically force inheritance from the other parent.

## Ability Inheritance

If abilities exist in the game, the newborn's ability must be resolved from the offspring species' legal ability pool.

The system should model abilities using standard slots:

- standard ability slot 1
- standard ability slot 2 if the species has one
- hidden ability slot if the species has one

### Source parent for ability inheritance

In non-Ditto breeding, the female parent is the inheritance source.

In Ditto breeding, the non-Ditto parent is the inheritance source.

This means a male breeding with Ditto can pass ability traits because that male is the non-Ditto parent.

### Standard-ability rule

If the source parent has standard ability slot 1, the offspring should usually inherit slot 1, with the remaining chance going to other legal standard slots.

If the source parent has standard ability slot 2, the offspring should usually inherit slot 2, with the remaining chance going to other legal standard slots.

### Hidden-ability rule

If the source parent has a hidden ability, the offspring should have a chance to inherit the hidden ability, with the remaining chance distributed across the species' legal standard abilities.

### Probability requirement

The exact inheritance probabilities must be defined as constants in the breeding system and must preserve the modern-style bias toward the source parent's current ability slot.

The implementation must make these probabilities explicit and test them.

## Move Inheritance

The newborn's moveset is assembled in layers, then trimmed to four slots.

### Layer 1: level 1 moves

Start with all moves in the offspring species learnset marked for level 1.

These are always valid starting moves.

### Layer 2: egg moves

If either parent currently knows a move that is marked as an egg move for the offspring species, add that move.

An egg move is inheritable only when both of the following are true:

- the parent currently knows the move
- the offspring species learnset marks that move as `egg: true`

### Layer 3: family-specific move rules

The breeding system must support explicit special move rules that are not expressible as normal egg-move learnset data.

This is required for effects equivalent to item-based inherited moves in special families.

### Deduplication

If the same move appears from multiple sources, keep it only once.

### Ordering rule

The system must apply a deterministic move priority order before trimming.

The required order is:

1. special family-rule inherited moves
2. normal egg moves
3. level 1 moves

Within each group, preserve a stable ordering defined by the breeding system. The simplest acceptable ordering is content order.

### Trim rule

If more than four moves remain after inheritance:

- keep the first four moves after final ordering

### Empty slots

If fewer than four moves remain after inheritance:

- fill the remaining slots with empty move slots

## Special Move Exceptions

Some families require species-specific move rules that cannot be represented as normal egg moves.

The system must support a data-driven special move resolver for cases equivalent to:

- an item causing the offspring to know a specific move at hatch
- a family-specific override that injects a move regardless of normal egg-move tagging

This resolver runs before normal trim logic.

## Ball Inheritance

If the game tracks capture balls, each egg must resolve its inherited ball at egg creation time.

Use these rules:

- when breeding with Ditto, the non-Ditto parent passes its ball
- when breeding two non-Ditto parents of the same species, either parent can pass its ball, chosen by deterministic random roll
- when breeding two non-Ditto parents of different species, the female parent passes her ball

If a ball type is not legally inheritable, the egg must fall back to the default legal ball for newborn creation.

Ball legality exceptions must be defined as explicit data or constants.

## Shiny And Rare-Variant Resolution

If the game models shininess or similar rarity states, the egg must perform that roll at egg creation time.

The breeding system must support:

- base shiny odds
- trainer-origin bonuses such as different-language or different-origin breeding if the game models them
- shiny-charm-style player bonuses if that item exists

Any rarity-affecting modifiers must be folded into the egg's creation roll so the result is stable after the egg exists.

## Hatch Progress

Each egg must store a hatch-progress requirement based on the offspring species.

### Hatch-cycle rule

Every species has a hatch-cycle value.

An egg hatches only after its required hatch progress reaches zero.

### Progress reduction

The breeding system must define one or more actions that reduce hatch progress, such as:

- world movement
- step count
- time-based overworld updates

### Hatch-speed abilities

If the party or world state includes abilities that speed hatching, those modifiers must reduce hatch progress according to explicit constants.

The implementation must make those modifiers testable and deterministic.

## Resolution Order

Breeding must be resolved in a fixed order.

The required sequence is:

1. Validate that two distinct parents were provided.
2. Read both parents' species data and runtime breeding state.
3. Reject any parent in `EggGroup.NoEggs`.
4. Check whether either parent belongs to `EggGroup.Ditto`.
5. Reject the pair if both parents are Ditto-group species.
6. If exactly one parent is Ditto, mark the non-Ditto parent as the family source.
7. If neither parent is Ditto, validate male-plus-female pairing.
8. If neither parent is Ditto, validate that at least one egg group overlaps.
9. Resolve the pair's compatibility rating.
10. On a successful egg-generation check, resolve the family source's default breedable base species.
11. Apply family-specific species overrides, including incense and special-family rules.
12. Resolve offspring form.
13. Resolve offspring nature.
14. Resolve offspring IVs.
15. Resolve offspring ability.
16. Resolve offspring moveset, including special family move rules.
17. Resolve offspring ball.
18. Resolve offspring gender if eggs lock gender at creation time.
19. Resolve shiny or rare-variant state if present.
20. Create the egg snapshot with hatch progress and all inherited blueprint data.
21. Reduce hatch progress through gameplay until it reaches zero.
22. Hatch the egg into a level 1 newborn using the stored egg snapshot.

## Canonical Rules Summary

The breeding system follows these rules:

1. Species in `EggGroup.NoEggs` cannot breed.
2. Two Ditto-group species cannot breed.
3. A single Ditto-group parent can breed with any eligible non-Ditto species, including genderless species.
4. Two non-Ditto parents can breed only when one is male, one is female, and they share at least one egg group.
5. Evolution stage does not affect breeding legality.
6. Legal pairs receive a compatibility rating that determines egg-generation efficiency.
7. The family source is the female parent, or the non-Ditto parent when Ditto is involved.
8. The offspring species is the family's breedable base species unless family-specific rules override it.
9. Family-specific rules must support incense-style babies, split-family outcomes, and other exceptional offspring mappings.
10. Form inheritance must be resolved explicitly and can be preserved by an `Everstone`-style item when the family allows it.
11. Eggs snapshot all inherited outcomes at the moment the egg is created.
12. Newborns hatch at level 1 with level 1 experience, zero EVs, no status, zero damage, and full PP.
13. The newborn's gender comes from the offspring species' gender distribution.
14. Nature is random by default, unless an `Everstone`-style item overrides it.
15. IVs are inherited stat-by-stat, with three inherited by default and five inherited when a `Destiny Knot`-style item is active.
16. Power-style items force inheritance of specific stats and interact with the five-stat cap rather than exceeding it.
17. Ditto participates normally in IV inheritance and does not force inheritance from the other parent.
18. Ability inheritance is sourced from the female parent or non-Ditto parent and must preserve a strong bias toward that parent's ability slot.
19. The newborn starts with level 1 moves, valid egg moves known by either parent, and any family-specific special inherited moves.
20. The final moveset is deduplicated, ordered deterministically, and trimmed to four moves.
21. Ball inheritance follows parent-role rules and must enforce ball legality.
22. Shiny and other rarity rolls, if present, are resolved when the egg is created.
23. Every egg has hatch progress derived from offspring species hatch cycles.
24. Hatch-speed modifiers must apply through explicit, testable constants.

## Acceptance Criteria

An implementation of this spec is correct only if all of the following behaviors are test-covered:

- a `NoEggs` parent always blocks breeding
- two Ditto-group parents always fail
- Ditto can breed with a genderless eligible species
- non-Ditto mixed-gender parents with any overlapping egg group can breed
- non-Ditto parents with no overlapping egg group cannot breed
- offspring species comes from the female family in normal breeding
- offspring species comes from the non-Ditto family in Ditto breeding
- evolved parents still produce the breedable base species unless an exception applies
- incense-style and family-specific species overrides change the offspring result correctly
- `Everstone`-style rules correctly lock nature and preserve form when applicable
- IV inheritance uses three stats by default and five with `Destiny Knot`-style rules
- Power-style items force the expected inherited stat
- Ditto participates in IV inheritance like a normal parent
- valid egg moves known by either parent are inherited
- level 1 moves are always included before trimming
- special family inherited moves are applied before trimming
- duplicate moves are removed
- movesets above four moves are trimmed deterministically
- ability inheritance uses the correct source parent and legal ability pool
- ball inheritance follows the correct parent-role rule
- shiny or rarity state is stable after egg creation
- changing parents after egg creation does not alter the egg's stored outcome
- hatch progress decreases correctly and produces the stored newborn when complete

## Implementation Shape

The system should be implemented as pure decision layers plus stateful orchestration.

The pure decision surface should map closely to functions like:

- `canBreed(parentA, parentB)`
- `getBreedingCompatibility(parentA, parentB)`
- `resolveOffspringSpecies(parentA, parentB)`
- `resolveOffspringForm(parentA, parentB, species)`
- `resolveOffspringNature(parentA, parentB)`
- `resolveOffspringIv(parentA, parentB)`
- `resolveOffspringAbility(parentA, parentB, species)`
- `resolveOffspringMoves(parentA, parentB, species)`
- `resolveOffspringBall(parentA, parentB, species)`
- `createEgg(parentA, parentB, context)`
- `advanceEggHatching(egg, context)`
- `hatchEgg(egg)`

This separation keeps legality, inheritance, egg creation, and hatching independently testable while still supporting the full rules defined above.
