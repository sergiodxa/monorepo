# @sdxc/sample

Seeded generation of believable people, places, prose, numbers, and identifiers.

A generator opens on a seed and draws every value from it, so the same seed and
the same sequence of calls produce the same values on any machine, on any day.

## Installation

```bash
npm add @sdxc/sample
```

## Usage

### Basic Example

```typescript
import { createSample } from "@sdxc/sample";

let sample = createSample({ seed: "signup-suite" });

sample.person.record();
// { firstName: "Jisoo", lastName: "Esposito", fullName: "Jisoo Esposito",
//   email: "jisoo.esposito57@example.net", username: "jisoo.esposito",
//   sex: "female", jobTitle: "Corporate Group Consultant", phone: "(555) 555-0159" }

sample.helpers.multiple(() => sample.person.record(), { count: 50 });
```

### Fresh Values Each Run

Draw a seed at start-up, log it, and accept it back to replay a failed run down
to the last field:

```typescript
import { createSample, systemSeed } from "@sdxc/sample";

let seed = Number(process.env.SAMPLE_SEED) || systemSeed();
console.log(`sample seed ${seed}`);

let sample = createSample({ seed });
```

### A Fixed Reference Instant

The `date` module measures from an instant the caller supplies, so dates stay
put across days:

```typescript
let sample = createSample({
	seed: 42,
	now: new Date("2026-06-15T12:00:00Z"),
});

sample.date.past({ days: 30 }); // always the same instant for this seed
```

### Your Own Vocabulary

```typescript
import type { Dataset } from "@sdxc/sample";

import { createSample } from "@sdxc/sample";
import { en } from "@sdxc/sample/data/en";

let data: Dataset = { ...en, companySuffixes: [...en.companySuffixes, "Cooperative"] };

let sample = createSample({ seed: "docs", data });
```

