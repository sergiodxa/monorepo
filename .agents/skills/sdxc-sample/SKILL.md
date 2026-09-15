---
name: sdxc-sample
description: "@sdxc/sample generates believable seeded fake data: `createSample({ seed })` opens a stream, then `sample.person`, `internet`, `location`, `company`, `lorem`, `date`, `string`, `number`, `color`, `datatype`, `git`, `hacker`, `phone`, `system` and `helpers` draw from it, reproducibly for a given seed. Use when writing test fixtures, seeding a development database, needing unroutable example emails and phone numbers, or replaying a failed run from a logged `systemSeed()`."
---

# @sdxc/sample

A generator opens on a seed and draws every value from it, so the same seed and the same sequence
of calls produce the same values on any machine, on any day. `createSample(options)` returns a
`Sample` carrying the modules above plus `derive(label)` for an independent stream; `createRandom`
opens the raw `Random` stream without the vocabulary, and `systemSeed()` draws a 32-bit seed from a
cryptographically strong source. The dataset is swappable — spread `en` from
`@sdxc/sample/data/en` to change one list and keep the others. Plain TypeScript, no runtime
assumptions.

Full API, options and examples: [packages/sample/README.md](packages/sample/README.md)

## When to reach for it

- A test needs fixtures that look like real people, addresses and prose, and must produce the same values on every run
- A development database needs seeding with rows every developer sees identically
- Example contact details must not be routable — real-looking emails, domains and phone numbers that cannot reach anyone
- A failing run needs replaying field for field from a seed it printed
- A fixture keeps growing, and adding one call must not shift every value drawn after it

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/sample": "workspace:*" } }
```

```ts
import { createSample } from "@sdxc/sample";

let sample = createSample({ seed: "signup-suite" });

sample.person.record();
// { firstName: "Jisoo", lastName: "Esposito", fullName: "Jisoo Esposito",
//   email: "jisoo.esposito57@example.net", username: "jisoo.esposito",
//   sex: "female", jobTitle: "Corporate Group Consultant", phone: "(555) 555-0159" }

sample.helpers.multiple(() => sample.person.record(), { count: 50 });
```

### Entry points

- `@sdxc/sample` — `createSample`, `createRandom`, `systemSeed`, and every module and option type.
- `@sdxc/sample/data/en` — the English `Dataset` (`en`), to spread when overriding a word list.

## Suggestions

- Values follow the order calls are made in, so inserting a call shifts everything drawn after it. Give each part of a fixture its own stream with `sample.derive(label)` and the parts stop moving each other.
- Pass `now` when the `date` module is used, or the values move as the days pass; the module measures from that instant.
- For fresh values per run, open on `systemSeed()`, log the seed, and accept it back from the environment — the failing run then replays exactly.
- Contact details are unroutable by construction: addresses and links land on the RFC 2606 reserved domains and phone numbers come from the `555-01xx` fiction range.
- `sample.internet.jwt()` draws its signature from the stream, so it fills a header but verifies against nothing — a test that verifies needs a token signed with a key it controls.
- Read the country first and pass it back to `location.city({ country })` to keep a generated address internally consistent.
