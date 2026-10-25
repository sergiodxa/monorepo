# @sdxc/jscontact

Read, validate and write RFC 9553 JSContact Cards, and convert them to and from vCard and jCard.

[JSContact](https://www.rfc-editor.org/rfc/rfc9553) is the JSON counterpart of vCard. Cards are
written at version 2.0 ([RFC 9982](https://www.rfc-editor.org/rfc/rfc9982)), where `uid` is
optional. The model is the JSON itself, so a parsed Card serializes back unchanged, and unknown
and vendor properties are kept.

| Import                  | What it holds                                                              |
| ----------------------- | -------------------------------------------------------------------------- |
| `@sdxc/jscontact`       | parse and stringify, validation, PatchObjects and localizations            |
| `@sdxc/jscontact/vcard` | vCard 4.0 text and jCard read and write, and conversion to and from a Card |

## Installation

```sh
npm add @sdxc/jscontact remix
```

Validation runs on `remix/data-schema`, and fallible functions return a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside.

## Usage

### Read and validate a Card

```typescript
import { parse } from "@sdxc/jscontact";
import { isFailure } from "@sdxc/result";

let parsed = parse(await request.text());
if (isFailure(parsed)) throw parsed.error; // JSContactParseError, with .issues and their paths

parsed.data.name?.full; // "Joe User"
```

### Read a Card in another language

```typescript
import { localize } from "@sdxc/jscontact";

let french = localize(card, "fr"); // the "fr" localization applied, or the Card unchanged
```

### Convert vCard and jCard

```typescript
import { fromVCard, parseVCard, readJCard, stringifyVCard, toVCard } from "@sdxc/jscontact/vcard";
import { isSuccess } from "@sdxc/result";

let cards = parseVCard(await file.text());
if (isSuccess(cards)) cards.data.map(fromVCard); // JSContact.Card[]

let jcard = readJCard(entity.vcardArray); // a jCard, such as an RDAP entity's
if (isSuccess(jcard)) fromVCard(jcard.data);

let text = stringifyVCard(toVCard(card)); // text/vcard
```

Conversion follows [RFC 9555](https://www.rfc-editor.org/rfc/rfc9555): each map entry becomes a
property carrying its key in `PROP-ID`, localizations become `LANGUAGE` alternatives tied by
`ALTID`, and a vCard property with no counterpart is kept in `vCardProps`. Anything a vCard
property cannot carry travels in `JSPROP`, so a Card converted to vCard and back is unchanged.

## API

### `parse(source: unknown): Result<JSContact.Card, JSContactParseError>`

Validates JSON text or an already-parsed value against RFC 9553 and RFC 9982, including case
variants of registered names, which the RFC makes invalid. `CARD_SCHEMA` is the schema itself.

### `stringify(card: JSContact.Card): string`

Compact JSON, the body of a `MEDIA_TYPE` (`application/jscontact+json;version=2.0`) response.

### `localize(card: JSContact.Card, language: string): Result<JSContact.Card, PatchError>`

The Card with its localization for `language` applied, matched case-insensitively.

### `applyPatch(object, patch): Result<object, PatchError>`

Applies a PatchObject to a copy, all or nothing.

### `isId(value)`, `isUTCDateTime(value)`

The Id alphabet, and the single valid spelling of a UTCDateTime.

### `@sdxc/jscontact/vcard`

- `parseVCard(text)` reads one or more vCards; `stringifyVCard(cards)` writes them folded at 75
  octets with CRLF endings.
- `readJCard(json)` and `writeJCard(card)` read and write RFC 7095 jCard. A malformed jCard
  property is skipped rather than failing the card.
- `fromVCard(card)` and `toVCard(card)` convert between that card and a JSContact Card.
- `VCARD_MEDIA_TYPE` and `JCARD_MEDIA_TYPE` are `text/vcard;charset=utf-8` and
  `application/vcard+json`, ready for a `Content-Type` header.

### Types

`JSContact.Card` and every object it holds (`Name`, `Address`, `Phone`, …) live under the
`JSContact` namespace; `VCard`, `VCardProperty` and `JCard` are exported from `./vcard`.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/jscontact": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
