# ADR-004: Runtime Architecture and the Plugin Protocol

## Status

**Proposed** - 2026-08-08

This ADR is part of the spec-language suite introduced in
[ADR-001](./ADR-001-executable-specification-language.md), which also defines
the **Decided** / **Direction** / **Illustrative** / **Open** labels used
throughout. It explains how statements written in the language of
[ADR-002](./ADR-002-specification-language-design.md) actually execute: the
runtime that runs them, the protocol boundary behind that runtime, and the
plugins on the other side of it. The capability families that ride on this
protocol are catalogued in [ADR-005](./ADR-005-interface-capabilities.md), the
workspace primitive that plugins share is
[ADR-006](./ADR-006-isolated-test-workspaces.md), and the permission model the
runtime enforces over every tool call is
[ADR-007](./ADR-007-deny-by-default-permissions.md).

All `.spec`, CLI, protocol, and diagnostic snippets in this document are
illustrative notation unless the surrounding text says otherwise. The
_semantics_ of each snippet carry the label of the paragraph that introduces
it; the _spelling_ is not frozen.

## Context

A `.spec` file can do nothing by itself, and that is by design. The language
has no control flow, no host-language escape hatch, and no built-in library of
side effects ([ADR-002](./ADR-002-specification-language-design.md)). Every
statement that touches the world — opening a page, running a process, writing
a file, sending an HTTP request, tapping a simulator screen — is a call to a
_tool_. The entire executable power of the system therefore lives in whatever
supplies those tools, and the central question of this ADR is what that
supplier looks like.

The conventional answer would be to build the tools into the runtime: link
Playwright for the browser, a process-spawning library for the CLI, an HTTP
client for APIs, platform SDKs for mobile. Every mainstream test framework
works this way, and it fails this project three times over. First, it welds
the plugin ecosystem to the runtime's implementation language — a browser
capability would exist only as a library in that one language, and anyone
extending the system to a new surface would be forced into that language too,
violating the plugin-language independence the suite commits to
([ADR-001](./ADR-001-executable-specification-language.md), principle 5).
Second, it is exactly the coupling the project exists to escape: a language
whose specifications are supposed to survive application rewrites should not
itself be inseparable from one implementation stack. Third, it quietly
recreates the Gherkin problem — behavior expressed in a neutral notation, but
executable only through glue written in a particular host language — which
[ADR-001](./ADR-001-executable-specification-language.md) examines in its
prior-art discussion.

So the executable semantics must come from somewhere that is neither the
`.spec` file nor a library compiled into the runtime. That somewhere is a
plugin, and the rest of this document defines the boundary between the two.

## Decision

### 1. The runtime is the trusted intermediary between a spec and the world

**Decided.** One runtime sits between every `.spec` file and everything those
files affect. It parses and loads the suite, including shared fixtures and
commands, before any test executes
([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)); it
executes each test's statements linearly; it owns the isolated per-test
workspace ([ADR-006](./ADR-006-isolated-test-workspaces.md)); it enforces the
deny-by-default permission model on every privileged operation
([ADR-007](./ADR-007-deny-by-default-permissions.md)); it brokers every tool
call across the plugin protocol; and it collects the diagnostics described in
§8.

Nothing else interprets specification content. Plugins never parse `.spec`
files, never see the suite, and never decide what runs next — they receive
individual, fully-resolved tool calls and answer them. This concentration is
deliberate: a single intermediary is the one place where permission
enforcement can be centralized rather than delegated to plugin self-restraint,
where every effect can be observed for diagnostics, and where execution stays
deterministic regardless of which plugins are installed. The alternative — a
federation in which plugins drive parts of the execution themselves — would
scatter exactly the authority that
[ADR-007](./ADR-007-deny-by-default-permissions.md) requires to live in one
place.

### 2. Every effect crosses a language-neutral protocol boundary

**Decided.** The runtime communicates with plugins through a language-neutral
protocol rather than loading implementation-language libraries directly. The
architectural boundary, from the brief, is:

```
.spec -> runtime -> plugin protocol -> actual automation technology
```

Each arrow is a real seam. A `.spec` file knows nothing about the runtime's
internals; the runtime knows nothing about a plugin's internals; a plugin's
automation technology is invisible to everything on the left of it. Plugins
are separate components that speak a protocol — conceptually similar to how
MCP servers relate to an MCP client — and can therefore be implemented in any
language. A browser plugin in TypeScript, an iOS plugin in Swift, and a
filesystem plugin in Rust can all serve the same runtime, and none of them
needs to share a language with the runtime or with each other.

