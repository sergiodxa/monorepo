# ADR-008: Environments, Targets, and Compatibility Testing

## Status

**Proposed** - 2026-08-08

Part of the spec-language ADR suite introduced in
[ADR-001](./ADR-001-executable-specification-language.md). This ADR depends on
the language constructs of
[ADR-002](./ADR-002-specification-language-design.md), the runtime and plugin
protocol of [ADR-004](./ADR-004-runtime-and-plugin-protocol.md), the interface
capabilities of [ADR-005](./ADR-005-interface-capabilities.md), the workspace
model of [ADR-006](./ADR-006-isolated-test-workspaces.md), and the permission
model of [ADR-007](./ADR-007-deny-by-default-permissions.md); the AI-agent
migration workflow it enables is described in
[ADR-003](./ADR-003-suite-organization-and-shared-definitions.md).

Every substantive claim below carries one of the Decided / Direction /
Illustrative / Open labels defined in ADR-001, and all `.spec`, CLI, and output
snippets in this document are illustrative notation unless stated otherwise —
the semantics carry the label of the paragraph that introduces them, but the
spelling is not frozen.

## Context

The founding promise of this suite is that a specification describes the
observable behavior of an application and survives a rewrite of its
implementation ([ADR-001](./ADR-001-executable-specification-language.md)).
Every other ADR builds machinery in service of that promise: a language that
cannot escape into host-language code
([ADR-002](./ADR-002-specification-language-design.md)), automation technology
hidden behind a language-neutral plugin protocol
([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)), interaction phrased
against accessible semantics rather than DOM internals
([ADR-005](./ADR-005-interface-capabilities.md)), and per-test workspaces that
owe nothing to the host machine
([ADR-006](./ADR-006-isolated-test-workspaces.md)).

All of that can still be undone by one line. A specification that opens
`http://localhost:3000/login` is welded to one developer's laptop; one that
runs `/Users/alice/builds/cli-v2/bin/tool` is welded to one filesystem; one
that launches simulator `AB1F-…` is welded to one workstation's Xcode
install. None of those specs can run against staging, against production, or
against the rewritten implementation the whole project exists to make
testable. The leak is not a style problem — it silently converts a behavioral
contract back into an implementation artifact.

So this ADR settles two questions that are really one design problem. First:
if URLs, executables, and device targets may not live in `.spec`, where do
they live, and how does a spec still say _which application_ it is about?
Second: what does the payoff look like — running one suite against an old
implementation and its replacement, and treating a green run as the
migration's acceptance contract? Compatibility testing is only possible
because the specification is target-blind, and the environment boundary
defined here is what keeps it target-blind.

## Decision

### 1. Behavioral specifications contain no deployment configuration

**Decided.** A `.spec` file describes what the application does. It must not
describe where a particular copy of that application happens to be running
today. Concretely, specifications must not be coupled to:

| Coupling leaked into a spec | The target it silently welds the suite to  |
| --------------------------- | ------------------------------------------ |
| localhost ports             | one developer's machine and process layout |
| local binary paths          | one filesystem, one build output location  |
| staging URLs                | one deployment of one implementation       |
| simulator IDs               | one workstation's installed simulators     |
| infrastructure details      | one hosting and topology choice            |

The rule has one deliberate exception, stated in the same breath: deployment
information may appear in a spec **when that information is itself part of the
behavior being specified**. A specification of a CLI tool legitimately says the
tool is invoked as `node`, because the command's name is part of its observable
contract — every user of the tool types it. What may not appear is the path to
the binary that answers to that name on some particular machine.

