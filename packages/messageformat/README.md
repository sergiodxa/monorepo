# @sdxc/messageformat

Unicode MessageFormat 2 parser and formatter shaped like `Intl.MessageFormat`.

## Installation

```sh
npm add @sdxc/messageformat
```

`parse` returns a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
which installs alongside this package.

## Usage

### Format a message

```typescript
import { MessageFormat } from "@sdxc/messageformat";

let message = new MessageFormat("en", "{$count :number} new posts");
message.format({ count: 1200 }); // "1,200 new posts"
```

The constructor parses the message once; the instance is immutable and formats any number of
times, so one instance can serve every request.

### Choose a variant

```typescript
import { MessageFormat } from "@sdxc/messageformat";

let message = new MessageFormat(
	"en",
	`.input {$count :number}
.match $count
0   {{You have no notifications}}
one {{You have {$count} notification}}
*   {{You have {$count} notifications}}`,
);

message.format({ count: 0 }); // "You have no notifications"
message.format({ count: 1 }); // "You have 1 notification"
message.format({ count: 7 }); // "You have 7 notifications"
```

An exact numeric key beats a plural category, which beats `*`. Categories come from
[`Intl.PluralRules`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules)
for the message's locale.

### Collect formatting errors

```typescript
import { MessageFormat } from "@sdxc/messageformat";

let message = new MessageFormat("en", "Hello {$name}!", { bidiIsolation: "none" });

let errors: Error[] = [];
message.format({}, (error) => errors.push(error)); // "Hello {$name}!"
```

A placeholder that fails formats as its fallback, such as `{$name}`, and the error goes to the
optional `onError` callback. Formatting never throws.

### Check a message without throwing

```typescript
import { parse } from "@sdxc/messageformat";
import { isFailure } from "@sdxc/result";

let result = parse("{$count :number");
if (isFailure(result)) result.error.type; // "syntax-error", with result.error.start === 15
```

## API

### `new MessageFormat(locales, source, options?)`

Compiles `source` (MessageFormat 2 syntax, or a `MessageData` object) for `locales` (a BCP 47
tag, a list of them, or `undefined` for the runtime default). Throws a `MessageError` on a syntax
or data model error.

- `options.bidiIsolation`: `"compatibility"` (default) wraps each placeholder whose direction may
  differ from the message's in Unicode isolate controls (U+2066 to U+2069); `"none"` leaves the
  output untouched.
- `options.dir`: the message's base direction, `"ltr"`, `"rtl"` or `"auto"`; defaults to the
  direction of the first locale's script.
- `options.functions`: custom `MessageFunction`s by name, `"ns:name"` included; they take
  precedence over the default functions.
- `options.localeMatcher`: `"best fit"` (default) or `"lookup"`.

### `messageFormat.format(values?, onError?): string`

Formats to a string. Markup formats as the empty string, and a failed placeholder as `{source}`
after its error reaches `onError`.

### `messageFormat.formatToParts(values?, onError?): MessagePart[]`

Formats to parts: `text` for literal text, `markup` (`kind` `"open"`, `"standalone"` or
`"close"`, with resolved `options`), `bidiIsolation` around an isolated placeholder, `string`
and `number` for default function results (`number` carries
[`Intl.NumberFormat` parts](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/formatToParts)),
`fallback` for a failed placeholder, `unknown` for a value that is neither string nor number,
and whatever parts a custom function returns. The `u:id` option sets `id` on a placeholder's or
markup's parts, and `u:dir` sets a placeholder's direction and always isolates it.

### `messageFormat.resolvedOptions(): ResolvedMessageFormatOptions`

Returns `{ bidiIsolation, dir, functions, localeMatcher }` as the instance settled on.

### `parse(source: string): Result<MessageData, MessageError>`

Parses and validates MessageFormat 2 source into its data model. The failure is a
`MessageError` of type `syntax-error` (with `start`) or a data model error:
`variant-key-mismatch`, `missing-fallback-variant`, `missing-selector-annotation`,
`duplicate-declaration`, `duplicate-option-name` or `duplicate-variant`.

### `MessageError`

