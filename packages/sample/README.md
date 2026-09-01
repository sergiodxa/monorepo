# @pkg/sample

Seeded generation of believable people, places, prose, numbers, and identifiers.

## Overview

`@pkg/sample` fills in the data a test, a demo tenant, or a local database needs
when the exact values do not matter but their shape does. A generator opens on a
seed and every value is drawn from it:

```typescript
import { createSample } from "@pkg/sample";

let sample = createSample({ seed: "signup-suite" });

sample.person.record();
// { firstName: "Marta", lastName: "Ibáñez", fullName: "Marta Ibáñez",
//   email: "marta.ibanez42@example.com", username: "marta.ibanez" }
```

The seed is required, and it is the whole reproduction recipe: the same seed and
the same sequence of calls produce the same values on any machine, on any day.
A run that failed on generated data can be replayed exactly.

Contact details are unroutable by construction. Addresses and links land on the
domains RFC 2606 reserves for documentation, and phone numbers come from the
`555-01xx` range reserved for fiction, so data generated here stays where it was
made even if a system tries to send to it.

## Usage

### Opening a generator

```typescript
let sample = createSample({
	seed: 42, // text or a number
	data: en, // the lists to draw from, English by default
	now: new Date("2026-06-15T12:00:00Z"), // what the date module measures from
});

sample.seed; // 42
```

A process that wants fresh data each run asks for it, and logs what it got:

```typescript
import { createSample, systemSeed } from "@pkg/sample";

let seed = systemSeed();
console.log(`sample seed ${seed}`);
let sample = createSample({ seed });
```

### What it generates

```typescript
sample.person.firstName(); // "Haruto"
sample.person.lastName(); // "Lindqvist"
sample.person.fullName(); // "Ana Moreau"
sample.person.phone(); // "+1 555-0142"
sample.person.record(); // a person whose email and handle match the name

sample.internet.email(); // "elena.tanaka7@example.org"
sample.internet.email({ firstName: "Lucía", lastName: "Ibáñez" });
sample.internet.username(); // "oliver.costa"
sample.internet.domain(); // "example.net"
sample.internet.url(); // "https://meridian.example.com"
sample.internet.password({ length: 24 });

sample.location.city(); // "Kyoto"
sample.location.city({ country: "Chile" }); // "Valparaíso"
sample.location.country(); // "Portugal"
sample.company.name(); // "Ridgeline Analytics"

sample.lorem.words(3); // "dolor sit amet"
sample.lorem.sentence(); // "Quis nostrud exercitation ullamco."
sample.lorem.paragraph({ sentences: 3 });

sample.number.int({ min: 1, max: 100 }); // 57
sample.number.float({ min: 0, max: 1, fractionDigits: 2 }); // 0.31

sample.string.uuid(); // "9f2b1c4e-7a83-4d1f-9c02-5b8e6a37d914"
sample.string.alphanumeric(12); // "k3p9wq1zr7ax"
sample.string.hex(32);

sample.date.past({ days: 30 });
sample.date.future({ days: 7 });
sample.date.between({ from, to });
```

Asking for a city by country reads the cities that belong to it, so an address
stays internally consistent. A country the dataset does not carry raises a
`RangeError` naming it, rather than returning a city from somewhere else.

### Many at once

```typescript
sample.helpers.multiple(() => sample.person.record(), { count: 50 });
sample.helpers.pick(plans); // one of your own values
sample.helpers.pickMany(plans, { count: 2 }); // distinct
sample.helpers.shuffle(plans);
sample.helpers.maybe(() => sample.internet.url(), { chance: 0.3 }); // value or null
```

### Keeping values still

Values follow the order calls are made in, so inserting a call shifts everything
drawn after it. `derive()` opens an independent stream under a label, seeded from
the label alone:

```typescript
let orders = sample.derive("orders");
let invoices = sample.derive("invoices");
```

`orders` produces the same values however much `sample` or `invoices` has drawn,
which is what keeps one part of a fixture from moving another.

### Your own vocabulary

A dataset is plain data. Hand in your own to generate in another language, or to
narrow the values to a domain:

```typescript
import type { Dataset } from "@pkg/sample";

let data: Dataset = {
	firstNames: ["Ada", "Grace"],
	lastNames: ["Lovelace", "Hopper"],
	countries: [{ name: "United Kingdom", cities: ["London", "Manchester"] }],
	companyWords: ["Analytical"],
	companySuffixes: ["Engine"],
	lorem: ["difference", "engine", "note"],
};

let sample = createSample({ seed: "docs", data });
```

The English dataset is also importable on its own, for a caller that extends it:

```typescript
import { en } from "@pkg/sample/data/en";

let data = { ...en, companySuffixes: [...en.companySuffixes, "Cooperative"] };
```

Its scope is Western and East Asian names, and countries across the Americas,
Europe, East Asia, and Oceania. Another region is served by a dataset that
covers it properly.

### The stream on its own

The generator is built over a small seeded stream, which is exported for a
caller that wants draws without the vocabulary:

```typescript
import { createRandom } from "@pkg/sample";

let random = createRandom("rollout");

random.int(1, 100); // both ends included
random.float(0, 1);
random.bool(0.25); // true a quarter of the time
random.pick(items);
random.shuffle(items); // a copy; the input keeps its order
random.derive("cohort-b"); // an independent stream
```

## What a seed guarantees

- The same seed, the same package version, and the same sequence of calls give
  the same values.
- Adding a call shifts every value drawn after it in that stream. `derive()` is
  how a value is pinned in place.
- Changing a dataset entry, or the generator itself, changes what a fixed seed
  produces. Those changes are called out in the package's release notes, and
  they are the reason a test should assert the shape of a generated value rather
  than its text.

`string.uuid()` is drawn from the seeded stream like everything else: it carries
the format of a version 4 UUID and reproduces from the seed.