**Direction.** That example suggests the general reading: specifications refer
to _logical_ targets — the application's login page, its API, the executable
name its users know — and the environment resolves each logical target to a
_physical_ one — a base URL, a host and port, a binary on a path, an installed
build on a device. The exact resolution mechanism is part of the open
environment-definition question in §2, but the split itself is what makes both
halves of the brief's rule coherent: `run "node"` belongs in the spec, and
_which_ `node` belongs outside it. The same reading reconciles the rule with
values like `post.url` that a fixture returns during a run: a URL that arrives
at runtime is data flowing through the test, not a target baked into the
spec's text, so no coupling has leaked. Whether `browser.open` accepts such
absolute URLs, and how network scoping treats hosts learned only at runtime,
belong to the open grammar question of
[ADR-002](./ADR-002-specification-language-design.md) and the open
permission-scoping questions of
[ADR-007](./ADR-007-deny-by-default-permissions.md).

The alternative — letting each spec carry its own target, perhaps behind a
variable at the top of the file — loses immediately against the suite's goals.
Whatever holds the target must be swappable without touching behavioral text,
because the same behavior must be assertable against local development and
against a rewrite; the moment the value lives in the spec file, every new
target is an edit to the contract itself, and a diff of the contract no longer
means the behavior changed.

### 2. Execution environments own the targets

**Decided.** Execution configuration lives outside the behavioral
specification, in what this suite calls an _execution environment_: the
description of one concrete place to point the suite at. An environment could
configure, per the capability families of
[ADR-005](./ADR-005-interface-capabilities.md):

| Capability family                                                       | What the environment supplies                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| browser                                                                 | the base URL that relative paths resolve against                   |
| http                                                                    | the HTTP API base URL                                              |
| cli                                                                     | the executable a logical command resolves to                       |
| mobile                                                                  | the application target — which build, on which device or simulator |
| plugins generally ([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)) | plugin configuration                                               |

This separation is what lets the same specification — unchanged — run against:

- local development
- preview
- staging
- production
- an old implementation
- a rewritten implementation

Each of those is one environment. The suite is the constant; the environment is
the variable. A team's release pipeline and a team's migration project use the
identical `.spec` files and differ only in what they bind them to.

**Open.** How environments are _defined and selected_ is deliberately not
designed here — not a file format, not a flag set, not a discovery rule. This
suite refuses to commit to one because nothing in the brief constrains the
shape yet, and a premature format would harden into compatibility surface
before the runtime exists to validate it. What any future mechanism must
satisfy already follows from the decisions above: it lives entirely outside
`.spec` files; it can be swapped per invocation without editing behavioral
text; and it is inert data — describing a target must never execute anything
and, per §4, must never grant anything.

**Illustrative.** So that the "run" step of a newcomer's journey is picturable
at all, here is _one conceivable_ shape an environment definition could take —
a mapping that binds, for a `local` target, the physical ends of the logical
targets above:

```
environments {
  local {
    browser.base_url  "http://localhost:3000"
    http.base_url     "http://localhost:3000/api"
    cli.node          "/usr/local/bin/node"
  }
}
```

selected, just as hypothetically, at invocation:

```
spec run --env local
```

This sketch exists only so the reader can picture the moving parts. No element
of it is decided — not the file format, not the flag name, not any discovery
rule — and the open question above stands unchanged. Note also what selecting
an environment does _not_ do: per §4, even with `local` selected, the caller
must still grant access explicitly — for example
`spec run --env local --allow-net=localhost:3000`
([ADR-007](./ADR-007-deny-by-default-permissions.md)).

### 3. Naming the application under specification: `app`

A suite that never names its subject has an awkward gap: the environment must
bind targets to _something_, and a human reading `spec/` may want the subject
stated rather than inferred. The brief sketches a construct for this:

```
app "blog"
```

**Open.** Whether `app` should exist in the language at all, and what semantics
it would have, remains an open question. Because the construct sits exactly on
the boundary this ADR draws, the candidate semantics are worth sketching — each
is a direction, none is decided:

- **A binding point.** The suite declares the logical application it
  specifies; an environment binds targets to that name. This gives environment
  definitions a stable key and would become load-bearing the day one suite
  specifies two cooperating applications, each needing its own browser and API
  targets.
- **A documentation marker.** `app` states the subject for readers and tooling
  but carries no runtime semantics; environments attach to the suite as a
  whole. Cheap, honest about how little is decided, and forward-compatible
  with either richer option.