`new MessageError(type, message, { source?, start?, cause? })`. Every stage reports this class:
`type` is the MessageFormat 2 specification's error name, `source` the failed placeholder's
fallback representation, and `start` a syntax error's offset. Formatting reports
`unresolved-variable`, `unknown-function`, `bad-operand`, `bad-option`, `bad-selector` and
`not-formattable`; anything else a custom function throws arrives as `function-error` with the
original as `cause`.

### Default functions

- `:string` formats its operand as text and selects the key equal to it.
- `:number` formats through `Intl.NumberFormat` and selects exact numeric keys, then plural
  categories. Options: `select` (`plural`, `ordinal`, `exact`; literal only), `signDisplay`,
  `useGrouping` (`auto`, `always`, `never`, `min2`), `minimumIntegerDigits`,
  `minimumFractionDigits`, `maximumFractionDigits`, `minimumSignificantDigits`,
  `maximumSignificantDigits`, `trailingZeroDisplay`, `roundingPriority`, `roundingIncrement` and
  `roundingMode`.
- `:integer` truncates its operand, then formats and selects like `:number`, reading `select`,
  `signDisplay`, `useGrouping`, `minimumIntegerDigits` and `maximumSignificantDigits`.

An unannotated variable holding a number formats as `:number`, and one holding a string as
`:string`. A string operand of a numeric function must be a JSON-style number, such as `4.2`.

### Types

- `MessageFormatOptions`, `ResolvedMessageFormatOptions`: the constructor's options and the
  settled ones.
- `MessageErrorHandler`: `(error: Error) => void`, the `onError` callback.
- `MessageErrorType`, `MessageErrorOptions`: the error names and `MessageError`'s options.
- `MessageFunction`: `(context, options, input?) => MessageValue`, with `context` a
  `MessageFunctionContext` (`{ locales, dir, source }`). Literal options and operands arrive as
  strings, local variables as the `MessageValue` their declaration resolved to, and external
  variables as given. Throwing formats the placeholder as its fallback.
- `MessageValue`: `{ type, locale, dir, source, options?, selectKeys?, toParts?, toString?, valueOf? }`.
  A value formats when it has `toParts` and `toString`, and selects when it has `selectKeys`,
  which returns the matching keys, best first.
