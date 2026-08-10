# The `.spec` v1 Grammar

This document is the normative reference for the v1 notation implemented by
`@pkg/spec`. It concretizes the canonical teaching notation of the design
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

| Token            | Form                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| identifier       | `[A-Za-z_][A-Za-z0-9_]*`, optionally joined into a _path_ by `.` with no surrounding whitespace: `run`, `http.post`, `user.email`                                        |
| keyword          | `use test given when then command fixture let return expect eventually within true false` — reserved; never valid as identifiers                                         |
| string           | `"…"` on one line; escapes: `\"` `\\` `\n` `\t` `\r`                                                                                                                     |
| multiline string | `"""` … `"""`; see below                                                                                                                                                 |
| number           | `-?[0-9]+(\.[0-9]+)?`                                                                                                                                                    |
| duration         | an integer immediately followed by a unit alias accepted by `@pkg/duration` (`ms`, `s`, `m`, `h`, `d`, …): `10s`, `500ms`. Lexes as one token; its value is milliseconds |
| punctuation      | `{` `}` `(` `)` `,` `:` `=`                                                                                                                                              |
| newline          | statement terminator (see "Newline rules")                                                                                                                               |

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

- immediately after an opening `{` and immediately before a closing `}`;
- inside an object literal, where they separate entries (interchangeable with
  `,`);
- inside a parenthesized parameter list.

An object literal used as an argument therefore lets a statement span lines:
the statement ends at the newline after the object's closing `}`.

## Grammar

```ebnf
file        = { use | definition | test } ;

use         = "use" IDENT ;

definition  = command | fixture ;
command     = "command" IDENT [ "(" [ params ] ")" ] block ;
params      = IDENT { "," IDENT } ;
fixture     = "fixture" IDENT block ;

test        = "test" STRING "{" [ phase-given ] [ phase-when ] [ phase-then ] "}" ;
phase-given = "given" block ;
phase-when  = "when" block ;
phase-then  = "then" block ;

block       = "{" { statement } "}" ;
statement   = let | return | expect | eventually | call ;

let         = "let" IDENT "=" rhs ;
return      = "return" rhs ;
rhs         = call-expr | expression ;
call-expr   = "fixture" IDENT
            | PATH argument { argument } ;

expect      = "expect" argument { argument } ;
eventually  = "eventually" [ "within" DURATION ] block ;

call        = PATH { argument } ;

argument    = expression | word ;
word        = IDENT ;                 (* bare identifier in argument position *)

expression  = STRING | MULTILINE | NUMBER | DURATION | "true" | "false"
            | object | PATH ;         (* PATH as expression is a reference *)
object      = "{" [ entry { entry-sep entry } ] "}" ;
entry       = ( IDENT | STRING ) ":" expression ;
entry-sep   = "," | NEWLINE ;
```

Notes:

- A test must contain at least one phase; phases appear at most once each and
  strictly in `given`, `when`, `then` order. Alternation is a parse error.
- `eventually` is only valid inside a `then` block (enforced by the parser).
- A _call expression_ (a tool/command invocation producing a value) is only
  valid as the entire right-hand side of `let` or `return`. Arguments are
  literals, references, objects, or words — never nested calls. This keeps
  every statement linear and diffable.
- A `PATH` on the right-hand side with no arguments is a reference
  (`let e = user.email`); with arguments it is an invocation
  (`let r = run "node" "index.js"`).
- There is deliberately no `if`, `else`, `while`, `for`, `switch`, or `match`
  production, and no operators: no arithmetic, no boolean logic, no
  comparison syntax. Verification happens through `expect`.

## Static rules

- `use NS` imports every tool of namespace `NS` as an unqualified name, for
  the containing file only (**file-scoped**). A command or fixture body
  resolves bare names against the imports of the file that defined it, never
  against the calling file's.
- If a bare name matches more than one candidate — two imported namespaces
  exposing the same tool name, or a suite command colliding with an imported
  tool — using that name is an `ambiguous-name` error naming every candidate,
  reported where the name is used; the fully qualified `ns.tool` form is
  always available. The runtime never guesses.
- Definitions (`command`, `fixture`) may appear in any `.spec` file and are
  suite-global. The loader parses every file, registers all definitions, then
  runs tests — so resolution never depends on file order. Two definitions
  with the same name (across the whole suite) are a `duplicate-definition`
  load error.
- Keywords are reserved everywhere: a command named `test` is a parse error.

## Evaluation

- `let` binds a name in the current test's scope. `given`, `when`, and `then`
  share one scope. Rebinding an existing name is a runtime error.
- References are dotted lookups into bound values: `user.email` reads the
  `email` field of the binding `user`. A missing binding or field is a
  runtime error, not `null`.
- Commands execute with a fresh scope containing only their parameters.
  Fixtures execute with a fresh, empty scope. `return` ends the body and
  produces the value; a body that never returns produces `null`.
- `fixture NAME` runs the fixture's body and yields its returned value. v1
  runs the body on every invocation (no caching, no lifecycle hooks).
- A _word_ argument is passed to the tool as a symbol, distinct from the
  string of the same spelling; the tool's descriptor decides what words it
  accepts (`expect file "x" exists`, `fill textbox "Email" with y`). Only
  tool calls keep words symbolic: when an argument of a suite command (or of
  the value form of `expect`) is a bare identifier, it reads the binding of
  that name instead. To hand a tool a bound value, use a dotted reference
  (`result.stdout`) — a bare identifier in tool-argument position is always
  a word.
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
`headers.authorization` overrides `bearer`/`basic`. The two original forms —
`http.get url` and `http.<verb> url <body>` (bare string → text, any other value
→ JSON) — are unchanged.

### `expect`

Two forms, distinguished by resolving the first argument (never by guessing:
a name that is both a binding and a tool is an error):

- **Value form** — first argument is a reference or literal:
  `expect A` asserts `A` is truthy; `expect A B` asserts deep structural
  equality of `A` and `B`.
- **Observable form** — first argument names an observable tool:
  `expect file "dist/index.js" exists`,
  `expect file "dist/index.js" contains "console.log"`,
  `expect directory "dist" exists`. The tool evaluates the assertion and
  reports expected/observed on failure.

### `eventually`

`eventually { … }` retries its whole block until every statement passes or
the deadline expires; `within 10s` sets the deadline (default 5 seconds, poll
interval 100 milliseconds). Only `expect` statements and calls to
_observable_ tools are allowed inside; invoking an action tool inside
`eventually` is a runtime error, because a retried mutation is not a retried
assertion.

## Files and directories

A suite is a directory (conventionally `spec/`) scanned recursively for
`*.spec` files, in lexicographic path order. `spec/fixtures/` and
`spec/commands/` are ordinary spec files whose role is conventional — since
definitions are suite-global and loaded before any test runs, the convention
is organizational, not semantic.
