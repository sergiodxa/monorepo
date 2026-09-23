# @sdxc/messageformat

Unicode MessageFormat 2 parser and formatter shaped like `Intl.MessageFormat`.

## Installation

```bash
npm add @sdxc/messageformat
```

`parse` returns [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values, which
installs alongside this package.

## Usage

### Format A Message

```typescript
import { MessageFormat } from "@sdxc/messageformat";

let message = new MessageFormat("en", "{$count :number} new posts");
message.format({ count: 1200 }); // "1,200 new posts"
```

A message is parsed once, in the constructor, and formats any number of times. Instances are
immutable, so one can be shared by every request that formats it.

### Choose A Variant

```typescript
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
for the message's locale; `select=ordinal` switches to ordinal rules and `select=exact` to exact
keys only.

### Render Markup

```typescript
let message = new MessageFormat("en", "Read {#link href=$url}the guide{/link}.");

message.format({ url: "/guide" }); // "Read the guide."
message.formatToParts({ url: "/guide" });
// [
//   { type: "text", value: "Read " },
//   { type: "markup", kind: "open", source: "#link", name: "link", options: { href: "/guide" } },
//   { type: "text", value: "the guide" },
//   { type: "markup", kind: "close", source: "/link", name: "link" },
//   { type: "text", value: "." },
// ]
```

### Handle Errors

```typescript
let message = new MessageFormat("en", "Hello {$name}!", { bidiIsolation: "none" });

message.format({}, (error) => report(error)); // "Hello {$name}!"
```

A placeholder that fails to resolve formats as its fallback, such as `{$name}`, and the error
goes to `onError`, so a broken translation shows a visible marker and never throws at render
time.

### Check A Message Without Throwing

```typescript
import { parse } from "@sdxc/messageformat";
import { isFailure } from "@sdxc/result";

let result = parse("{$count :number");
if (isFailure(result)) console.error(result.error.type, result.error.start); // "syntax-error" 15
```

## API

### `new MessageFormat(locales, source, options?)`

Compiles `source` (MessageFormat 2 syntax, or a `MessageData` object) for `locales` (a BCP 47
tag, a list of them, or `undefined` for the runtime default). Throws a `MessageError` on a
syntax or data model error, as the proposal specifies. Options:

- `bidiIsolation`: `"compatibility"` (default) wraps each placeholder whose direction may differ
  from the message's in Unicode isolate controls (U+2066 to U+2069); `"none"` leaves the output
  untouched.
- `dir`: the message's base direction, `"ltr"`, `"rtl"` or `"auto"`; defaults to the direction
  of the first locale's script.
- `functions`: custom functions by name, `"ns:name"` included. They take precedence over the
  defaults.
- `localeMatcher`: `"best fit"` (default) or `"lookup"`.

### `format(values?, onError?)`

Formats to a string. Markup formats as the empty string; a failed placeholder formats as
`{source}`. Without `onError`, errors are discarded: the fallback text in the output is the only
sign of them, and formatting never throws. Pass `onError` to log or collect them.

### `formatToParts(values?, onError?)`

Formats to an array of parts:

- `{ type: "text", value }` for literal text.
- `{ type: "bidiIsolation", value }` around a placeholder that needs isolation.
- `{ type: "markup", kind, source, name, id?, options? }` for markup; `kind` is `"open"`,
  `"standalone"` or `"close"`.
- `{ type: "string", source, locale, dir?, id?, value }` for `:string` and plain text values.
- `{ type: "number", source, locale, dir?, id?, parts }` for `:number` and `:integer`, where
  `parts` are
  [`Intl.NumberFormat` parts](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/formatToParts).
- `{ type: "fallback", source }` for a placeholder that failed.
- `{ type: "unknown", source, value }` for a variable that is neither a string nor a number.

The `u:id` option sets `id` on a placeholder's parts, and `u:dir` sets its direction and
isolates it.

### `resolvedOptions()`

Returns `{ bidiIsolation, dir, functions, localeMatcher }` as the instance settled on;
`functions` holds the custom functions passed in.

### `parse(source)`

Parses and validates MessageFormat 2 source into its data model, returning a `Result`. The
failure is a `MessageError` whose `type` is `syntax-error` (with `start` at the offending
offset) or a data model error: `variant-key-mismatch`, `missing-fallback-variant`,
`missing-selector-annotation`, `duplicate-declaration`, `duplicate-option-name` or
`duplicate-variant`.

### `MessageError`

The error every stage reports. `type` names the error as the MessageFormat 2 specification
does, `source` is the failed placeholder's fallback representation, `start` a syntax error's
offset. Formatting reports `unresolved-variable`, `unknown-function`, `bad-operand`,
`bad-option`, `bad-selector` and `not-formattable`; an error a custom function throws that is
not a `MessageError` arrives as `function-error` with the original as `cause`.

### Default Functions

- `:string` formats its operand as text and selects the key equal to it.
- `:number` formats through `Intl.NumberFormat` and selects exact numeric keys, then plural
  categories. Options: `select` (`plural`, `ordinal`, `exact`; literal only), `signDisplay`,
  `useGrouping` (`auto`, `always`, `never`, `min2`), `minimumIntegerDigits`,
  `minimumFractionDigits`, `maximumFractionDigits`, `minimumSignificantDigits`,
  `maximumSignificantDigits`, `trailingZeroDisplay`, `roundingPriority`, `roundingIncrement`
  and `roundingMode`.
- `:integer` truncates its operand, then formats and selects like `:number`, reading `select`,
  `signDisplay`, `useGrouping`, `minimumIntegerDigits` and `maximumSignificantDigits`.

An unannotated variable holding a number formats as `:number`, and one holding a string as
`:string`. A string operand of a numeric function must be a JSON-style number, such as `4.2` or
`-1e3`.

### Types

- `MessageFunction`: `(context, options, input?) => MessageValue`. `context` is
  `{ locales, dir, source }`; literals arrive as strings, local variables as the `MessageValue`
  their declaration resolved to, and external variables as given. Throwing formats the
  placeholder as its fallback.
- `MessageValue`: `{ type, locale, dir, source, options?, selectKeys?, toParts?, toString?, valueOf? }`.
  A value formats when it has `toParts` and `toString`, and selects when it has `selectKeys`,
  which returns the matching keys, best first.
- `MessageData` and its members (`PatternMessage`, `SelectMessage`, `Declaration`, `Variant`,
  `Pattern`, `Expression`, `Markup`, `Literal`, `VariableRef`, `FunctionRef`, `Options`,
  `Attributes`): the MessageFormat 2 data model.
- `MessagePart` and its members, one per part shape listed above.

## Pattern: A Custom Function

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
```

## Pattern: Folding Markup Into Elements

```typescript
import { MessageFormat } from "@sdxc/messageformat";
import type { MessagePart } from "@sdxc/messageformat";

interface Node {
	tag?: string;
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
				let node: Node = { tag: part.name, children: [] };
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

let message = new MessageFormat("en", "{#b}{$n :number}{/b} new posts", { bidiIsolation: "none" });
toTree(message.formatToParts({ n: 3 }));
// { children: [{ tag: "b", children: ["3"] }, " new posts"] }
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
