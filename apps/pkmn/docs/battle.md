# Battle System

This document defines the complete battle design for `apps/pkmn`.

It is written as an implementation-target specification for a modern mainline-style turn-based battle system. The goal is to make battle behavior deterministic to implement, easy to test, and complete enough that another session can build it without filling in hidden rules.

## Design Goals

The battle system must satisfy these goals:

- reflect modern mainline-style turn-based battle behavior
- fully define action selection, action ordering, move resolution, status, switching, and battle completion
- separate combatant state, side state, battlefield state, and resolution phases into testable layers
- keep move, species, passive-trait, item, and effect behavior data-driven whenever possible
- produce stable outcomes for the same inputs when randomness is controlled

## System Overview

Battle is a multi-step process:

1. A battle is initialized with two sides, a chosen format, and initial active combatants.
2. The battle snapshots all required runtime state for combatants, sides, and the battlefield.
3. Each turn begins with start-of-turn rule checks.
4. Each active combatant chooses or is assigned one action.
5. All actions are validated, ordered, and resolved.
6. Immediate fainting and replacement are processed as soon as they occur.
7. End-of-turn effects are resolved in a fixed order.
8. The battle repeats until one side wins or the result is a draw under the format rules.

The system must distinguish between:

- whether an action is legal to choose
- whether a chosen action still resolves successfully
- whether an action hits its target
- whether a hit produces direct damage, non-damaging effects, or both
- whether the battle can continue after fainting and replacement checks

## Terminology

- **Battle**: a self-contained combat encounter between two sides.
- **Side**: one team in battle.
- **Combatant**: a creature participating in battle.
- **Active combatant**: a combatant currently on the field.
- **Reserve**: a combatant on a side that is not currently active.
- **Action**: a turn choice such as using a move or switching.
- **Move**: an action entry with `type`, `damageClass`, `power`, `accuracy`, `pp`, and `effect`.
- **Target**: the combatant, side, or battlefield scope a move is attempting to affect.
- **Priority**: the move-order modifier used before speed comparison.
- **Major status**: a persistent condition such as burned, paralyzed, poisoned, asleep, or frozen.
- **Volatile condition**: a temporary in-battle condition such as confusion, flinch, taunt, encore, disable, infatuation, protection, trapping, charge, or recharge.
- **Stat stage**: a temporary in-battle modifier applied to a battle stat, `accuracy`, or `evasion`.
- **Side effect**: a persistent effect attached to one side, such as screens, speed boosts, or entry hazards.
- **Field effect**: a persistent effect shared by the battlefield, such as weather, terrain, gravity, or room-state changes.
- **Passive trait**: an always-on or event-driven creature rule associated with species, form, or temporary battle identity.
- **Held item**: an item carried by a combatant that can modify battle rules while active.
- **Usable combatant**: a combatant that has not fainted and is still eligible to enter battle.
- **Faint**: the moment a combatant reaches zero `hp` and can no longer remain active.

## Required Data Model

Every species used in battle must provide or be resolvable to the following data:

- one or two defensive `types`
- base stats
- size and weight data for size-based and weight-based move rules
- legal passive-trait pool
- legal form data for any species that can change battle form
- learnable move data or enough move references to build a legal moveset

Every move used in battle must provide or be resolvable to the following data:

- offensive `type`
- `damageClass`
- base `power`
- base `accuracy`
- base `pp`
- targeting class
- move `effect`
- whether the move makes contact
- whether the move is sound-based, powder-based, ballistic, slicing, punch-based, or otherwise specially tagged
- any special flags required for protection, redirection, immunity, or spread resolution

Every held item used in battle must provide or be resolvable to the following data:

- passive stat modifiers while held
- on-hit, on-damage, on-threshold, or end-of-turn triggers
- immunity, curing, healing, recoil, or damage-amplification rules
- whether the item is consumed and under what conditions
- whether the item can be suppressed by battlefield state

Every passive trait used in battle must provide or be resolvable to the following data:

- timing windows in which it can trigger
- modifiers to damage, targeting, speed, immunities, switching, or status
- whether it is suppressible
- whether it changes the combatant's active form, `type`, or battle identity

Every battle format must provide or be resolvable to the following data:

- number of active combatants per side
- legal target classes for each move target type
- spread-damage rules
- replacement requirements
- win, loss, and draw conditions

