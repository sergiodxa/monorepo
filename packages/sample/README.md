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

Fifteen modules cover what a fixture asks for: people and the work they do,
places down to the unit number, companies, prose, dates, identifiers, numbers in
any base, colors, booleans, repository furniture, technical filler, phone
numbers, files and paths, and the helpers that turn one value into fifty.

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
// { firstName: "Jisoo", lastName: "Esposito", fullName: "Jisoo Esposito",
//   email: "jisoo.esposito57@example.net", username: "jisoo.esposito",
//   sex: "female", jobTitle: "Corporate Group Consultant", phone: "(555) 555-0159" }

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

```typescript
let orders = sample.derive("orders"); // unaffected by what `sample` draws
```

#### `sample.person`

| Method                                        | Returns                                              |
| --------------------------------------------- | ---------------------------------------------------- |
| `firstName(options?)`                         | A given name; `{ sex }` draws from one list          |
| `lastName()`                                  | A family name                                        |
| `middleName(options?)`                        | A second given name                                  |
| `fullName(options?)`                          | Both names; `withPrefix` and `withSuffix` add titles |
| `prefix()` / `suffix()`                       | `"Dr."` / `"PhD"`                                    |
| `sex()` / `sexType()`                         | The word / `"female"` or `"male"`                    |
| `gender()`                                    | A gender identity                                    |
| `zodiacSign()`                                | A sign                                               |
| `jobArea()` / `jobDescriptor()` / `jobType()` | The three parts of a title                           |
| `jobTitle()`                                  | The three, joined                                    |
| `bio()`                                       | A one-line profile blurb                             |
| `phone()`                                     | A number, from the `phone` module                    |
| `record()`                                    | One person, every field agreeing with the others     |

#### `sample.internet`

| Method                                             | Returns                                                 |
| -------------------------------------------------- | ------------------------------------------------------- |
| `email(options?)`                                  | An address on a reserved domain                         |
| `username(options?)`                               | `first.last`                                            |
| `displayName(options?)`                            | `"Ana M."`                                              |
| `domainName()` / `domainSuffix()` / `domainWord()` | The parts of a domain                                   |
| `url(options?)`                                    | An `https` link; `protocol` and `appendSlash` adjust it |
| `password(options?)`                               | 16 legible characters by default                        |
| `emoji()`                                          | One emoji                                               |
| `httpMethod()` / `httpStatusCode()`                | A verb / a status code                                  |
| `ip()` / `ipv4()` / `ipv6()` / `mac()`             | Addresses                                               |
| `port()` / `protocol()`                            | A port above 1024 / `http` or `https`                   |
| `jwtAlgorithm()`                                   | One of the algorithms tokens here are signed with       |
| `jwt(options?)`                                    | A token shaped like a JWT, claims readable              |
| `userAgent()`                                      | A browser user-agent string                             |

#### `sample.location`

| Method                                                       | Returns                                               |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| `city(options?)`                                             | A city, from `{ country }` when named                 |
| `country()` / `countryCode()`                                | A name / an ISO 3166-1 alpha-2 code                   |
| `continent()` / `county()`                                   | A continent / a county                                |
| `state(options?)`                                            | A name, or `{ abbreviated: true }` for the short form |
| `street()` / `buildingNumber()`                              | `"Juniper Lane"` / `"1402"`                           |
| `streetAddress(options?)`                                    | The two joined; `useFullAddress` adds a unit          |
| `secondaryAddress()`                                         | `"Apt. 12"`                                           |
| `zipCode()`                                                  | Five digits                                           |
| `postalAddress()`                                            | A whole address on one line                           |
| `direction()` / `cardinalDirection()` / `ordinalDirection()` | Compass points                                        |
| `language()` / `timeZone()`                                  | A language / an IANA zone                             |
| `latitude(options?)` / `longitude(options?)`                 | Coordinates, bounded on request                       |
| `nearbyGPSCoordinate(options)`                               | A point within `radius` km of `origin`                |

#### `sample.company`

| Method                                                                     | Returns                 |
| -------------------------------------------------------------------------- | ----------------------- |
| `name()`                                                                   | `"Ridgeline Analytics"` |
| `catchPhrase()`                                                            | A slogan                |
| `catchPhraseAdjective()` / `catchPhraseDescriptor()` / `catchPhraseNoun()` | Its parts               |
| `buzzPhrase()`                                                             | A sentence of jargon    |
| `buzzAdjective()` / `buzzNoun()` / `buzzVerb()`                            | Its parts               |

#### `sample.lorem`

| Method                                         | Returns                     |
| ---------------------------------------------- | --------------------------- |
| `word()` / `words(n)`                          | One word / `n` words        |
| `sentence()` / `sentences(n)`                  | One sentence / `n` of them  |
| `paragraph(options?)` / `paragraphs(options?)` | 4 sentences / 3 paragraphs  |
| `lines(n)`                                     | `n` sentences, one per line |
| `slug(count?)`                                 | Dashed words for a URL      |
| `text()`                                       | A few sentences             |

#### `sample.date`

| Method                                   | Returns                                    |
| ---------------------------------------- | ------------------------------------------ |
| `past(options?)` / `future(options?)`    | Within `days` of the reference             |
| `recent(options?)` / `soon(options?)`    | Within a day of it                         |
| `anytime()`                              | Within a year either side                  |
| `between(options)` / `betweens(options)` | One / several, in order                    |
| `birthdate(options?)`                    | Putting the person between `min` and `max` |
| `month(options?)` / `weekday(options?)`  | Names, abbreviated on request              |
| `timeZone()`                             | An IANA zone                               |