Contact details are unroutable by construction: addresses and links land on the
domains [RFC 2606](https://datatracker.ietf.org/doc/html/rfc2606) reserves, and
phone numbers come from the `555-01xx` range reserved for fiction.

## API

### `createSample(options: SampleOptions): Sample`

Builds a generator: one stream, one dataset, and the modules that read them.

- `seed`: The stream to draw from — text, a number, or an open `Random`. Required.
- `data`: The lists to draw from. Defaults to the English dataset.
- `now`: The instant the `date` module measures from. Defaults to the current time.

```typescript
let sample = createSample({ seed: 42 });
sample.number.int({ min: 1, max: 6 }); // 6, every time
```

### `createRandom(seed: Seed): Random`

Opens the seeded stream on its own, for a caller that wants draws without the
vocabulary: `createRandom("rollout").pick(["control", "variant"])`.

### `systemSeed(): number`

Draws a 32-bit seed from a cryptographically strong source. Log it and the run
stays reproducible by passing it back.

### `Sample`

`sample.seed` is the seed this generator replays from.

#### `sample.derive(label: string): Sample`

An independent generator named by `label`, on the same dataset and reference
instant. Values follow the order calls are made in, so inserting a call shifts
everything drawn after it; a derived generator holds still as calls are added to
the parent, which keeps one part of a fixture from moving another.

#### `sample.person`

Names, titles, work, and the person that ties them together: `firstName`,
`lastName`, `middleName`, `fullName`, `prefix`, `suffix`, `sex`, `sexType`,
`gender`, `zodiacSign`, `jobArea`, `jobDescriptor`, `jobType`, `jobTitle`,
`bio`, `phone`, `record`. `record()` returns one person whose email, handle,
and phone agree with the name. `firstName` and `middleName` take `{ sex }`;
`fullName` also takes `firstName`, `lastName`, `withPrefix`, `withSuffix`.

#### `sample.internet`

Addresses, handles, domains, links, and protocol values: `email`, `username`,
`displayName`, `domainName`, `domainSuffix`, `domainWord`, `url`, `password`,
`emoji`, `httpMethod`, `httpStatusCode`, `ip`, `ipv4`, `ipv6`, `mac`, `port`,
`protocol`, `jwtAlgorithm`, `jwt`, `userAgent`. `jwt()` returns three base64url
segments with claims a reader can decode; its signature is drawn from the
stream, so it fills a header, and a test that verifies wants a token signed
with a key it controls.

#### `sample.location`

Places down to the unit number: `city`, `country`, `countryCode`, `continent`,
`county`, `state`, `street`, `buildingNumber`, `streetAddress`,
`secondaryAddress`, `zipCode`, `postalAddress`, `direction`,
`cardinalDirection`, `ordinalDirection`, `language`, `timeZone`, `latitude`,
`longitude`, `nearbyGPSCoordinate`. Read the country first and pass it back to
`city({ country })` to keep an address internally consistent;
`nearbyGPSCoordinate({ origin, radius })` returns a `[latitude, longitude]`
pair within `radius` km.

#### `sample.company`

Company names and jargon: `name`, `catchPhrase`, `catchPhraseAdjective`,
`catchPhraseDescriptor`, `catchPhraseNoun`, `buzzPhrase`, `buzzAdjective`,
`buzzNoun`, `buzzVerb`.

#### `sample.lorem`

Placeholder prose: `word`, `words`, `sentence`, `sentences`, `paragraph`,
`paragraphs`, `lines`, `slug`, `text`.

#### `sample.date`

Instants around the reference, and the calendar words for them: `past`,
`future`, `recent`, `soon`, `anytime`, `between`, `betweens`, `birthdate`,
`month`, `weekday`, `timeZone`. `past` and `future` reach `days` from the
reference, 30 by default; `between` takes `{ from, to }`; `birthdate` takes ages
as `{ min, max }`; `month` and `weekday` take `{ abbreviated }`.

#### `sample.string`

Identifiers and character runs: `uuid`, `ulid`, `nanoid`, `alpha`,
`alphanumeric`, `numeric`, `hexadecimal`, `binary`, `octal`, `symbol`,
`sample`, `fromCharacters`. The character runs take a length, and
`fromCharacters(characters, length)` draws from your own alphabet; `alpha` and
`hexadecimal` take `{ casing }`, and `hexadecimal` a `prefix` such as `"0x"`.

#### `sample.number`

Numbers in any base: `int`, `float`, `hex`, `binary`, `octal`, `romanNumeral`,
`bigInt`. All of them take `{ min, max }`; `int` runs `0`–`100` by default,
`float` rounds to `fractionDigits` (2), and the base methods run `0`–`255`.

#### `sample.color`

Colors as names, channels, or CSS notation: `human`, `rgb`, `hsl`, `hwb`,
`lab`, `lch`, `cmyk`, `space`, `cssSupportedSpace`, `cssSupportedFunction`,
`colorByCSSColorSpace`. `rgb()` returns `#rrggbb` by default;
`{ format: "css" }` returns CSS notation and `{ format: "values" }` the
channels.

#### `sample.datatype`

`boolean(options?)` returns `true` with `probability`, half the time by default.

#### `sample.git`

Repository furniture: `branch`, `commitSha`, `commitMessage`, `commitDate`,
`commitEntry`. `commitSha()` returns 40 hex characters, or `{ length: 7 }` for
the short form.

#### `sample.hacker`

Technical filler: `abbreviation`, `adjective`, `noun`, `verb`, `ingverb`,
`phrase`.

#### `sample.phone`

`number(options?)` returns `555-0182`, with `{ style: "national" }` and
`{ style: "international" }` for the longer forms. `imei()` returns 15 digits
closing with a valid Luhn check digit.

#### `sample.system`

Files, paths, and machine furniture: `fileName`, `commonFileName`, `fileExt`,
`commonFileExt`, `fileType`, `commonFileType`, `mimeType`, `directoryPath`,
`filePath`, `networkInterface`, `semver`, `cron`.

#### `sample.helpers`

The shapes that turn one value into fifty: `pick`, `pickMany`, `shuffle`,
`multiple`, `maybe`, `weightedPick`, `uniqueArray`, `objectKey`, `objectValue`,
`objectEntry`, `enumValue`, `rangeToNumber`, `slugify`, `replaceSymbols`,
`replaceCreditCardSymbols`, `fromRegExp`, `mustache`, `fake`.

```typescript
sample.helpers.weightedPick([
	{ weight: 9, value: "common" },
	{ weight: 1, value: "rare" },
]);

sample.helpers.maybe(() => sample.internet.url(), { chance: 0.3 }); // the value, or null
sample.helpers.replaceSymbols("??-####"); // `#` a digit, `?` a letter, `*` either
sample.helpers.fromRegExp("SKU-[A-Z]{2}[0-9]{4}"); // "SKU-JW3212"
sample.helpers.fake("{{person.firstName}} of {{location.city}}"); // "Jing of Madrid"
```

### `Random`

The stream a generator draws from, usable on its own.

```typescript
interface Random {
	readonly seed: Seed;
	next(): number;
	int(min: number, max: number): number;
	float(min?: number, max?: number): number;
	bool(chance?: number): boolean;
	pick<T>(items: readonly T[]): T;
	shuffle<T>(items: readonly T[]): T[];
	derive(label: string): Random;
}
```

`int()` includes both bounds and raises a `RangeError` when a bound is not a
safe integer or `max` is below `min`; `pick()` raises one on an empty list.

### Types

```typescript
type Seed = number | string;

interface SampleOptions {
	seed: Seed | Random;
	data?: Dataset;
	now?: Date;
}
```

`Dataset` is a plain object of word lists — names, countries and their cities,
street and company words, prose, colors, file extensions, and the rest. Spread
`en` from `@sdxc/sample/data/en` to change one list and keep the others.
`PersonRecord`, every module type, and their options are exported as well.

## Pattern: Reproducing A Failed Run

Open the generator on a seed the run can print, and accept the same seed back:

```typescript
import { createSample, systemSeed } from "@sdxc/sample";

let sample = createSample({ seed: Number(process.env.SAMPLE_SEED) || systemSeed() });

process.on("exit", (code) => {
	if (code !== 0) console.log(`replay with SAMPLE_SEED=${sample.seed}`);
});
```

The failing run replays under the printed seed, identical down to the last
field.

## Pattern: A Fixture That Keeps Growing

Values follow the order calls are made in, so inserting a call shifts everything
drawn after it. Give each part of a fixture its own stream and they stop moving
each other:

```typescript
import { createSample } from "@sdxc/sample";

let sample = createSample({ seed: "checkout-suite" });

let customers = sample.derive("customers");
let orders = sample.derive("orders");

let buyer = customers.person.record();
let reference = orders.string.uuid(); // unchanged when a customer call is added
```

## Pattern: Seeding A Development Database

One seed per environment gives every developer the same rows. Read the country
first and pass it back so each address stays internally consistent:

```typescript
import { createSample } from "@sdxc/sample";

let sample = createSample({ seed: "local-dev" });

let users = sample.helpers.multiple(
	() => {
		let country = sample.location.country();
		return { ...sample.person.record(), country, city: sample.location.city({ country }) };
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

## Pattern: A Weighted Field

`maybe()` and `bool()` cover the fields that are usually, but not always,
filled:

```typescript
import { createRandom, createSample } from "@sdxc/sample";

let sample = createSample({ seed: "local-dev" });

let profile = {
	name: sample.person.fullName(),
	website: sample.helpers.maybe(() => sample.internet.url(), { chance: 0.3 }),
	verified: createRandom("verification").bool(0.8),
};
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