Every combatant that enters battle must expose or be resolvable to the following runtime state:

- species
- current form if forms exist
- level
- current and maximum `hp`
- permanent stats and current effective battle stats
- current moveset
- current `pp` for each move slot
- current major `status`
- current volatile conditions
- current stat stages
- passive trait
- held item
- whether the combatant is active, in reserve, or fainted
- whether the combatant is grounded
- whether the combatant is trapped
- whether the combatant is identified
- any move lock, recharge, charge, or delayed-attack state

Every side in battle must store or be able to recompute the following data:

- active combatants
- reserve combatants
- active `side effects`
- hazard layers and durations where relevant
- redirection state if active
- whether the side still has any usable combatants

Every battle instance must store or be able to recompute the following data:

- active weather-like `field effect`
- active terrain-like `field effect`
- active room-state `field effect`
- active `gravity` state
- turn number
- deterministic RNG state or event stream if the battle must be reproducible

## Battle Setup

Before the first turn begins, the battle system must:

1. validate the battle format
2. load both sides and their legal combatants
3. assign the starting active combatants for each side
4. initialize combatant, side, and battlefield state
5. apply any on-entry passive-trait, held-item, or `field effect` initialization rules
6. verify that the battle can legally begin

If the chosen format is doubles, each side must fill both active slots if enough usable combatants exist.

## Battle Formats

### Single battles

In a single battle:

- each side has exactly one active combatant at a time while it has usable combatants
- each side chooses one action per turn
- most targeted moves affect one combatant, one side, the user, or the battlefield

### Double battles

In a double battle:

- each side has up to two active combatants at a time
- each active combatant chooses one action per turn unless blocked by a forced state
- targeting legality is part of action selection
- some moves affect one target, some affect multiple targets, and some affect a side or the battlefield

### Shared format rule

Unless a rule explicitly depends on the number of active combatants, the same legality, hit, damage, status, switching, and timing rules apply across singles and doubles.

## Battle State

Battle state is divided into combatant state, side state, and battlefield state.

### Combatant state

Each combatant must track at least:

- species identity and active `types`
- current level
- current `hp`
- maximum `hp`
- permanent stats
- current effective attack, defense, special attack, special defense, and speed values
- current move set and current move `pp`
- current major `status`, if any
- current volatile conditions
- stat stages for battle stats
- `accuracy` and `evasion` stages
- passive trait
- held item
- whether it is grounded
- whether it is trapped
- whether it is identified
- whether it is active, in reserve, or fainted

### Side state

Each side must track:

- active combatants
- reserves
- active protective `side effects`
- active entry hazards
- side-specific speed modifiers such as `tailwind`
- side-wide protection such as `safeguard` or `lucky-chant`
- whether redirection is active

### Battlefield state

The battlefield must track:

- weather state
- terrain state
- room-state effects
- global modifiers such as `gravity`
- turn counters for persistent effects
- any delayed global resolutions waiting for a future turn

## Action Selection

Each active combatant chooses one action per turn unless a forced state overrides choice.

### Standard action types

The standard actions are:

- use a move with available `pp`
- switch to a reserve combatant

### Forced-action states

Some combatants do not get free choice.

Examples include:

- recharge turns
- move-lock turns from rampage-style effects
- encore
- charge-turn continuation
- delayed move execution that was committed on a previous turn

### Target selection

If a move requires a target, target selection is part of action selection.

Target legality depends on:

- battle format
- move targeting class
- whether the target is currently active
- whether adjacency matters in doubles
- whether redirection rules are already active
- whether the move can legally affect that target under current immunities or state restrictions

### Illegal actions

An action is illegal when one or more requirements are not satisfied.

Examples include:

- selecting a move with zero `pp`
- selecting a disabled move
- selecting a non-damaging move while taunted
- selecting a switch while trapped
- selecting a target that is not legal for the move
- attempting to send in a fainted reserve combatant
- attempting to switch into a slot already occupied by another active combatant in doubles

If a combatant has no selectable move because all moves are unusable, it must use the fallback move.

## Start-Of-Turn Rule Checks

Before actions resolve, the battle system must evaluate all start-of-turn rules that can block, replace, or modify a combatant's action.

These checks include:

- sleep duration and wake-up rules
- freeze thaw checks and thaw-on-use rules
- flinch
- recharge
- charge-turn continuation
- encore legality
- disable legality
- taunt restrictions
- trapping restrictions for switching
- passive-trait and held-item rules that trigger before action order

The output of this phase is one of:

- the chosen action remains legal
- the chosen action is replaced with a forced legal action
- the combatant fails to act

## Action Ordering

Actions do not resolve only by selection order.

The standard ordering model is:

1. required replacement timing
2. switch timing
3. move `priority`
4. effective `Stat.Speed`
5. deterministic random tie-break

### Replacement timing

If a combatant fainted and a replacement is required before later actions can proceed, replacement occurs before the battle continues to any step that requires an active combatant in that slot.

### Switch timing

Normal switches resolve before standard-priority moves unless a move or effect explicitly overrides that rule.

### Priority

Moves can alter action order through their `effect`.

Higher `priority` resolves first.

### Effective speed

Effective `Stat.Speed` is computed from:

- the combatant's permanent speed stat
- speed stat stages
- major `status` penalties
- passive-trait modifiers
- held-item modifiers
- `side effects` such as `tailwind`
- `field effects` such as `trick-room`

### Trick-room rule

When `trick-room` is active, slower effective speed acts before faster effective speed among otherwise tied-priority actions.

### Tie-break rule

If priority and effective speed are tied, the acting order is chosen by battle RNG.

The RNG source must be deterministic and testable.

## Move Resolution

Moves resolve through ordered phases rather than one monolithic calculation.

### Resolution sequence

The required sequence is:

1. confirm the user is still active and able to resolve the move
2. spend `pp`
3. validate the target or retargeting behavior
4. apply pre-hit legality and failure checks
5. apply redirection if the move is redirectable and a redirection effect is active
6. run hit and immunity checks
7. apply direct damage or the move's main non-damaging effect
8. apply secondary effects
9. apply follow-up self-effects such as recoil, self-switching, self-knockout, or recharge setup
10. process immediate fainting

### Pre-hit failure checks

A move fails before the hit check when a rule prevents it from taking effect.

Examples include:

- the user fainted before acting
- the move can be used only on the first active turn and that requirement is no longer true
- the move fails because its target or battlefield state no longer satisfies the move's requirements
- the move tries to apply a `side effect` or `field effect` that is already at its valid limit
- the move cannot KO and the target is already at the minimum health that rule allows
- the move requires the user not to have been damaged this turn and that requirement is not met

### Target loss and retargeting

If the original target is no longer valid:

- in singles, the move usually fails if it required that target
- in doubles, the move either fails, retargets a remaining legal target, or continues affecting the battlefield or side according to its targeting class

Retargeting behavior must be explicit per targeting class.

## Accuracy, Evasion, And Hit Checks

For moves that can miss, the battle system must perform a hit check.

The hit check must consider:

- move base `accuracy`
- user `accuracy` stage
- target `evasion` stage
- passive-trait modifiers
- held-item modifiers
- `field effects` such as `gravity`
- move-specific always-hit or restricted-hit rules
- protection, immunity, or target-state rules that bypass or override normal accuracy logic

### Always-hit rule

Some moves bypass the standard accuracy check.

These moves still fail if a stronger rule makes the target invalid, protected, or immune.

### Immunity rule

A move can pass its accuracy check and still fail to affect the target because of immunity.

Immunity can come from:

- `type` interaction
- passive traits
- held items
- battlefield effects
- side protection
- volatile conditions or target-state rules

### Miss results

If a move misses:

- direct damage is not dealt
- most target-facing effects do not apply
- miss-specific penalties still apply if the move defines them

## Damage Classes

Direct damage is controlled by `damageClass`.

### Physical damage

Physical moves use:

- attacking stat: `Stat.Attack`
- defending stat: `Stat.Defense`

### Special damage

Special moves use:

- attacking stat: `Stat.SpecialAttack`
- defending stat: `Stat.SpecialDefense`

### Status moves

Status moves usually do not deal direct damage.

They instead apply battle state changes such as:

- major `status`
- volatile conditions
- stat stage changes
- healing
- protection
- forced switching
- `side effects`
- `field effects`

## Damage Calculation

The battle system must apply damage modifiers in a stable conceptual order that matches modern battle behavior.

For standard damaging moves, the relevant factors are:

1. attacker level
2. move `power`
3. attacking and defending stats based on `damageClass`
4. same-type attack bonus if the move `type` matches one of the user's active `types`
5. critical-hit modifier
6. random variance
7. `type` effectiveness against the target's defensive `types`
8. major-status penalties when applicable
9. passive-trait modifiers
10. held-item modifiers
11. `side effect` modifiers such as screens
12. `field effect` modifiers such as weather, terrain, or room-state changes
13. spread-damage modifiers in doubles

### Same-type attack bonus

When a move `type` matches one of the user's active `types`, the move gains a same-type attack bonus.

If a passive trait or other battle rule increases that bonus, the modifier is applied in the same stage of the damage calculation.

### Random variance

Damaging moves do not deal a single fixed value under identical conditions unless the move is a fixed-damage move.

The battle system must use bounded random variance so repeated uses under identical state can still produce slightly different damage.

### Critical hits

Critical hits are a core part of normal battle resolution.

The battle system must support:

- a critical-hit chance model
- critical-hit stage modifiers such as focus-energy-style effects
- passive-trait and held-item modifiers to critical-hit chance
- damage amplification on a critical hit
- modern-style stat-override behavior where some negative attacker modifiers and some positive defender modifiers are ignored by the critical hit

### Spread damage

In doubles, a move that damages multiple targets deals reduced direct damage to each affected target compared with a single-target version of the same hit.

This spread modifier must be applied before final rounding.

### Minimum-damage rule

If a damaging move successfully affects a target and is not nullified by immunity or protection, the final direct damage must be at least 1 unless the move uses a special damage rule that explicitly says otherwise.

## Type Effectiveness

Each move has one offensive `type`.

Each species has one or two defensive `types`.

When a damaging move hits:

- the move `type` is compared against the target's defensive `types`
- each matchup contributes an `Effectiveness` multiplier
- if the target has two defensive `types`, the multipliers are combined

The system must support these results:

- `Effectiveness.ZERO`
- `Effectiveness.WEAK`
- `Effectiveness.NORMAL`
- `Effectiveness.SUPER`
- `Effectiveness.QUARTER`
- `Effectiveness.HYPER`

### Type-immunity rule

If the combined result is `Effectiveness.ZERO`, the damage portion of the move fails.

Other move effects either fail or still apply according to that move's rules.

### Type modification

Passive traits, held items, and move effects can modify the user's active `types`, the target's defensive `types`, or how matchups are evaluated.

Those modifications must be applied before the effectiveness calculation for the affected hit.

## Direct-Damage Variants

Not all damaging moves use the standard power-based formula.

The battle system must support these damage families:

- fixed numeric damage
- damage equal to the user's current `hp`
- one-hit knockout moves
- recoil-based damaging moves
- drain moves
- damage based on speed, weight, current health, or target health difference
- damage that doubles under specific conditions
- delayed attacks that resolve on a later turn
- counter-style moves based on recently received damage
- multi-hit damaging moves

### Fixed-damage moves

These deal a defined amount on hit rather than using the standard damage formula.

### One-hit knockout moves

These attempt to reduce the target to zero `hp` on a successful connection if their accuracy and special rules allow it.

### Recoil moves

These damage the target, then damage the user according to a recoil rule.

The recoil rule can depend on damage dealt, the user's max health, or a miss-specific penalty.

### Drain moves

These heal the user for a fraction of the damage dealt or according to move-specific restrictions.

### Delayed attacks

These create a future-hit event instead of dealing damage immediately.

The battle state must store enough information to resolve the hit correctly on the future turn.

### Multi-hit moves

These resolve as more than one hit from a single move execution.

The battle system must define:

- how many hits occur
- whether the hit count is fixed or rolled
- whether each hit checks for target survival before continuing
- when on-hit passive traits, held items, and recoil-like rules trigger

## PP Rules

Each move has a limited `pp` count.

### Spending PP

`pp` is spent when the move is committed for use, not only when it successfully damages the target.

If a move is blocked or fails after being committed, the `pp` normally remains spent unless a rule explicitly restores it.

### Zero-PP rule

A move with zero `pp` cannot be selected.

If a combatant has no selectable move with remaining `pp`, it must use the fallback move.

### Fallback move

The fallback move is part of the battle system.

It must:

- always be available when no regular move can be selected
- damage the target
- cause self-damage as recoil
- ignore the combatant's normal move list