The in-process alternative loses on more than language coupling. A linked
library executes inside the runtime's address space with the runtime's full
ambient authority, which leaves no natural point at which a permission grant
can be checked before an effect happens; a protocol boundary is where
enforcement and auditing can attach, even though the mechanics of enforcing
grants on an external plugin process remain open
([ADR-007](./ADR-007-deny-by-default-permissions.md)). A protocol boundary
also isolates failure — a crashing plugin is a failed tool call, not a crashed
test run — and it makes substitution (§4) a configuration change instead of a
recompilation.

### 3. A plugin's surface is a set of typed, namespaced tools

**Decided.** What a plugin offers the runtime is a set of tools: named,
namespaced, typed operations. The brief's illustrative inventory shows the
shape:

```
browser.open
browser.click
browser.fill

http.get
http.post

cli.run

fs.write
fs.read
fs.mkdir

ios.launch
ios.tap

android.launch
android.tap
```

Capabilities are namespaced by default, so a spec that reads `browser.open`
wears its provenance on its face and two plugins can both offer an `open`
without colliding. How a spec imports a namespace with `use`, and the rule
that ambiguous names must produce an error rather than a guess, belong to the
language and are specified in
[ADR-002](./ADR-002-specification-language-design.md). What the standard
families (`browser`, `http`, `cli`, mobile, desktop) each contain is
[ADR-005](./ADR-005-interface-capabilities.md)'s subject, and `fs` — a
capability of its own, not an appendage of `cli` — is developed in
[ADR-006](./ADR-006-isolated-test-workspaces.md).

_Typed_ is load-bearing. A tool declares the arguments it accepts and the
shape of the value it returns, because the language binds those values: when a
spec writes `let result = cli.run "node" "index.js"` and later asserts on
`result.stdout` and `result.exit_code`, the runtime must know — at discovery
time, before anything runs — that `cli.run` returns a value with those fields.
Untyped tools would push every mistake to a runtime failure deep inside a
test; typed tools let the runtime validate calls before execution and let
editors, documentation tooling, and AI agents know what a tool call means
without executing it.

### 4. The automation technology is an implementation detail of the plugin

**Decided.** A browser plugin might internally use Playwright, but `.spec`
files must not depend on Playwright. Another browser plugin could later use
WebDriver, CDP, or another technology while exposing compatible capabilities,
and every existing specification would keep passing without a character
changing. Likewise, an iOS plugin might internally use Xcode tooling without
making Xcode concepts part of the core specification language.

This is the suite's founding property applied one level down. Just as the
specification describes what an application does while the source code is one
possible implementation of it, the tool contract describes what a capability
does while a given plugin is one possible implementation of it. The layers
compose cleanly:

```
# what the author wrote (after `use browser`)
click button "Sign in"

# what the runtime sends across the protocol, conceptually
call browser.click { role: "button", name: "Sign in" }

# what one particular plugin does internally, invisibly to everything above
#   drive Playwright — or WebDriver, or CDP — to click that button
```

The spec speaks in accessibility semantics
([ADR-005](./ADR-005-interface-capabilities.md)); the runtime speaks in tool
calls; only the plugin speaks Playwright. If Playwright were named in the
`.spec` file, the specification would die with the automation library — the
exact failure mode this project exists to prevent for applications, and there
is no reason to accept it for tooling.

### 5. The runtime discovers what a plugin offers; it assumes nothing

**Decided.** The runtime does not ship with a hardcoded catalogue of tools. It
discovers, from each plugin, the tools that plugin exposes, their arguments,
their return values, the plugin's protocol compatibility, and potentially
metadata useful for diagnostics and permission enforcement. Each discovered
fact answers a question the runtime cannot otherwise answer:

| Discovery yields          | What the runtime does with it                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Tool names and namespaces | Resolves `use` imports and detects ambiguity ([ADR-002](./ADR-002-specification-language-design.md))      |
| Argument types            | Validates calls before execution; explains bad calls precisely                                            |
| Return value types        | Gives `let` bindings and property access meaning before anything runs                                     |
| Protocol compatibility    | Refuses or negotiates with plugins it cannot correctly talk to                                            |
| Permission requirements   | Gates each tool behind the caller's explicit grants ([ADR-007](./ADR-007-deny-by-default-permissions.md)) |
| Diagnostic metadata       | Knows what artifacts a tool can contribute to a failure report (§8)                                       |

The permission row deserves emphasis because it divides responsibility
precisely: plugins _declare_ the privileges their tools require, and the
runtime — never the plugin — is the authority that _enforces_ whether a
declared requirement is covered by a grant. The declaration format and the
enforcement model are
[ADR-007](./ADR-007-deny-by-default-permissions.md)'s subject; discovery is
merely the channel that carries the declaration.