- `Direction`: `"ltr" | "rtl" | "auto"`.
- `MessagePart`: the union of `MessageTextPart`, `MessageBidiIsolationPart`,
  `MessageMarkupPart`, `MessageFallbackPart`, `MessageStringPart`, `MessageNumberPart`,
  `MessageUnknownPart` and `MessageExpressionPart` (a custom function's part).
- `MessageData`: the MessageFormat 2 data model, `PatternMessage | SelectMessage`, built from
  `Declaration` (`InputDeclaration`, `LocalDeclaration`), `Variant`, `CatchallKey`, `Pattern`,
  `Expression` (`LiteralExpression`, `VariableExpression`, `FunctionExpression`), `Markup`,
  `Literal`, `VariableRef`, `FunctionRef`, `Options` and `Attributes`.

## Pattern: Validate A Catalog, Then Compile It

Check every translation once at load time, report what is broken, and compile the parsed data
model so no message is parsed twice.

```typescript
import { MessageFormat, parse } from "@sdxc/messageformat";
import { isFailure } from "@sdxc/result";

let catalog: Record<string, string> = {
	greeting: "Hello {$name}!",
	inbox: ".input {$count :number}\n.match $count\none {{One message}}",
};

let messages = new Map<string, MessageFormat>();
let problems: string[] = [];

for (let [key, source] of Object.entries(catalog)) {
	let result = parse(source);
	if (isFailure(result)) problems.push(`${key}: ${result.error.type}`);
	else messages.set(key, new MessageFormat("en", result.data));
}

problems; // ["inbox: missing-fallback-variant"]
```

## Pattern: Ordinals And Number Options

`select=ordinal` picks ordinal categories, and the numeric options shape the output.

```typescript
import { MessageFormat } from "@sdxc/messageformat";

let place = new MessageFormat(
	"en",
	`.input {$n :number select=ordinal}
.match $n
one {{{$n}st place}}
two {{{$n}nd place}}
few {{{$n}rd place}}
*   {{{$n}th place}}`,
);
[1, 2, 3, 11, 22].map((n) => place.format({ n }));
// ["1st place", "2nd place", "3rd place", "11th place", "22nd place"]

let total = new MessageFormat(
	"en",
	"{$amount :number minimumFractionDigits=2} total, {$items :integer} items",
);
total.format({ amount: 3, items: 4.7 }); // "3.00 total, 4 items"
```

## Pattern: Right-To-Left Values

User-supplied text can run in either direction. With the default `bidiIsolation`, a string
placeholder is wrapped in First Strong Isolate (U+2068) and Pop Directional Isolate (U+2069),
so a Hebrew or Arabic name keeps the surrounding sentence intact. `u:dir` declares a value's
direction and `u:id` tags its parts.

```typescript
import { MessageFormat } from "@sdxc/messageformat";

let reply = new MessageFormat("en", "{$name} replied");
reply.format({ name: "שלום" }); // "⁨שלום⁩ replied"

let tagged = new MessageFormat("en", "{$name :string u:dir=rtl u:id=author} replied");
tagged.formatToParts({ name: "שלום" });
// [
//   { type: "bidiIsolation", value: "⁧" },
//   { type: "string", source: "$name", locale: "en", value: "שלום", id: "author", dir: "rtl" },
//   { type: "bidiIsolation", value: "⁩" },
//   { type: "text", value: " replied" },
// ]
```

## Pattern: A Custom Function

Register functions by name; they receive the message's locales, the resolved options and the
operand, and throw a `MessageError` to fall back.

```typescript
import { MessageError, MessageFormat } from "@sdxc/messageformat";
import type { MessageFunction } from "@sdxc/messageformat";

let list: MessageFunction = (context, options, input) => {
	if (!Array.isArray(input)) {
		throw new MessageError("bad-operand", "Expected an array", { source: context.source });
	}
	let type = options.type === "or" ? "disjunction" : "conjunction";
	let value = new Intl.ListFormat(context.locales, { type }).format(input.map(String));
	return {
		type: "list",
		locale: context.locales[0] ?? "und",
		dir: "auto",
		source: context.source,
		toParts: () => [{ type: "list", source: context.source, value }],
		toString: () => value,
	};
};

let message = new MessageFormat("en", "Invited: {$people :list}", {
	bidiIsolation: "none",
	functions: { list },
});
message.format({ people: ["Ana", "Ben", "Cy"] }); // "Invited: Ana, Ben, and Cy"
message.format({ people: "Ana" }); // "Invited: {$people}"
```

## Pattern: Folding Markup Into Elements

`format` drops markup; `formatToParts` keeps it, with resolved options, so a renderer can
build elements from it.

```typescript
import { MessageFormat } from "@sdxc/messageformat";
import type { MessagePart } from "@sdxc/messageformat";

interface Node {
	tag?: string;
	options?: Record<string, unknown>;
	children: Array<Node | string>;
}

function toTree(parts: MessagePart[]): Node {
	let root: Node = { children: [] };
	let stack = [root];
	for (let part of parts) {
		let parent = stack[stack.length - 1] ?? root;
		if (part.type === "markup" && "kind" in part) {
			if (part.kind === "close") stack.pop();
			else {
				let node: Node = { tag: part.name, options: part.options, children: [] };
				parent.children.push(node);
				if (part.kind === "open") stack.push(node);
			}
		} else if (part.type !== "bidiIsolation" && "value" in part) {
			parent.children.push(String(part.value));
		} else if ("parts" in part && part.parts) {
			parent.children.push(part.parts.map((item) => item.value).join(""));
		}
	}
	return root;
}

let message = new MessageFormat("en", "{$n :number} new posts, {#link href=$url}read them{/link}");
message.format({ n: 3, url: "/posts" }); // "3 new posts, read them"
toTree(message.formatToParts({ n: 3, url: "/posts" }));
// { children: ["3", " new posts, ", { tag: "link", options: { href: "/posts" }, children: ["read them"] }] }
```

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
		"@sdxc/messageformat": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