## Stat Stages

Battle uses temporary stat stages in addition to permanent stats.

Stat stages apply to:

- `attack`
- `defense`
- `special-attack`
- `special-defense`
- `speed`
- `accuracy`
- `evasion`

### Stage bounds

Each stage has a minimum and maximum value.

Attempts to raise a stage above the maximum or lower it below the minimum fail for that portion of the effect.

### Stage targeting

Stage changes can target:

- the user
- one target
- multiple active combatants if the move effect says so

### Stage persistence

Stat stages are battle-only state.

They normally clear when a combatant leaves active play.

If a move effect preserves stat stages through switching, that preservation must be explicit.

## Major Status Rules

Major `status` conditions are persistent conditions that stay on a combatant until cured, replaced by an explicit rule, or the battle ends.

The core major statuses are:

- burned
- paralyzed
- poisoned
- asleep
- frozen

### One-major-status rule

A combatant normally cannot have more than one major status at a time.

If a move tries to apply a major status to a target that already has one, that application fails unless an explicit override exists.

### Burned

Burned combatants:

- take residual damage at end of turn
- usually deal reduced physical damage

### Paralyzed

Paralyzed combatants:

- have reduced effective speed
- lose turns to full paralysis according to the battle RNG

### Poisoned

Poisoned combatants:

- take residual damage at end of turn
- use escalating toxic-style damage when the applied poison variant says so

### Asleep

Asleep combatants:

- normally cannot act
- remain asleep for a limited duration
- interact specially with moves that require a sleeping user or target

### Frozen

Frozen combatants:

- normally cannot act
- thaw over time according to the freeze-resolution rules
- thaw from specific move interactions or move use rules

### Status immunities

A status application can fail because of:

- `type` immunity
- passive-trait immunity
- held-item immunity
- `side effects` such as `safeguard`
- `field effects` such as terrain-based anti-status rules

## Volatile Conditions

Volatile conditions are temporary battle-only states that can coexist with a major status.

The battle system must support at least these common volatile conditions:

- confusion
- flinch
- taunt
- encore
- disable
- infatuation
- trapping
- partial trapping
- protect
- endure
- destiny-bond
- identify
- focus-energy
- charge state
- recharge state
- healing-wish-style pending replacement effects
- substitute-style damage interception if the move set supports it

### Volatile-condition requirements

Each volatile condition must define:

- owner
- duration if any
- whether it blocks action selection, move success, switching, or targeting
- whether it ends on switching
- whether it is consumed on use, on hit, or at turn end

### Confusion

Confusion is a turn-limited condition.

On a confused turn, the combatant either acts normally or hurts itself instead of executing its move.

### Flinch

Flinch prevents action for the current turn only, and only if the combatant has not already acted.

### Taunt

Taunt prevents selection of non-damaging moves for its duration.

### Encore

Encore forces repetition of the last used move while that move remains legal.

### Disable

Disable prevents one specific move slot from being used for its duration.

### Trapping

Trapping prevents switching.

Partial trapping also applies residual damage for a limited number of turns.

### Protect

Protection effects block or reduce incoming move effects for the current turn according to their rule.

Repeated use must use the format's declining-success model.

### Endure

Endure-style effects allow the user to survive qualifying damaging hits at 1 `hp` for the current turn.

## Side Effects

`Side effects` are persistent effects attached to one side.

They include protective effects and entry hazards.

### Protective side effects

The battle system must support at least these common protective `side effects`:

- `reflect`
- `light-screen`
- `mist`
- `safeguard`
- `lucky-chant`
- `tailwind`

These effects:

- last a fixed number of turns
- affect only the owning side
- expire when their duration reaches zero

### Reflect and light-screen

These reduce incoming direct damage from one `damageClass` for a limited duration.

### Mist

This prevents allied combatants from having their stat stages lowered by opponents while active.

### Safeguard

This prevents most new major status applications to allied combatants while active.

### Lucky chant

This prevents critical hits against that side while active.

### Tailwind

This boosts effective speed for that side for a limited duration.

### Entry hazards

The battle system must support at least these common entry hazards:

- `spikes`
- `toxic-spikes`
- `stealth-rock`
- `sticky-web`

These apply when a combatant enters the field on the affected side.

### Hazard timing