- **A scoping construct.** In a multi-application suite, `app` scopes which
  target a given interaction addresses — the moderation web app versus the
  public site, say. This is the most powerful reading and also the most
  premature: nothing in the brief's examples yet requires it.

The alternative to all three is having no construct: a suite implicitly
specifies one application, and environments bind at the suite level. That is
the simplest position and may well be sufficient — which is precisely why the
question stays open rather than becoming a decision here.

### 4. Environment knowledge never implies permission

**Decided.** Permissions are separate from environment configuration. Knowing
that a browser target is `http://localhost:3000` does not automatically grant
permission to access it. The caller still explicitly authorizes the
capability under the deny-by-default model of
[ADR-007](./ADR-007-deny-by-default-permissions.md) — illustratively:

```
spec run --allow-net=localhost:3000
```

The tempting alternative is to treat configuration as consent: the target is
written down, so accessing it must be intended. It loses for two reasons. The
principled one: an environment is _data_ — typically committed, shared, and
edited like any other project file — while a permission is _authority_,
granted per invocation by whoever runs the suite. Folding authority into data
turns every config edit into a security decision and makes "what can this run
touch" unanswerable without reading every environment file. The practical one
is the AI-agent workflow
([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)): an agent
that can write specs can plausibly also write environment entries, and an
agent must not be able to mint network, process, or device access for itself
by adding a line of configuration. Under this decision it cannot — the
environment tells the runtime _where_ things are, and only the caller's
explicit grant says the runtime _may go there_.

### 5. Compatibility testing is a first-class use case

**Decided.** A core use case of this project is running the same specification
suite against an old implementation and a replacement implementation. This is
not a side effect of portability; it is one of the reasons the system exists.
The rewrites the suite must survive include:

| Old implementation     | Replacement                          |
| ---------------------- | ------------------------------------ |
| Rails API              | Rust API                             |
| React web app          | another frontend implementation      |
| Zig CLI                | Rust CLI                             |
| Electron desktop app   | native desktop app                   |
| one JavaScript runtime | an independently implemented runtime |

If externally observable behavior remains equivalent, the same `.spec` files
should continue passing without modification. Every layer of the suite
contributes a necessary condition to that sentence. The black-box stance of
[ADR-001](./ADR-001-executable-specification-language.md) means the spec never
asserts anything only the old implementation can exhibit. The plugin
indirection of [ADR-004](./ADR-004-runtime-and-plugin-protocol.md) means the
automation technology can change without the spec noticing. The
accessibility-first interaction of
[ADR-005](./ADR-005-interface-capabilities.md) means a rebuilt frontend
matches the spec if it presents the same roles and names, whatever its markup.
The isolated workspaces of
[ADR-006](./ADR-006-isolated-test-workspaces.md) mean neither implementation's
run can contaminate the other's. And this ADR contributes the last condition:
because the spec is target-blind, pointing the suite at the replacement is
purely an environment change — define a second environment, run the same suite
twice, compare.

That comparison is exactly the acceptance loop of a migration, whether the
replacement is written by a team or by an AI coding agent working against the
suite as its authoritative contract — that workflow, including its iteration
loop, is [ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)'s
subject.

### 6. Worked example: specifying a programming runtime

Nothing exercises the whole argument like specifying a piece of software whose
implementations genuinely compete: a programming runtime. The brief's
illustrative example specifies behavior of something like Node.js without
coupling the tests to Node's implementation language:

```
use fs
use cli

test "executes JavaScript files" {
  given {
    write "hello.js" """
    console.log("Hello")
    """
  }

  when {
    let process = run "node" "hello.js"
  }

  then {
    expect process.stdout "Hello\n"
    expect process.exit_code 0
  }
}

test "supports CommonJS modules" {
  given {
    write "math.js" """
    module.exports = (a, b) => a + b
    """

    write "index.js" """
      const add = require("./math.js")
      console.log(add(20, 22))
    """
  }

  when {
    let process = run "node" "index.js"
  }

  then {
    expect process.stdout "42\n"
  }
}
```

