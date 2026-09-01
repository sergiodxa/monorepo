# @pkg/sample

Seeded generation of believable people, places, prose, numbers, and identifiers.

## Overview

`@pkg/sample` fills in the data a test, a demo tenant, or a local database needs
when the exact values do not matter but their shape does. A generator opens on a
seed and draws every value from it, so the same seed and the same sequence of
calls produce the same values on any machine, on any day. A run that used
generated data can be replayed from the seed alone.

The seed is required. A generator with a hidden default would leave every caller
that forgot to pass one unable to reproduce its own data, and that is not
correctable after the fact. A process that wants fresh values each run asks for
them with `systemSeed()` and logs what it got. For the same reason the `date`
module measures from a reference instant the caller supplies rather than reading
the clock.

Contact details are unroutable by construction: addresses and links land on the
domains [RFC 2606](https://datatracker.ietf.org/doc/html/rfc2606) reserves for
documentation, and phone numbers come from the `555-01xx` range reserved for
fiction. Vocabulary is a plain data object passed in per generator, so two
generators in one process can draw from different lists.

## Usage

### Basic Example

```typescript
import { createSample } from "@pkg/sample";

let sample = createSample({ seed: "signup-suite" });

sample.person.record();
// { firstName: "Alejandro", lastName: "Yamamoto", fullName: "Alejandro Yamamoto",
//   email: "alejandro.yamamoto43@example.org", username: "alejandro.yamamoto" }

sample.helpers.multiple(() => sample.person.record(), { count: 50 });
```

### Fresh Values Each Run

```typescript
import { createSample, systemSeed } from "@pkg/sample";

let seed = systemSeed();
console.log(`sample seed ${seed}`);

let sample = createSample({ seed });
```

Passing the logged number back reproduces that run exactly.

### A Fixed Reference Instant

```typescript
let sample = createSample({
	seed: 42,
	now: new Date("2026-06-15T12:00:00Z"),
});

sample.date.past({ days: 30 }); // always the same instant for this seed
```

### Your Own Vocabulary

```typescript
import type { Dataset } from "@pkg/sample";

import { createSample } from "@pkg/sample";
import { en } from "@pkg/sample/data/en";

let data: Dataset = { ...en, companySuffixes: [...en.companySuffixes, "Cooperative"] };

let sample = createSample({ seed: "docs", data });
```

## API

### `createSample(options: SampleOptions): Sample`

Builds a generator: one stream, one dataset, and the modules that read them.

**Parameters:**

- `options.seed`: The stream to draw from — text, a number, or a `Random` that is
  already open. Required.
- `options.data`: The lists to draw from. Defaults to the English dataset.
- `options.now`: The instant the `date` module measures from. Defaults to the
  current time.

**Returns:**

- A `Sample` positioned at its first value.

**Example:**

```typescript
let sample = createSample({ seed: 42 });
sample.number.int({ min: 1, max: 6 }); // 6, every time
```

### `createRandom(seed: Seed): Random`

Opens the seeded stream on its own, for a caller that wants draws without the
vocabulary.

**Parameters:**

- `seed`: Text or a number naming the stream to replay.

**Returns:**

- A `Random` positioned at its first value.

**Example:**

```typescript
import { createRandom } from "@pkg/sample";

let random = createRandom("rollout");
random.pick(["control", "variant"]);
```

### `systemSeed(): number`

Draws a seed from a cryptographically strong source, for a process that wants
fresh values on every run.

**Returns:**

- A 32-bit seed. Log it and the run stays reproducible by passing it back.

**Example:**

```typescript
let sample = createSample({ seed: systemSeed() });
```

### `Sample`

#### `sample.seed`

The seed this generator replays from.

#### `sample.derive(label: string): Sample`

An independent generator named by `label`, on the same dataset and reference
instant. Its values hold still as calls are added to the parent, which is what
keeps one part of a fixture from moving another.

**Example:**

```typescript
let orders = sample.derive("orders"); // unaffected by what `sample` draws
```

#### `sample.person`

| Method                   | Returns                                               |
| ------------------------ | ----------------------------------------------------- |
| `firstName(): string`    | A given name from the dataset                         |
| `lastName(): string`     | A family name from the dataset                        |
| `fullName(): string`     | Both, joined by a space                               |
| `phone(): string`        | A number in the `555-01xx` range reserved for fiction |
| `record(): PersonRecord` | One person, consistent across every field             |

**Example:**

```typescript
let person = sample.person.record();
person.email; // matches person.firstName and person.lastName
```

#### `sample.internet`

| Method                                        | Returns                                   |
| --------------------------------------------- | ----------------------------------------- |
| `email(options?: NameOptions): string`        | An address on a reserved domain           |
| `username(options?: NameOptions): string`     | A lowercase handle, `first.last`          |
| `domain(): string`                            | One of the reserved documentation domains |
| `url(): string`                               | An `https` link on a reserved domain      |
| `password(options?: PasswordOptions): string` | A password, 16 characters by default      |

`NameOptions` takes `firstName` and `lastName`; either one that is left out is
generated. A handle folds accents onto their base letter and drops punctuation,
so `Lucía Ibáñez` becomes `lucia.ibanez`.

**Example:**

```typescript
sample.internet.email({ firstName: "Ana", lastName: "Moreau" });
// "ana.moreau35@example.com"
```

#### `sample.location`

| Method                                | Returns                                   |
| ------------------------------------- | ----------------------------------------- |
| `city(options?: CityOptions): string` | A city, from `options.country` when named |
| `country(): string`                   | A country name from the dataset           |

Asking for a city by country reads the cities that belong to it, so a generated
address stays internally consistent. A country the dataset does not carry raises
a `RangeError` naming it.

**Example:**

```typescript
sample.location.city({ country: "Japan" }); // "Kyoto"
sample.location.city({ country: "Atlantis" }); // RangeError
```

#### `sample.company`

| Method           | Returns                                       |
| ---------------- | --------------------------------------------- |
| `name(): string` | A distinctive word and a closing word, joined |

#### `sample.lorem`

| Method                                          | Returns                                  |
| ----------------------------------------------- | ---------------------------------------- |
| `words(count: number): string`                  | `count` words joined by spaces           |
| `sentence(): string`                            | A capitalized sentence, ending in `.`    |
| `paragraph(options?: ParagraphOptions): string` | Sentences joined by spaces, 4 by default |

#### `sample.number`

| Method                                  | Returns                                                              |
| --------------------------------------- | -------------------------------------------------------------------- |
| `int(options?: IntOptions): number`     | An integer in `[min, max]`, `0`–`100` by default                     |
| `float(options?: FloatOptions): number` | A number in `[min, max)`, rounded to `fractionDigits` (2 by default) |

#### `sample.string`

| Method                                 | Returns                                       |
| -------------------------------------- | --------------------------------------------- |
| `uuid(): string`                       | A version 4 UUID drawn from the seeded stream |
| `alphanumeric(length: number): string` | `length` lowercase letters and digits         |
| `hex(length: number): string`          | `length` lowercase hexadecimal digits         |

`uuid()` carries the format of a version 4 identifier and reproduces from the
seed like every other value here.

#### `sample.date`

| Method                                   | Returns                                       |
| ---------------------------------------- | --------------------------------------------- |
| `past(options?: SpanOptions): Date`      | An instant in the `days` before the reference |
| `future(options?: SpanOptions): Date`    | An instant in the `days` after the reference  |
| `between(options: BetweenOptions): Date` | An instant in `[from, to]`                    |

`SpanOptions.days` defaults to 30. `between()` raises a `RangeError` when an end
is an invalid date, or when `to` falls before `from`.

#### `sample.helpers`

| Method                                                                    | Returns                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------- |
| `pick<T>(items: readonly T[]): T`                                         | One element                                     |
| `pickMany<T>(items: readonly T[], options: PickManyOptions): T[]`         | `count` distinct elements, shuffled             |
| `shuffle<T>(items: readonly T[]): T[]`                                    | A shuffled copy                                 |
| `multiple<T>(build: (index: number) => T, options: MultipleOptions): T[]` | `count` built values                            |
| `maybe<T>(build: () => T, options?: MaybeOptions): T \| null`             | The value, or `null` (`chance`, 0.5 by default) |

**Example:**

```typescript
sample.helpers.pickMany(plans, { count: 2 });
sample.helpers.maybe(() => sample.internet.url(), { chance: 0.3 });
```

### `Random`

| Method                                      | Returns                                       |
| ------------------------------------------- | --------------------------------------------- |
| `seed`                                      | The seed this stream replays from             |
| `next(): number`                            | The next raw draw, in `[0, 1)`                |
| `int(min: number, max: number): number`     | An integer, both bounds included              |
| `float(min?: number, max?: number): number` | A number in `[min, max)`, `[0, 1)` by default |
| `bool(chance?: number): boolean`            | `true` with probability `chance`              |
| `pick<T>(items: readonly T[]): T`           | One element                                   |
| `shuffle<T>(items: readonly T[]): T[]`      | A shuffled copy                               |
| `derive(label: string): Random`             | An independent stream named by `label`        |

`int()` raises a `RangeError` when a bound is not a safe integer or `max` is
below `min`; `pick()` raises one on an empty list.

### Types

#### `Seed`

```typescript
type Seed = number | string;
```

#### `SampleOptions`

```typescript
interface SampleOptions {
	seed: Seed | Random;
	data?: Dataset;
	now?: Date;
}
```

#### `Dataset`

```typescript
interface Dataset {
	firstNames: readonly string[];
	lastNames: readonly string[];
	countries: readonly Country[];
	companyWords: readonly string[];
	companySuffixes: readonly string[];
	lorem: readonly string[];
}

interface Country {
	name: string;
	cities: readonly string[];
}
```

#### `PersonRecord`

```typescript
interface PersonRecord {
	firstName: string;
	lastName: string;
	fullName: string;
	email: string;
	username: string;
}
```

## Pattern: Reproducing A Failed Run

Give the run a seed drawn at start-up, print it, and accept it back:

```typescript
let seed = Number(process.env.SAMPLE_SEED) || systemSeed();
console.log(`sample seed ${seed}`);

let sample = createSample({ seed });
```

A failure is then replayed with `SAMPLE_SEED=<printed>`, and the data is
identical down to the last field.

## Pattern: A Fixture That Keeps Growing

Values follow the order calls are made in, so inserting a call shifts everything
drawn after it. Give each part of a fixture its own stream and they stop moving
each other:

```typescript
let sample = createSample({ seed: "checkout-suite" });

let customers = sample.derive("customers");
let orders = sample.derive("orders");

let buyer = customers.person.record();
let reference = orders.string.uuid(); // unchanged when a customer call is added
```

## Pattern: Seeding A Development Database

One seed per environment gives every developer the same rows, and a coherent
company with its people:

```typescript
let sample = createSample({ seed: "local-dev" });

let company = {
	name: sample.company.name(),
	country: sample.location.country(),
};

let staff = sample.helpers.multiple(() => sample.person.record(), { count: 25 });
```

To keep a company's people in the same place, read the country first and pass it
back in:

```typescript
let country = sample.location.country();
let office = { country, city: sample.location.city({ country }) };
```

## Pattern: A Weighted Field

`bool()` and `maybe()` cover the fields that are usually, but not always, filled:

```typescript
let profile = {
	name: sample.person.fullName(),
	website: sample.helpers.maybe(() => sample.internet.url(), { chance: 0.3 }),
	verified: createRandom("verification").bool(0.8),
};
```

## Related Packages

- [`@pkg/crypto`](/packages/crypto) - Cryptographically strong random bytes, which
  `systemSeed()` draws from
- [`@pkg/dates`](/packages/dates) - Instant arithmetic, which the `date` module
  places its values with
- [`@pkg/duration`](/packages/duration) - Durations written as text, which spell
  the day a date window is measured in

## Tips

1. **Assert the shape, not the text** - A dataset entry or a generator change
   moves what a fixed seed produces, so a test that pins a generated string will
   break for a reason it does not care about.
2. **Name a seed after what it generates** - `"checkout-suite"` says more in a
   failure than `42`, and text and numbers work equally well as seeds.
3. **Derive before you insert** - Once a fixture is asserted against, adding a
   call shifts every later value; `derive()` is how a value is pinned in place.
4. **Pass `now` wherever dates matter** - A generator that reads the clock
   produces different dates tomorrow, even from the same seed.
5. **Reach for `record()` over field-by-field calls** - It returns a person whose
   address and handle match the name, which field-by-field calls have to arrange
   by hand.
6. **Extend the dataset by spreading it** - `{ ...en, lastNames: [...] }` keeps
   every list you did not mean to change.
7. **Keep generated identifiers out of security decisions** - Everything here
   reproduces from the seed, which is the point for a fixture and the opposite of
   what a secret needs.