Hazards resolve immediately when a combatant becomes active through switching or forced replacement.

If multiple hazards apply, they must be processed in a fixed order.

### Hazard details

`spikes` deals entry damage to grounded targets.

`toxic-spikes` applies poison to grounded targets unless blocked, absorbed, or invalid.

`stealth-rock` deals entry damage based on the target's `type` interaction with the hazard's attack `type`.

`sticky-web` lowers speed on entry for grounded targets.

### Hazard layers

Layer-based hazards must define their maximum layer counts and the effect of each layer count.

## Field Effects

`Field effects` apply to the whole battlefield.

They include weather, terrain, room-state effects, and gravity.

### Weather

The battle system must support at least these weather-like `field effects`:

- `sun`
- `rain`
- `sand`
- `hail`
- `snow`
- `fog`

Weather is mutually exclusive.

Weather commonly affects:

- move power for selected `types`
- end-of-turn residual damage or defensive bonuses
- passive-trait activation
- move accuracy or special move behavior

### Terrain

The battle system must support at least these terrain-like `field effects`:

- `electric-terrain`
- `grassy-terrain`
- `misty-terrain`
- `psychic-terrain`

Terrain generally affects grounded combatants only.

Terrain can:

- boost selected move `types`
- block or reduce specific status, sleep, or priority interactions
- provide healing or other end-of-turn effects

### Room effects

The battle system must support at least these room-state `field effects`:

- `trick-room`
- `wonder-room`
- `magic-room`

`trick-room` inverts standard speed order.

`wonder-room` swaps defensive calculations between the two defense stats.

`magic-room` suppresses held-item effects while active.

### Gravity

`gravity` changes hit rules and grounded-state interactions while active.

It affects move accuracy and mechanics that depend on whether a target is airborne or grounded.

## Passive Traits

Passive traits are part of normal battle resolution and must be treated as first-class rules.

Passive traits can affect:

- battle stats
- move power
- move `priority`
- immunities
- status application
- weather and terrain interaction
- switching triggers
- healing and recoil
- hit reactions
- form changes
- move targeting or redirection immunity

### Passive-trait timing

Passive traits can trigger at these timing windows:

- on battle entry
- before action selection
- before move resolution
- during hit calculation
- during damage calculation
- after taking damage
- on switching
- at end of turn
- on fainting

### Passive-trait suppression

If battle state suppresses passive traits, the system must define:

- whether suppression is global or local
- whether already-established effects remain active
- when suppressed traits resume functioning

## Held Items

Held items are part of normal battle resolution.

Held items can affect battle through rules such as:

- move selection
- action order
- damage dealt or taken
- healing
- status immunity or curing
- stat changes
- hit reactions
- transformation or form state
- passive-trait-like triggers

### Held-item timing

Held items can trigger:

- passively while held
- on switch-in
- when HP crosses a threshold
- after a hit connects
- before fainting
- at end of turn

### Held-item suppression

If a battle effect suppresses held items, suppressed items do not apply their effects until suppression ends.

## Switching Rules

Switching is both a standard action and a consequence of some move effects.

### Normal switching

When a side switches:

1. the current active combatant leaves active play
2. most combatant-only volatile conditions end
3. stat stages reset unless an explicit rule preserves them
4. a reserve combatant becomes active
5. switch-in passive traits and held-item rules trigger
6. entry hazards and other on-entry effects resolve
7. the new combatant becomes eligible for later action checks

### What switching does not clear

Switching normally does not clear:

- major `status`
- permanent stat values
- move `pp` changes
- already-consumed held-item state

### Forced switching

Some moves force the target or user to switch.

Forced switching must use the same core switch pipeline as a normal switch.

### Switching restrictions

A combatant cannot switch when:

- it is trapped by an active effect
- no legal reserve combatant exists
- the battle format or encounter rule forbids switching

## Multi-Turn Moves And Locked States

Some moves create multi-turn commitments.

The battle system must support these patterns:

- charge on one turn and attack on a later turn
- recharge after use
- repeated attacks across multiple turns
- rampage-style move locking
- delayed future hits

Each pattern must define:

- when the commitment starts
- whether the user can be interrupted
- whether switching or fainting cancels the effect
- when the commitment ends

## Redirection, Protection, And Contact Reactions

### Redirection

Redirection effects change which combatant becomes the target of a move.

