# The `.spec` v1 Grammar

This document is the normative reference for the v1 notation implemented by
`@sdxc/spec`. It concretizes the canonical teaching notation of the design
suite (`docs/adr/spec/ADR-001…008`) as recorded in ADR-009. Everything here is
**v1 provisional** in the design suite's sense: binding on this
implementation, open at the design level.

## Lexical structure

- Files are UTF-8 text with the `.spec` extension.
- **Newlines are significant**: they terminate statements. There are no
  semicolons. Blank lines are insignificant.
- **Comments** start with `#` (outside any string) and run to the end of the
  line. They are discarded by the lexer and never affect behavior.
- Spaces and tabs separate tokens and are otherwise insignificant.

### Tokens

| Token            | Form                                                                                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| identifier       | `[A-Za-z_][A-Za-z0-9_]*`, optionally joined into a _path_ by `.` with no surrounding whitespace: `run`, `http.post`, `user.email`. A segment after the first may be digits alone: `result.rows.0.id`                                                            |
| keyword          | `use test given when then setup teardown skip command let return expect eventually within true false` — reserved; never valid as identifiers. `fixture` is reserved too and heads no production, so a file that writes it fails with a message naming `command` |
| string           | `"…"` on one line; escapes: `\"` `\\` `\n` `\t` `\r`                                                                                                                                                                                                            |
| multiline string | `"""` … `"""`; see below                                                                                                                                                                                                                                        |
| number           | `-?[0-9]+(\.[0-9]+)?`                                                                                                                                                                                                                                           |
| duration         | an integer immediately followed by a unit alias accepted by `@sdxc/duration` (`ms`, `s`, `m`, `h`, `d`, …): `10s`, `500ms`. Lexes as one token; its value is milliseconds                                                                                       |
| punctuation      | `{` `}` `[` `]` `(` `)` `,` `:` `=`                                                                                                                                                                                                                             |
| newline          | statement terminator (see "Newline rules")                                                                                                                                                                                                                      |

### Multiline strings

A multiline string opens with `"""` and closes with the next `"""`. Its
content is processed as follows, in order:

1. If the first character after the opening delimiter is a newline, drop it.
2. If the closing delimiter is preceded on its own line only by whitespace,
   drop that trailing whitespace (the final newline of the content is kept).
3. Strip the _common indentation_: the minimum leading whitespace across all
   non-blank content lines (lines that are empty or whitespace-only are
   ignored when computing it) is removed from every line.

No escape sequences are processed inside multiline strings; they are raw.

```
write "index.js" """
  console.log("hello")
"""
```

produces the file content `console.log("hello")` followed by a newline.

### Newline rules

Newlines terminate statements. They are ignored (treated as insignificant):

- immediately after an opening `{` or `[`, and immediately before the closing
  `}` or `]`;
- inside an object literal, where they separate entries (interchangeable with
  `,`);
- inside an array literal, where they separate items (interchangeable with
  `,`);
- inside a parenthesized parameter list.

An object or array literal used as an argument therefore lets a statement span
lines: the statement ends at the newline after the literal's closing brace or
bracket.

## Grammar

```ebnf
file        = { use | command | hook | test } ;

use         = "use" IDENT ;

command     = "command" IDENT [ "(" [ params ] ")" ] block ;
params      = IDENT { "," IDENT } ;

hook        = ( "setup" | "teardown" ) block ;

test        = [ "skip" [ STRING ] ] "test" STRING
              "{" [ phase-given ] [ phase-when ] [ phase-then ] "}" ;
phase-given = "given" block ;
phase-when  = "when" block ;
phase-then  = "then" block ;

block       = "{" { statement } "}" ;
statement   = let | return | expect | eventually | call ;

let         = "let" IDENT "=" rhs ;
return      = "return" rhs ;
rhs         = call-expr | expression ;
call-expr   = PATH argument { argument } ;

expect      = "expect" argument { argument } ;
eventually  = "eventually" [ "within" DURATION ] block ;

call        = PATH { argument } ;

argument    = expression | word ;
word        = IDENT ;                 (* bare identifier in argument position *)

expression  = STRING | MULTILINE | NUMBER | DURATION | "true" | "false"
            | object | array | PATH ; (* PATH as expression is a reference *)
object      = "{" [ entry { item-sep entry } ] "}" ;
entry       = ( IDENT | STRING ) ":" expression ;
array       = "[" [ expression { item-sep expression } ] "]" ;
item-sep    = "," | NEWLINE ;
```

Notes:

- A test must contain at least one phase; phases appear at most once each and
  strictly in `given`, `when`, `then` order. Alternation is a parse error.
- `skip` prefixes `test` and takes an optional reason string, which the summary
  prints. A skipped test is parsed like any other and its body never executes,
  so the reason is the only thing it contributes to the run.
- `eventually` is valid inside a `then` block, a command body, and a `setup` or
  `teardown` hook — everywhere a body may wait for an effect to land. A `given`
  or `when` block refuses it, and so does another `eventually`.
