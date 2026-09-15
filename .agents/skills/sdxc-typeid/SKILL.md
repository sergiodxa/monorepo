---
name: sdxc-typeid
description: "@sdxc/typeid encodes a UUID and a prefix as one TypeID string (`user_01h455vb4pex5vsknk084sn02q`), typed as `TypeID<\"user\">` so an id from the wrong table fails to compile. Use when public ids should say what they identify, when parsing an id out of a URL segment or request body at the boundary, when a UUID column has to stay a UUID column, or when handling `TypeIdError` subclasses like `PrefixMismatchError`."
---

# @sdxc/typeid

A TypeID is one string carrying both halves of an identifier: which resource it points at
and which UUID it stands for, so a log line or a URL segment reads as the thing it
identifies, and an id from the wrong table stops being a lookup that silently finds nothing.
The surface is the `TypeID` class (`fromUUID`, `fromString`, `isValid`, `prefix`, `suffix`,
`toUUID`, `toString`), the `typeid(prefix)` factory, and an error family under
`@sdxc/typeid/errors`. The encoding follows the TypeID specification, and values sort the
way the UUIDs behind them sort, so a UUIDv7 id stays time-ordered once it is prefixed.

Full API, options and examples: [packages/typeid/README.md](packages/typeid/README.md)

## When to reach for it

- Ids appear in URLs, logs or API responses and an opaque UUID gives no clue what it names.
- A function taking a user id keeps being handed a session id, and the mistake only surfaces as an empty query result.
- A path segment or a request field has to be validated as an id of a specific resource before any database call.
- The database should keep native UUID columns while the outside world sees prefixed ids.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/typeid": "workspace:*" } }
```

```ts
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";

let userId = TypeID.fromUUID("user", generateUUID());

userId.prefix; // "user"
userId.toString(); // "user_01h455vb4pex5vsknk084sn02q"
userId.toUUID(); // "01890a5d-ac96-774b-bcce-b302099a8057"
```

```ts
let userId = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q", "user");
TypeID.isValid("user_nope"); // false
```

### Entry points

- `@sdxc/typeid` — the `TypeID` class and the `typeid(prefix)` factory.
- `@sdxc/typeid/errors` — `TypeIdError` and its subclasses (`InvalidPrefixError`, `PrefixMismatchError`, `EmptyPrefixError`, `MissingSeparatorError`, `InvalidSuffixLengthError`, `InvalidBase32CharacterError`, `InvalidBase32StringError`).

## Suggestions

- Always pass the expected prefix as the second argument to `fromString`/`isValid`. That is what turns a `post_` id arriving where a user id belongs into a `PrefixMismatchError` at the edge, rather than a query returning nothing several layers deeper. Pair `isValid` for the routing decision with `fromString` for the value.
- Bind each resource's prefix once with `typeid("user")` and export the factories from one module, so prefix strings live in a single file and each factory returns its own literal type.
- A prefix is lowercase ASCII letters and underscores, at most 63 characters, starting and ending with a letter; the **last** underscore is the separator, so `user_profile_…` needs no escaping. The suffix is exactly 26 Crockford Base32 characters with no `i`, `l`, `o` or `u`. A bare suffix parses with an empty prefix.
- One `instanceof TypeIdError` covers every parse failure. A malformed UUID handed to `fromUUID` reports through `@sdxc/uuid`'s own error classes instead.

## Related

- `@sdxc/uuid` — supplies the `UUID` type `fromUUID` takes and `toUUID` returns, and `generateUUID`; skill `sdxc-uuid`