Discovery is also what makes the ecosystem honest. A statically registered
catalogue would mean every new plugin needs a runtime release, which would
make the runtime's maintainers gatekeepers of every capability — the
protocol-based alternative keeps the runtime ignorant of any specific plugin
and therefore neutral toward all of them.

**Illustrative.** To picture the happy path: a project manifest lists the
plugins the suite uses; at startup the runtime launches each one as a child
process, performs a handshake, and receives that plugin's tool inventory —
everything in the table above flows from that exchange. None of this is
decided — not the manifest, not the transport, not the process lifecycle —
and the corresponding Open Questions below stand unchanged.

### 6. JSON-RPC and MCP inform the protocol; neither is selected

**Open.** The concrete protocol and transport are not chosen in this suite,
deliberately. The brief directs an investigation of approaches such as MCP and
JSON-RPC as architectural inspiration, and forbids selecting one without
enough information to justify the decision. What follows is the honest state
of that comparison, not a verdict.

| Approach     | What it already provides                                                                                                                                                                                                                                              | What it leaves for this system to design                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON-RPC 2.0 | Message framing: requests, responses, errors, notifications. Transport-independent, trivially implementable in every language, decades of practice.                                                                                                                   | Everything above framing: tool discovery, argument and return typing, capability and version negotiation, session lifecycle, artifact transport, process management. Choosing bare JSON-RPC means designing all of it — much of which is what MCP already built on top of JSON-RPC.                                                                                                                                                                                     |
| MCP          | A JSON-RPC base plus the missing layers: an initialization handshake with protocol-version and capability negotiation, tool discovery with schema-typed arguments, change notifications, local (child-process) and remote transports, and SDKs across many languages. | Fit, not features. Its tool results are oriented toward a model consuming content, where this system binds results to typed values (`let result = …`); structured tool output is a newer, less proven part of the protocol. Its safety annotations are advisory hints, while this system refuses to treat plugin self-restraint as a boundary. Sandboxing the plugin process, sharing a per-test workspace, and high-volume diagnostic artifacts are outside its scope. |

The comparison is genuinely favorable to MCP in one respect that should be
recorded: it is an existence proof that this exact shape — a runtime
discovering typed tools from independently implemented, language-diverse
servers over a language-neutral protocol — works at ecosystem scale. Nothing
in this suite's plugin model is novel relative to it, and
[ADR-001](./ADR-001-executable-specification-language.md) discusses that
lineage as prior art. But being inspired by a protocol and adopting it are
different acts, and adoption today would be a guess.

What is missing to decide is a set of answers this suite does not yet have.
Whether plugins are only local child processes or may be remote services
determines the transport requirements. How the runtime enforces permissions on
an external plugin process ([ADR-007](./ADR-007-deny-by-default-permissions.md))
determines what the protocol must expose to the enforcement layer. Whether
`let` bindings demand richer return-value schemas than any existing protocol
carries determines how much would need extending. How workspace state reaches
a plugin that is not on the local machine
([ADR-006](./ADR-006-isolated-test-workspaces.md)) and how screenshots,
traces, and filesystem diffs flow back (§8) determine the artifact channel.
Each of these appears in this ADR's Open Questions; when they close, the
protocol selection has its justification — and only then.

### 7. Extensibility comes from vocabulary, not grammar

**Direction.** Plugins should expose typed tools through a stable core grammar
rather than defining arbitrary new grammar. A new capability enters the system
as new _names_ — another namespace full of typed tools — never as new
_syntax_.

The alternative is seductive and ruinous. If plugins could extend the grammar,
a `.spec` file would no longer parse without the exact plugin set that shaped
it: the suite would stop being readable as standalone product documentation,
editors and LSP servers would need plugin-aware parsers, AI agents could not
be taught the language once, and two plugins could introduce mutually
ambiguous constructs with no principled resolution. Every property the
language buys with its restraint — determinism, learnability, one grammar for
every tool that processes it
([ADR-002](./ADR-002-specification-language-design.md)) — depends on the
grammar being closed. With a closed grammar, a spec written against plugins
you do not have installed still parses, still reads, and still documents; it
merely cannot execute until the capability is present.

**Open.** The precise boundary is not drawn. The illustrative notation
includes call shapes with real surface texture — `fill textbox "Email" with
user.email` reads as language, not as a bare function call — and whether such
shapes are fixed patterns of the core grammar that any tool can slot into, or
something a plugin can influence, is part of the open question of how much
plugins can extend the language.

### 8. Diagnostics are structured and flow from both sides of the protocol

**Decided.** Excellent diagnostics are a design requirement of the suite
([ADR-001](./ADR-001-executable-specification-language.md), principle 15), and
the architecture must eventually support rich, structured diagnostics — not
prose logs — originating from both the runtime and the plugins. The brief
enumerates the kinds a failure report should be able to carry:

| Diagnostic                              | Typical origin                       |
| --------------------------------------- | ------------------------------------ |
| Failing statement                       | Runtime                              |
| Expected vs observed values             | Runtime                              |
| Screenshots                             | Browser / mobile plugins             |
| stdout/stderr                           | CLI plugin                           |
| HTTP requests/responses                 | HTTP plugin                          |
| Filesystem diffs or generated artifacts | Workspace / filesystem capability    |
| Timing                                  | Runtime                              |
| Traces                                  | Runtime and plugins                  |
| Permission denials                      | Runtime                              |
| Required permissions                    | Runtime, from declared tool metadata |
| Plugin-specific artifacts               | The plugin that produced them        |

The split between the columns is the architectural point. The runtime knows
_which statement_ failed, what was expected, and what permission was missing;
only the plugin knows what the page looked like, what the process printed, or
what went over the wire. A useful failure report needs both, which means the
plugin protocol must be able to carry diagnostic artifacts alongside return
values — a real design pressure on the protocol selection in §6, since
screenshots and traces are a different payload class than a JSON response.
Permission denials are the one kind with a decided quality bar of their own: a
denial must name the operation that was refused and the explicit grant that
would permit it, as specified in
[ADR-007](./ADR-007-deny-by-default-permissions.md).

The final reporting format — how these are serialized, rendered, and stored —
is deliberately not designed in this suite. What is decided is the
architecture's obligation to support them.

## Consequences

- The protocol becomes the system's compatibility surface. Applications may be
  rewritten and automation libraries swapped, but the tool contracts and the
  protocol beneath them must be versioned and negotiated with care — which is
  why capability/version negotiation is an open question rather than an
  afterthought.
- Plugins and the runtime evolve independently, in different languages, on
  different release cadences. No capability requires the runtime maintainers'
  participation to exist.
- A `.spec` suite is parseable, readable, and documentable with zero plugins
  installed. Missing plugins make specs unexecutable, never unreadable.
- Two plugins claiming the same capability family can drift apart in behavior.
  "Compatible capabilities" (§4) is a conformance question the standard
  families of [ADR-005](./ADR-005-interface-capabilities.md) will have to make
  precise.
- Every effect pays a protocol round-trip and the runtime is a single point of
  failure. Both are accepted: the boundary is what makes enforcement,
  diagnostics, and substitutability possible, and a runtime bug is at least a
  bug in one place.

## Open Questions

- **Plugin installation and discovery.** The runtime discovers tools from a
  plugin it is already talking to (§5), but how does it come to be talking to
  it — how does a project declare which plugins it needs, how are they
  obtained and updated, and how does the runtime locate them at startup?
  Execution environments configure plugins
  ([ADR-008](./ADR-008-environments-and-compatibility.md)), but the
  installation and distribution story is undesigned.
- **Plugin protocol and transport.** Which concrete protocol does the runtime
  speak — MCP, a purpose-built JSON-RPC-based design, or something else — and
  over which transports? §6 records what each candidate offers and the
  information still missing before a selection would be justified.
- **Local child processes vs remote plugins.** Must the protocol support
  plugins running elsewhere — device farms, remote simulators, shared browser
  infrastructure — or only child processes on the local machine? The answer
  constrains the transport, decides how workspace state is exposed to a
  non-local plugin ([ADR-006](./ADR-006-isolated-test-workspaces.md)), and
  changes what permission enforcement can technically mean
  ([ADR-007](./ADR-007-deny-by-default-permissions.md)).
- **Capability and version negotiation.** How do the runtime and a plugin
  agree on a protocol version and on versions of individual tool contracts,
  and what happens when a suite depends on a tool the installed plugin version
  does not provide — a hard refusal before execution, a per-test failure, or
  some declared-compatibility scheme?
- **Whether tools distinguish mutations from observations.** Should a tool's
  contract mark it as mutating the system under test or as purely
  observational? The distinction would let the runtime restrict `then` blocks
  to observations and retry `eventually` blocks safely
  ([ADR-002](./ADR-002-specification-language-design.md)) — but any such
  marking is plugin-supplied metadata, and
  [ADR-007](./ADR-007-deny-by-default-permissions.md) forbids treating plugin
  self-description as a security boundary, so its trust model needs design.
- **How much plugins can extend the language.** §7 leans toward a closed core
  grammar with plugin-supplied vocabulary, but the line is not drawn: are
  readable call shapes like `fill textbox "Email" with …` fixed grammar
  patterns any tool slots into, or can plugins shape them — and if the former,
  how expressive can a tool's argument surface be while remaining plain
  vocabulary?
