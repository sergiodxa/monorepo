# @sdxc/sample

Seeded generation of believable people, places, prose, numbers and identifiers.

A generator opens on a seed and draws every value from it, so the same seed and the same sequence
of calls produce the same values on any machine, on any day. Contact details are unroutable:
addresses and links land on the domains [RFC 2606](https://datatracker.ietf.org/doc/html/rfc2606)
reserves, and phone numbers come from the `555-01xx` range reserved for fiction.

## Installation

```sh
npm add @sdxc/sample
```

Seeds and streams come from [`@sdxc/random`](https://www.npmjs.com/package/@sdxc/random), which
installs alongside this package.

## Usage

### Open a generator on a seed

```typescript
import { createSample } from "@sdxc/sample";

let sample = createSample({ seed: "signup-suite" });

let person = sample.person.record();
// { firstName, lastName, fullName, email, username, sex, jobTitle, phone }, all agreeing

let people = sample.helpers.multiple(() => sample.person.record(), { count: 50 });
let roll = sample.number.int({ min: 1, max: 6 });
```

The seed is text or a number, and the same seed replays the same values.

### Fix the reference instant

The `date` module, and the timestamp inside a ULID, measure from `now`. Pass one to keep dates
put across days:

```typescript
import { createSample } from "@sdxc/sample";

let sample = createSample({ seed: 42, now: new Date("2026-06-15T12:00:00Z") });

sample.date.past({ days: 30 }); // the same instant for this seed, every day
sample.date.birthdate({ min: 21, max: 65 });
```

### Bring your own vocabulary

Every list a generator reads comes from a `Dataset`. Spread the English one from
`@sdxc/sample/data/en` and replace the lists you want:

```typescript
import type { Dataset } from "@sdxc/sample";

import { createSample } from "@sdxc/sample";
import { en } from "@sdxc/sample/data/en";

let data: Dataset = { ...en, companySuffixes: [...en.companySuffixes, "Cooperative"] };

let sample = createSample({ seed: "docs", data });
sample.company.name();
```

## API

### `createSample(options: SampleOptions): Sample`

Builds a generator: one stream, one dataset, and the modules that read them.

- `seed`: a `Seed` (text or a number) to open a stream on, or a `SeededRandom` already open from
  `@sdxc/random`. Required.
- `data`: the lists to draw from. Defaults to the English dataset.
- `now`: the instant `date` and `string.ulid()` measure from. Defaults to the current time.

### `Sample`

`sample.seed` is the seed this generator replays from. Each module below is a property of the
generator.

#### `sample.derive(label: string): Sample`

An independent generator named by `label`, on the same dataset and reference instant. Its values
hold still as calls are added to the parent.

#### `sample.person`

`firstName`, `lastName`, `middleName`, `fullName`, `prefix`, `suffix`, `sex`, `sexType`, `gender`,
`zodiacSign`, `jobArea`, `jobDescriptor`, `jobType`, `jobTitle`, `bio`, `phone`, `record`.
`record()` returns a `PersonRecord` whose email, username and phone agree with the name.
`firstName` and `middleName` take `{ sex }`; `fullName` takes `firstName`, `lastName`, `sex`,
`withPrefix` and `withSuffix`.

#### `sample.internet`

`email`, `username`, `displayName`, `domainName`, `domainSuffix`, `domainWord`, `url`, `password`,
`emoji`, `httpMethod`, `httpStatusCode`, `ip`, `ipv4`, `ipv6`, `mac`, `port`, `protocol`,
`jwtAlgorithm`, `jwt`, `userAgent`. `email`, `username` and `displayName` take
`{ firstName, lastName }`; `password` takes `{ length }` (16). `jwt({ payload, algorithm })`
returns a decodable token with a drawn signature: it fills a header, and a test that verifies
signs its own token.

#### `sample.location`

`city`, `country`, `countryCode`, `continent`, `county`, `state`, `street`, `buildingNumber`,
`streetAddress`, `secondaryAddress`, `zipCode`, `postalAddress`, `direction`, `cardinalDirection`,
`ordinalDirection`, `language`, `timeZone`, `latitude`, `longitude`, `nearbyGPSCoordinate`.
`city({ country })` draws from the named country and throws a `RangeError` for a name the dataset
lacks; `state({ abbreviated })` returns the postal code; `nearbyGPSCoordinate({ origin, radius })`
returns a `[latitude, longitude]` within `radius` km (10).

#### `sample.company`

`name`, `catchPhrase`, `catchPhraseAdjective`, `catchPhraseDescriptor`, `catchPhraseNoun`,
`buzzPhrase`, `buzzAdjective`, `buzzNoun`, `buzzVerb`.

#### `sample.lorem`

`word`, `words(count)`, `sentence`, `sentences(count)`, `paragraph({ sentences })`,
`paragraphs({ count, sentences, separator })`, `lines(count)`, `slug(count?)`, `text`.

#### `sample.date`

`past`, `future`, `recent`, `soon`, `anytime`, `between`, `betweens`, `birthdate`, `month`,
`weekday`, `timeZone`. `past` and `future` reach `{ days }` (30) from the reference;
`between({ from, to })` and `betweens({ from, to, count })` stay inside the range, the latter in
ascending order; `birthdate({ min, max })` takes ages (18–80); `month` and `weekday` take
`{ abbreviated }`.

#### `sample.string`

`uuid`, `ulid`, `nanoid(length?)`, `alpha`, `alphanumeric`, `numeric`, `hexadecimal`, `binary`,
`octal`, `symbol`, `sample`, `fromCharacters(characters, length)`. The character runs take a
length; `alpha` and `hexadecimal` take `{ casing }`, and `hexadecimal` a `prefix` such as `"0x"`.
A seeded `uuid()` has the UUID format and none of its unpredictability.

#### `sample.number`

`int`, `float`, `hex`, `binary`, `octal`, `romanNumeral`, `bigInt`, each taking `{ min, max }`.
`int` covers `0`–`100` inclusive and throws a `RangeError` for unsafe or reversed bounds; `float`
covers `[0, 1)` rounded to `fractionDigits` (2); the base methods cover `0`–`255`; `bigInt` takes
`bigint` bounds.

#### `sample.color`

`human`, `rgb`, `hsl`, `hwb`, `lab`, `lch`, `cmyk`, `space`, `cssSupportedSpace`,
`cssSupportedFunction`, `colorByCSSColorSpace`. `rgb()` returns `#rrggbb`, with `includeAlpha` for
a fourth channel; the others return channel numbers. `{ format: "css" }` returns CSS notation and
`{ format: "values" }` the numbers.

#### `sample.datatype`

`boolean({ probability })` returns `true` with that probability, 0.5 by default.

#### `sample.git`

`branch`, `commitSha`, `commitMessage`, `commitDate`, `commitEntry`. `commitSha()` returns 40 hex
characters, or `{ length: 7 }` for the short form.

#### `sample.hacker`

`abbreviation`, `adjective`, `noun`, `verb`, `ingverb`, `phrase`.

#### `sample.phone`

`number({ style })` writes `"human"` (`555-0142`), `"national"` or `"international"`. `imei()`
returns 15 digits closing with a Luhn check digit.

#### `sample.system`

`fileName`, `commonFileName`, `fileExt`, `commonFileExt`, `fileType`, `commonFileType`,
`mimeType`, `directoryPath`, `filePath`, `networkInterface`, `semver`, `cron`. The file name
methods take `{ extension }`.

#### `sample.helpers`

- `pick(items)`, `pickMany(items, { count })`, `shuffle(items)`: draw from your own list;
  `pick` and `pickMany` throw a `RangeError` when the list runs short.
- `multiple(build, { count })`: `count` values, `build` receiving each index.
- `maybe(build, { chance })`: the value, or `null` (chance 0.5).
- `weightedPick(choices)`: one `{ weight, value }`, as likely as its weight.
- `uniqueArray(source, count)`: distinct values from a list or a generator; throws a `RangeError`
  when it cannot find that many.
- `enumValue`, `objectKey`, `objectValue`, `objectEntry`: draw from an object.
- `rangeToNumber(range)`: a number as given, or one drawn from `{ min, max }`.
- `slugify(text)`: lowercase words joined by dashes.
- `replaceSymbols(pattern)`: `#` a digit, `?` a letter, `*` either.
  `replaceCreditCardSymbols(pattern?)` adds `L` for the Luhn check digit.
- `fromRegExp(pattern)`: a string matching literals, character classes and counts.
- `mustache(text, values)`: `{{key}}` replaced from strings or functions.
- `fake(template)`: `{{module.method}}` replaced by that generator's value; an unknown path throws
  a `RangeError`.

### Types

`SampleOptions`, `Sample`, `Dataset`, `Country`, `FirstNames` and `PersonRecord`, plus each
module's interface (`PersonModule`, `InternetModule`, …) and options type (`IntOptions`,
`SpanOptions`, `WeightedChoice`, …). `Dataset` is a plain object of word lists — names, countries
with their cities, street and company words, prose, colors, file extensions — and
`@sdxc/sample/data/en` exports the English one as `en`.

## Pattern: Reproducing A Failed Run

Draw a seed per run, put it where a failure shows it, and accept it back to replay the run down to
the last field:

```typescript
import { systemSeed } from "@sdxc/random";
import { createSample } from "@sdxc/sample";
import { describe, expect, test } from "vitest";

import { slugify } from "./slugify.js";

let seed = Number(process.env.SAMPLE_SEED) || systemSeed();

describe(`slugify (SAMPLE_SEED=${seed})`, () => {
	test("every title slugs to URL-safe text", () => {
		let sample = createSample({ seed });
		let titles = sample.helpers.multiple(() => sample.lorem.sentence(), { count: 100 });

		for (let title of titles) expect(slugify(title)).toMatch(/^[a-z0-9-]*$/);
	});
});
```

## Pattern: A Fixture That Keeps Growing

Values follow the order calls are made in, so inserting a call shifts everything drawn after it.
Give each part of a fixture its own derived generator and they stop moving each other:

```typescript
import { createSample } from "@sdxc/sample";

let sample = createSample({ seed: "checkout-suite" });

let customers = sample.derive("customers");
let orders = sample.derive("orders");

let buyer = customers.person.record();
let reference = orders.string.uuid(); // unchanged when a customer call is added
```

## Pattern: Seeding A Development Database

One seed per environment gives every developer the same rows. Read the country first and pass it
back so each address stays consistent:

```typescript
import { createSample } from "@sdxc/sample";

let sample = createSample({ seed: "local-dev" });

let users = sample.helpers.multiple(
	() => {
		let country = sample.location.country();
		return {
			...sample.person.record(),
			address: sample.location.streetAddress(),
			city: sample.location.city({ country }),
			country,
		};
	},
	{ count: 25 },
);

let posts = users.flatMap((user) =>
	sample.helpers.multiple(
		() => ({
			author: user.username,
			title: sample.lorem.sentence(),
			body: sample.lorem.paragraphs({ count: 3 }),
			publishedAt: sample.date.past({ days: 90 }),
		}),
		{ count: 4 },
	),
);
```

## Pattern: Optional And Weighted Fields

Real data is uneven: some fields are usually empty, some values far more common than others.

```typescript
import { createSample } from "@sdxc/sample";

let sample = createSample({ seed: "profiles" });

let tags = ["design", "billing", "api", "mobile", "security"];

let profile = {
	name: sample.person.fullName({ withPrefix: true }),
	website: sample.helpers.maybe(() => sample.internet.url(), { chance: 0.3 }),
	verified: sample.datatype.boolean({ probability: 0.8 }),
	plan: sample.helpers.weightedPick([
		{ weight: 8, value: "free" },
		{ weight: 2, value: "pro" },
	]),
	tags: sample.helpers.pickMany(tags, { count: 2 }),
	handles: sample.helpers.uniqueArray(() => sample.internet.username(), 3),
};
```

## Pattern: Codes, Identifiers And Templates

Build values to a format with symbols, a regular expression, or a template over the generators:

```typescript
import { createSample } from "@sdxc/sample";

let sample = createSample({ seed: "inventory" });

let product = {
	id: sample.string.uuid(),
	sku: sample.helpers.fromRegExp("SKU-[A-Z]{2}[0-9]{4}"),
	batch: sample.helpers.replaceSymbols("??-####"),
	card: sample.helpers.replaceCreditCardSymbols(),
	color: sample.color.rgb(),
	label: sample.helpers.fake("{{company.name}} {{hacker.noun}}"),
	greeting: sample.helpers.mustache("Hi {{name}}", { name: () => sample.person.firstName() }),
	release: `v${sample.system.semver()} (${sample.git.commitSha({ length: 7 })})`,
};
```

## Pattern: One Seed For Fake Data And Other Draws

Pass an open stream as the seed, and fake data and the rest of a test draw from one seed while
staying independent of each other:

```typescript
import { createRandom } from "@sdxc/random";
import { createSample } from "@sdxc/sample";

let random = createRandom("checkout-suite");
let sample = createSample({ seed: random.derive("people") });

let customer = sample.person.record();
let cartSize = random.derive("cart").int(1, 5);
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/sample": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