- A _call expression_ (a tool/command invocation written with its arguments) is
  only valid as the entire right-hand side of `let` or `return`. Arguments are
  literals, references, objects, arrays, or words — never another written call.
  This keeps every statement linear and diffable.
- A `PATH` with arguments is an invocation (`let r = run "node" "index.js"`).
  A `PATH` with no arguments is a reference when its head segment is a binding
  (`let e = user.email`); when the head is not a binding and the path
  resolves — honoring the file's `use` — to a zero-parameter command or to a
  tool that requires no arguments, it is that invocation, so
  `let current = browser.url` captures the tool's observed value and
  `let user = create_testing_account` binds what the command produced. That
  reading holds wherever an expression may appear, so
  `format "${name}-${nonce}" { name: who.username, nonce: spec.nonce }` reads
  the tool in the entry where its value belongs. A binding collides with
  neither, because a reference requires a bound head, and a path that is none
  of the three is the usual unknown-name error.
- There is deliberately no `if`, `else`, `while`, `for`, `switch`, or `match`
  production, and no operators: no arithmetic, no boolean logic, no
  comparison syntax. Verification happens through `expect`.

## Static rules

- `use NS` imports every tool of namespace `NS` as an unqualified name, for
  the containing file only (**file-scoped**). A command or hook body resolves
  bare names against the imports of the file that declared it, never against
  the calling file's.
- If a bare name matches more than one candidate — two imported namespaces
  exposing the same tool name, or a suite command colliding with an imported
  tool — using that name is an `ambiguous-name` error naming every candidate,
  reported where the name is used; the fully qualified `ns.tool` form is
  always available. The runtime never guesses.
- Commands may appear in any `.spec` file and are suite-global. The loader
  parses every file, registers all definitions, then runs tests — so
  resolution never depends on file order. Two definitions with the same name
  (across the whole suite) are a `duplicate-definition` load error.
- A suite has at most one `setup` and one `teardown`, in whichever file
  declares them. A second of either kind is a `duplicate-definition` load
  error naming both files.
- Keywords are reserved everywhere: a command named `test` is a parse error.

## Evaluation

- `let` binds a name in the current test's scope. `given`, `when`, and `then`
  share one scope. Rebinding an existing name is a runtime error.
- References are dotted lookups into bound values: `user.email` reads the
  `email` field of the binding `user`. A segment spelled as digits indexes an
  array element, **0-based**, so `result.rows.0.id` reads the first row's `id`.
  The addressing vocabulary's ordinals count from 1 instead (`nth 2`,
  `row 1 column 2`), and the two sit side by side in a real spec. A missing
  binding, field, or index is a runtime error, not `null`.
- A bare path whose head is not a binding is an invocation when it resolves to
  a zero-parameter command (`let user = create_testing_account`) or to a tool
  that needs no arguments (`let current = browser.url`). The rule is the same
  in every expression position — a right-hand side, an object entry, an array
  item, a dotted argument — so `format "${x}" { x: spec.nonce }` reads the tool
  where its value is wanted. The call runs through the ordinary call path, so a
  tool's permission family is gated exactly as a written call would be —
  deny-by-default is preserved — and every `eventually` attempt re-reads it.
  A **bare identifier** in tool-argument position is settled by the tool's own
  descriptor instead, below.
- Commands execute with a fresh scope containing only their parameters, and
  `setup`/`teardown` with a fresh empty one. `return` ends a command body and
  produces the value; a body that never returns produces `null`, and a `return`
  inside a hook is a usage error. A command runs on every call: there is no
  memoization and no lifecycle, so a value wanted once is bound once.
- A bare identifier in **tool-argument** position resolves against the tool's
  own descriptor, in this order:

  1. a **word** when the tool declares a word-kind parameter whose `name` is
     that spelling (`expect html.meta page.text "og:title" exists`);
  2. otherwise a **word** when the parameter at that position is word-kind and
     **required** (`expect file "note.txt" exists`, where `fs.file` declares one
     required word slot accepting `exists` or `contains`);
  3. otherwise a **binding read** of that spelling (`browser.open profile`);
  4. otherwise an `unknown-name` error, saying that the tool declares no such
     word and that nothing is bound under it.

  A spelling that is both a declared word and a live binding is an
  `ambiguous-name` error: rename the binding, or pass it as a dotted reference.
  Required-ness is what makes step 2 safe. A tool's optional options are
  word-tagged and may be written in any order after the required arguments, so
  the moment they begin, position says nothing about what an argument was meant
  to be — `db.query "…" params title on "web"` would otherwise read `title` as
  the word filling `on`'s slot.

- A word reaches a tool as a symbol, distinct from the string of the same
  spelling. Only tool calls keep words symbolic: an argument of a suite command,
  or of the value form of `expect`, reads the binding of that spelling and errors
  when nothing is bound under it.
- Duration literals evaluate to a number of milliseconds.

### Word-tagged tool options