#### `sample.string`

| Method                                     | Returns                                       |
| ------------------------------------------ | --------------------------------------------- |
| `uuid()` / `ulid()` / `nanoid(length?)`    | Identifiers                                   |
| `alpha(length, options?)`                  | Letters; `casing` adjusts them                |
| `alphanumeric(length)` / `numeric(length)` | Letters and digits / digits                   |
| `hexadecimal(length, options?)`            | Hex digits; `prefix` and `casing` adjust them |
| `binary(length)` / `octal(length)`         | Prefixed `0b` / `0o`                          |
| `symbol(length)` / `sample(length)`        | Punctuation / printable ASCII                 |
| `fromCharacters(characters, length)`       | Drawn from your own alphabet                  |

#### `sample.number`

| Method                           | Returns                                          |
| -------------------------------- | ------------------------------------------------ |
| `int(options?)`                  | An integer in `[min, max]`, `0`–`100` by default |
| `float(options?)`                | Rounded to `fractionDigits`, 2 by default        |
| `hex()` / `binary()` / `octal()` | An integer written in that base                  |
| `romanNumeral(options?)`         | `"MCMXCIV"`                                      |
| `bigInt(options?)`               | Past what a `number` holds                       |

#### `sample.color`

| Method                                                       | Returns                                 |
| ------------------------------------------------------------ | --------------------------------------- |
| `human()`                                                    | `"teal"`                                |
| `rgb(options?)`                                              | `#rrggbb`, or channels, or CSS notation |
| `hsl()` / `hwb()` / `lab()` / `lch()` / `cmyk()`             | Channels, or CSS with `format: "css"`   |
| `space()` / `cssSupportedSpace()` / `cssSupportedFunction()` | CSS color words                         |
| `colorByCSSColorSpace(options?)`                             | A color in a named space                |

#### `sample.datatype`

| Method              | Returns                                    |
| ------------------- | ------------------------------------------ |
| `boolean(options?)` | `true` with `probability`, half by default |

#### `sample.git`

| Method                | Returns                               |
| --------------------- | ------------------------------------- |
| `branch()`            | `"parse-the-cursor"`                  |
| `commitSha(options?)` | 40 hex characters, or `{ length: 7 }` |
| `commitMessage()`     | A subject line                        |
| `commitDate()`        | A date in `git log` format            |
| `commitEntry()`       | A whole log entry                     |

#### `sample.hacker`

| Method                                                               | Returns          |
| -------------------------------------------------------------------- | ---------------- |
| `abbreviation()` / `adjective()` / `noun()` / `verb()` / `ingverb()` | Words            |
| `phrase()`                                                           | A whole sentence |

#### `sample.phone`

| Method             | Returns                                                      |
| ------------------ | ------------------------------------------------------------ |
| `number(options?)` | `555-0142`; `style` gives the national or international form |
| `imei()`           | 15 digits, closing with a valid check digit                  |

#### `sample.system`

| Method                                            | Returns                      |
| ------------------------------------------------- | ---------------------------- |
| `fileName(options?)` / `commonFileName(options?)` | A name with an extension     |
| `fileExt()` / `commonFileExt()`                   | An extension                 |
| `fileType()` / `commonFileType()`                 | A broad kind                 |
| `mimeType()`                                      | `"image/png"`                |
| `directoryPath()` / `filePath()`                  | An absolute directory / file |
| `networkInterface(options?)`                      | `"enp3s0"`                   |
| `semver()` / `cron()`                             | `"3.7.1"` / `"15 3 * * 1"`   |

#### `sample.helpers`

| Method                                                              | Returns                                  |
| ------------------------------------------------------------------- | ---------------------------------------- |
| `pick(items)` / `pickMany(items, options)`                          | One element / `count` distinct ones      |
| `shuffle(items)`                                                    | A shuffled copy                          |
| `multiple(build, options)`                                          | `count` built values                     |
| `maybe(build, options?)`                                            | The value, or `null`                     |
| `weightedPick(choices)`                                             | One choice, by weight                    |
| `uniqueArray(source, count)`                                        | Distinct values from a list or generator |
| `objectKey(values)` / `objectValue(values)` / `objectEntry(values)` | Parts of an object                       |
| `enumValue(values)`                                                 | One value of an enum-shaped object       |
| `rangeToNumber(range)`                                              | A number, or one drawn from a range      |
| `slugify(text)`                                                     | `"como-usar-remix-v3"`                   |
| `replaceSymbols(pattern)`                                           | `#` a digit, `?` a letter, `*` either    |
| `replaceCreditCardSymbols(pattern?)`                                | The same, with a Luhn check digit        |
| `fromRegExp(pattern)`                                               | A string matching a pattern              |
| `mustache(text, values)`                                            | `{{key}}` replaced by your values        |
| `fake(template)`                                                    | `{{module.method}}` replaced by a draw   |

```typescript
sample.helpers.weightedPick([
	{ weight: 9, value: "common" },
	{ weight: 1, value: "rare" },
]);

sample.helpers.fromRegExp("SKU-[A-Z]{2}[0-9]{4}"); // "SKU-QP4817"
sample.helpers.fake("{{person.firstName}} of {{location.city}}"); // "Marta of Kyoto"
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
- [`@pkg/jwt`](/packages/jwt) - The signature algorithms a generated token names

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
   what a secret needs. `internet.jwt()` follows the same rule: its claims decode
   and its signature is drawn, so it fills a header but never verifies.
8. **Reach for `helpers.fake()` when a string mixes several draws** -
   `fake("{{person.firstName}} of {{location.city}}")` beats concatenating the
   calls by hand.