Redirection must be applied before hit and damage resolution.

### Protection

Protection effects can:

- block direct damage
- block many targeted move effects
- fail against protection-breaking moves
- use a declining success model on repeated use

### Contact reactions

If a move is tagged as making contact, passive traits and held items that react to contact must trigger at the defined hit-reaction timing window.

The battle system must define whether those reactions occur before or after follow-up self-effects such as recoil.

## Transformation, Form Change, And Identity Changes

Some battle rules alter a combatant's active identity during battle.

The battle system must support state changes such as:

- copying another combatant's current battle profile
- changing active `types`
- changing stats or stat formulas
- changing passive traits
- changing move power rules
- changing active form

Whenever identity changes occur, the system must define:

- which state is copied
- which state is preserved
- whether the change ends on switching
- whether move legality or passive-trait legality must be recomputed immediately

## Fainting, Replacement, And Battle End

A combatant faints immediately when its `hp` reaches zero.

### Immediate faint effects

When a combatant faints:

- it is removed from active participation
- any unresolved future action from that combatant is canceled
- faint-triggered passive traits or held items resolve if their rules allow it
- the side must replace it if a usable reserve exists and the format requires replacement

### Replacement

If a side has a usable reserve, it must choose a replacement before battle continues past any step that requires an active combatant in that slot.

In doubles, only the fainted slot is replaced unless both active combatants fainted.

### Battle-end rule

A side loses when it has no usable combatants remaining.

The opposing side wins immediately unless both sides lose their last usable combatant in the same resolution window.

### Draw rule

If both sides lose their last usable combatant during the same resolution window, the result is a draw unless the format defines a different result.

## End-Of-Turn Processing

After all actions and required replacements are handled, the battle system must resolve end-of-turn effects in a fixed order.

The end-of-turn phase includes:

- burn damage
- poison damage
- partial-trap damage
- seed-like draining effects
- healing effects such as ring-like effects, terrain recovery, or held-item recovery
- weather damage or weather-based healing and defense rules
- status recovery checks that occur at end of turn
- decrementing volatile-condition durations
- decrementing `side effect` durations
- decrementing `field effect` durations
- expiring timed effects

If end-of-turn damage causes a faint, faint processing happens immediately before the next end-of-turn step continues.

## Doubles-Specific Rules

Double battles use the same core system as singles, but add targeting, adjacency, and spread interactions.

### Target classes

Moves in doubles use these target classes:

- the user
- one adjacent ally
- one adjacent opponent
- both opponents
- all other active combatants
- all active combatants
- one side
- the battlefield

### Invalid targets

If a chosen target becomes invalid before resolution, the move either:

- fails
- retargets a remaining legal combatant
- continues affecting the battlefield or side if that was the true target class

The targeting class determines which behavior occurs.

### Spread effects

Moves that affect multiple combatants must:

- check each target individually for protection and immunity where appropriate
- apply spread-damage modifiers when relevant
- allow one target to be affected even if another target is not

### Ally interactions

Double battles must support ally-targeting rules, redirection effects, and side-wide support moves.

## Resolution Order

Battle must be resolved in a fixed order.

The required per-turn sequence is:

1. Validate that the battle can continue and that each side has the required active combatants.
2. Process start-of-turn checks for every active combatant.
3. Collect all chosen or forced actions.
4. Validate every action and replace or cancel illegal actions.
5. Order actions by replacement timing, switching, `priority`, effective `Stat.Speed`, and deterministic RNG tie-breaks.
6. Resolve the first action.
7. Process all immediate consequences of that action, including redirection, hit checks, damage, secondary effects, self-effects, fainting, and forced replacements.
8. Resolve the next action if it remains valid.
9. Repeat until all actions for the turn have been handled or the battle has already ended.
10. Resolve end-of-turn residual damage, healing, and timed effects.
11. Expire effects whose durations have ended.
12. Check for win, loss, or draw.

## Canonical Rules Summary

The battle system follows these rules:

1. A battle is fought between two sides and supports singles and doubles.
2. Each active combatant chooses one legal action per turn unless a forced state overrides choice.
3. Actions resolve by replacement timing, switching, move `priority`, effective `Stat.Speed`, and deterministic tie-breaks.
4. A move spends `pp` when committed for use and must pass legality, targeting, hit, and immunity checks before applying most target effects.
5. Direct damage uses the move's `damageClass` and is modified by level, stats, same-type attack bonus, critical hits, `type` effectiveness, randomness, passive traits, held items, `side effects`, `field effects`, and spread rules where applicable.
6. A combatant can normally have only one major `status` at a time, but it may also carry multiple volatile conditions.
7. Stat stages, volatile conditions, `side effects`, and `field effects` all use explicit timing, duration, and removal rules.
8. Passive traits and held items are part of normal battle resolution and can modify legality, targeting, action order, damage, immunities, switching, and residual effects.
9. Switching clears most temporary combatant-only battle state, then applies switch-in triggers and hazards.
10. A combatant faints immediately at zero `hp` and is replaced if its side still has a usable reserve.
11. End-of-turn effects resolve in a fixed order after all actions and required replacements are complete.
12. A side wins when the opposing side has no usable combatants left, and simultaneous last-combatant knockouts produce a draw unless the format defines another result.

## Acceptance Criteria

An implementation of this spec is correct only if all of the following behaviors are test-covered:

- switch actions resolve before standard-priority move actions unless an overriding rule applies
- higher-priority moves act before lower-priority moves
- equal-priority actions use effective `Stat.Speed`
- `trick-room` reverses speed order for otherwise tied-priority actions
- deterministic RNG resolves tied effective speed correctly
- a move with zero `pp` cannot be selected
- the fallback move is used when no regular move can be selected
- `pp` is spent when a move is committed even if the move later fails under normal failure rules
- accuracy, `accuracy`, `evasion`, and immunity checks are applied in the correct order
- `Effectiveness.ZERO` prevents damage from the move unless a special rule overrides it
- same-type attack bonus applies when the move `type` matches one of the user's active `types`
- critical hits modify damage and ignore the expected stage interactions
- physical and special moves use the correct offensive and defensive stats
- spread moves apply reduced damage in doubles
- multi-hit moves apply multiple hits with correct on-hit timing
- recoil and drain effects use the correct post-damage timing
- one-hit knockout and fixed-damage moves bypass the normal damage formula correctly
- burn, paralysis, poison, sleep, and freeze each apply their expected restrictions or residual behavior
- a combatant cannot receive a new major status when it already has one unless an explicit override exists
- confusion, flinch, taunt, encore, disable, trapping, protect, and endure each apply their expected action restrictions
- `reflect`, `light-screen`, `mist`, `safeguard`, `lucky-chant`, and `tailwind` apply side-specific effects and expire correctly
- `spikes`, `toxic-spikes`, `stealth-rock`, and `sticky-web` resolve on entry with the correct grounded or `type` checks
- weather, terrain, gravity, and room-state effects apply their modifiers and expire correctly
- passive traits trigger in the correct timing windows and can be suppressed correctly when suppression rules are active
- held items trigger in the correct timing windows and are disabled correctly under held-item suppression
- switching clears the expected temporary state but preserves major `status`, permanent stats, and spent `pp`
- forced switching uses the same entry pipeline as normal switching
- redirection changes move targets before hit and damage resolution
- protection blocks or reduces the correct incoming move effects and uses the format's repeated-use success model
- fainting immediately removes the combatant from active participation and forces replacement when reserves exist
- doubles targeting, retargeting, ally targeting, and spread resolution all follow targeting-class rules
- end-of-turn effects resolve in a stable order and can cause immediate fainting before later end-of-turn steps continue
- simultaneous last-combatant knockouts resolve to a draw unless the format defines another result

## Implementation Shape

The system should be implemented as pure decision layers plus stateful orchestration.

The pure decision surface should map closely to functions like:

- `canChooseAction(battle, combatant, action)`
- `getLegalTargets(battle, combatant, move)`
- `getEffectiveSpeed(battle, combatant)`
- `orderActions(battle, actions)`
- `checkMoveHit(battle, user, target, move)`
- `calculateMoveDamage(battle, user, target, move)`
- `applyMoveEffect(battle, user, target, move)`
- `applyStatus(battle, target, status)`
- `applySwitch(battle, side, replacement)`
- `processFaint(battle, combatant)`
- `processEndOfTurn(battle)`
- `getBattleResult(battle)`

This separation keeps legality, targeting, damage, switching, residual timing, and battle completion independently testable while still supporting the full rules defined above.