A tool may accept **optional options** introduced by a word that consumes the
argument (or arguments) after it, in any order after the required arguments.
This is the plain word mechanism above — no new grammar — and how the built-in
`http` verbs take request headers, non-JSON bodies, and credentials:

```
http.post "https://id.example.com/oauth/token" form {
	grant_type: "authorization_code"
	code: "abc123"
} headers { authorization: "Basic dXNlcjpwYXNz" }

http.get "https://id.example.com/userinfo" bearer "an-access-token"

http.post "https://id.example.com/oauth/introspect" basic "client-id" "secret" form {
	token: "an-access-token"
}
```

- `headers { Name: "value", … }` — request headers (string→string; a number or
  boolean coerces to its string form); header names are case-insensitive, and an
  explicit `content-type` overrides the body's default.
- `form { field: "value", … }` — an `application/x-www-form-urlencoded` body.
- `json <value>` — an `application/json` body (any value); the explicit form of a
  bare non-string body.
- `text "<string>"` — a `text/plain` body; the explicit form of a bare string
  body.
- `bearer <token>` — consumes one string and sets `Authorization: Bearer <token>`.
- `basic <user> <pass>` — consumes two strings and sets `Authorization: Basic
<base64(user:pass)>` (RFC 7617). It is the one option word that takes two
  values.

A call carries at most one body (the bare body, or one of `json`/`form`/`text`),
at most one `headers` block, and at most one auth option (`bearer` or `basic`);
a second body, a second `headers`, both `bearer` and `basic`, a body on `GET`, an
unknown option word, or a tag with no value is a tool error. An explicit
`headers.authorization` overrides `bearer`/`basic`. The two plain forms —
`http.get url` and `http.<verb> url <body>` (bare string → text, any other value
→ JSON) — need no option word at all.

The same mechanism carries the option words of the other namespaces:

```
http.get "/portfolios" on "web"

db.query "select funds.id from funds where users.email = $1" params email on "web" one

db.query "insert into balances (fund_id, portfolio_balance)" params [ fund.id, amount ] on "backend"
```

A newline ends the statement, so a call and its option words stay on one line.
An object or array literal is the exception the newline rules already grant: its
entries may span lines, so a long argument breaks inside its own brackets.

- `on "<name>"` — which configured base a relative target resolves against
  (`http`, `browser`, `browser.fetch`), and which configured database connection
  a query runs against (`db`). Naming none works when exactly one is configured;
  otherwise the failure lists the names `spec/config.jsonc` declares.
- `params <value>` — the value bound to `$1`, or an array bound to `$1`, `$2`, …
  in order.
- `one` — return the single row, refusing any other row count.

The addressing vocabulary `html` and `browser` share — `field`, `containing`,
`exactly`, `first` / `nth <n>` / `last`, `row` / `column` / `including header`,
`exists`, `count`, `value`, `attribute`, `enabled`, `disabled`, `in_viewport`,
and the `with` of `fill … with` — is this mechanism too, and adds **no
production**: every one of its words is a word parameter its tools declare,
which is what makes a bare identifier there a symbol rather than a binding read.

### `expect`

Two forms, distinguished by resolving the first argument (never by guessing:
a name that is both a binding and a tool is an error):

- **Value form** — first argument is a reference or literal:
  `expect A` asserts `A` is truthy; `expect A B` asserts deep structural
  equality of `A` and `B`; `expect A contains B` asserts containment.
- **Observable form** — first argument names an observable tool:
  `expect file "dist/index.js" exists`,
  `expect file "dist/index.js" contains "console.log"`,
  `expect directory "dist" exists`. The tool evaluates the assertion and
  reports expected/observed on failure.

`contains` is a **substring** when the subject is a string and **membership**
when it is an array, comparing members with the same structural equality the
two-argument form uses; any other type is a usage error naming it. The word is
read this way only in the value form — an observable receives every argument
after the first, so a tool declaring its own `contains` decides what it means
there, which is what `expect file "dist/index.js" contains "console.log"` uses.

`not` inverts whichever form follows and is valid **only** as `expect`'s first
argument; anywhere else it is a usage error explaining that:

```
expect not page contains "twitter:card"
expect not html.meta page.text "og:title" exists
```

Under `not`, an observable that fails with a permission denial still fails the
statement, so a missing grant is never read as the thing being absent.

### `eventually`

`eventually { … }` retries its whole block until every statement passes or
the deadline expires; `within 10s` sets the deadline (default 5 seconds, poll
interval 100 milliseconds). Only `expect` statements and calls to
_observable_ tools are allowed inside; invoking an action tool inside
`eventually` is a runtime error, because a retried mutation is not a retried
assertion.

It may stand in a `then` block, a command body, or a `setup`/`teardown` hook.
A command that waits for the effect it just caused is what makes a sequence of
calls a substitute for the loop the language does not have.

## Files and directories

A suite is a directory (conventionally `spec/`) scanned recursively for
`*.spec` files, in lexicographic path order. `spec/commands/` holds ordinary
spec files whose role is conventional — since definitions are suite-global and
loaded before any test runs, the convention is organizational, not semantic.