The point is not the exact syntax. Read what appears and what conspicuously
does not. The specs use `use`, `let`, blocks, and `expect` from
[ADR-002](./ADR-002-specification-language-design.md); `fs` and `cli` tools
operating inside the ephemeral workspace of
[ADR-006](./ADR-006-isolated-test-workspaces.md); and observations of exactly
the things a runtime's users can observe — files consumed, stdout produced,
exit codes returned. There is no JavaScript test framework, no Node-internal
API, no absolute path, no machine detail. The only implementation-flavored
token in either test is the string `"node"`, and per §1 that is the
executable's public name — part of the specified contract — while the
environment decides which binary answers to it, and the caller must still
grant process execution at all
([ADR-007](./ADR-007-deny-by-default-permissions.md)).

The consequence is the whole thesis in miniature: these specs could
theoretically run against

- the current Node.js implementation
- an experimental rewrite
- a compatibility runtime written in another language

without rewriting the behavioral specification. Each candidate is one
environment binding `node` to a different artifact; the contract they are
measured against is the same text.

### 7. What a green suite proves — and what it does not

**Decided.** A suite that passes against both implementations proves
equivalence _only for the behaviors the suite covers_. Proving two
implementations completely equivalent beyond those behaviors is an explicit
non-goal of this project
([ADR-001](./ADR-001-executable-specification-language.md)). The suite is a
contract, not a proof: implementations remain free to differ on anything the
contract is silent about — performance, log output, undocumented error text,
behavior at inputs no test constructs.

This caveat is a feature to work with rather than a weakness to apologize
for. It gives a migration a crisp definition of done — the covered behaviors,
nothing more — instead of the unfalsifiable goal of "behaves identically."
And it prescribes the remedy when a real divergence surfaces that the suite
missed: the gap is in coverage, so the fix is a new specification capturing
the behavior that turned out to matter, which from then on binds every
implementation. The contract grows exactly where reality demonstrated it was
too thin.

## Consequences

- A specification suite is portable by construction, and the property is
  reviewable: the forbidden couplings of §1 are concrete things a reader can
  scan a diff for, so deployment leakage can be rejected at review time rather
  than discovered when the second target appears.
- The environment becomes the only artifact that varies per target. Standing
  up a compatibility run costs one new environment definition — the behavioral
  suite is reused untouched, which is what makes rewrite projects and
  agent-driven migrations
  ([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)) cheap to
  evaluate continuously.
- The boundary buys portability with indirection: a spec alone no longer tells
  you which URL or binary a run touched, and answering that requires
  consulting the environment. Accepted — the alternative restores readability
  of one deployment by destroying the ability to have two.
- Because environments are inert data (§4), running against a new target is
  always two explicit acts — binding it and authorizing it — and neither act
  ever hides inside the other.
- Compatibility runs create reporting pressure the suite has not yet designed
  for: two implementations mean two result sets for one contract, and the
  right presentation for that is an open question below.

## Open Questions

- **Should `app` exist in the language, and with what semantics?** The
  construct sits on the exact boundary this ADR draws — it is the natural key
  an environment would bind targets to — but none of the candidate readings
  in §3 (binding point, documentation marker, multi-application scoping) is
  yet forced by a concrete need, and the no-construct position may be
  sufficient for single-application suites.
- **How are execution environments defined and selected?** This ADR decides
  that environments exist and live outside `.spec`, but deliberately commits
  to no configuration format, no CLI selection mechanism, and no discovery
  rule; the design must eventually also settle how environment selection
  composes with the explicit permission grants of
  [ADR-007](./ADR-007-deny-by-default-permissions.md) without ever letting
  configuration imply authority.
- **How should compatibility testing against multiple implementations be run
  and reported?** Running one suite against N implementations raises
  questions this suite has not answered: whether that is N independent runs
  or one matrix-shaped run, how per-target results are presented and
  compared, and how a known, accepted divergence between implementations is
  recorded without weakening the contract for either.
