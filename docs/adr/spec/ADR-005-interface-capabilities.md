# ADR-005: Standard Interface Capabilities and Accessibility-First Interaction

## Status

**Proposed** - 2026-08-08

Part of the spec-language ADR suite. This ADR builds on the multi-surface
requirement established in
[ADR-001](./ADR-001-executable-specification-language.md), uses the language
constructs defined in [ADR-002](./ADR-002-specification-language-design.md),
and assumes the plugin architecture of
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md), which is how every
capability described here actually reaches the runtime. The filesystem
capability is treated fully in
[ADR-006](./ADR-006-isolated-test-workspaces.md), permissions in
[ADR-007](./ADR-007-deny-by-default-permissions.md), and environment targeting
in [ADR-008](./ADR-008-environments-and-compatibility.md).

## Context

All `.spec`, CLI, and output snippets in this ADR are **Illustrative** notation
unless the surrounding text says otherwise — the semantics carry the label of
the paragraph that introduces them, but the spelling is not frozen. The
four-way labeling scheme (Decided / Direction / Illustrative / Open) is defined
in [ADR-001](./ADR-001-executable-specification-language.md).

ADR-001 makes the requirement: the specification language must not be designed
specifically for web applications. It must be capable of interacting with
browsers and web applications, HTTP APIs, CLI applications, filesystems and
workspaces, desktop applications, iOS applications and simulators, Android
applications and emulators, and application interfaces that do not exist yet.
ADR-004 makes the mechanism: capabilities arrive as typed, namespaced tools
exposed by plugins over a language-neutral protocol, so a `.spec` file never
names Playwright, Xcode, or any other automation technology.

What is left between the requirement and the mechanism is the vocabulary — the
part of the system a specification author actually touches every day. This ADR
answers three questions:

1. What are the standard capability families, and what does each one address?
2. How does the browser family identify UI, given that browser interaction is
   where implementation coupling most often leaks into tests?
3. How does one specification interact with several families at once, since
   the brief makes that a particularly important requirement rather than an
   edge case?

The temptation this ADR exists to resist is designing a web testing tool with
other surfaces bolted on. Nearly every existing tool in this space is anchored
to exactly one surface: Playwright and Cypress are excellent browser
automation, HTTP client libraries are excellent request-level testing, shell
harnesses are excellent CLI testing. Each does its own surface well — the
prior-art discussion in
[ADR-001](./ADR-001-executable-specification-language.md) credits them
properly. But a behavior that crosses surfaces is precisely where those tools
stop and implementation-language glue code begins, and glue code is what this
project exists to eliminate. So the unit of design here is not "the browser
API plus extras"; it is the **capability family** — a coherent, namespaced set
of typed tools addressing one kind of application interface — and the
specification sits above all of the families equally.

## Decision

Define a standard set of capability families spanning every application
surface the language must reach; make the browser family operate on the
accessibility tree rather than DOM implementation details, with raw CSS
selectors preserved only as an escape hatch; and make cross-interface
specifications an ordinary, first-class way to write a test rather than an
advanced technique.

### 1. The standard capability families

**Decided.** The specification language is multi-surface. Its standard
vocabulary is organized into capability families, each owning a namespace of
typed tools, and one `.spec` file may use any number of them:

| Family     | Namespace | Addresses                                                                      | Example tools                                   |
| ---------- | --------- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| Browser    | `browser` | Web applications, through the accessibility tree (§2)                          | `browser.open`, `browser.click`, `browser.fill` |
| HTTP       | `http`    | APIs at the request/response level                                             | `http.get`, `http.post`                         |
| CLI        | `cli`     | Processes: arguments, stdin/stdout/stderr, exit codes                          | `cli.run`                                       |
| Filesystem | `fs`      | The isolated test workspace ([ADR-006](./ADR-006-isolated-test-workspaces.md)) | `fs.write`, `fs.read`, `fs.mkdir`               |
| iOS        | `ios`     | iOS applications, typically in simulators                                      | `ios.launch`, `ios.tap`                         |
| Android    | `android` | Android applications, typically in emulators                                   | `android.launch`, `android.tap`                 |
| Desktop    | —         | Native desktop applications                                                    | No vocabulary sketched yet                      |

The tool names are Illustrative — they are the same names used throughout this
suite's examples, and they are the canonical teaching notation, but none of
them is a frozen identifier. The table's _shape_ is Decided: namespaced
families, typed tools, no surface privileged over another.

A family is a **contract**; a plugin is an **implementation** of it. The
browser family means "semantic interaction with a web application", and one
plugin may satisfy it with Playwright while another satisfies it with
WebDriver or CDP — the specification cannot tell the difference, which is
exactly the substitutability argument made in
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md). The same holds for
mobile: an iOS plugin may drive simulators through Xcode tooling without a
single Xcode concept surfacing in the language. This is what allows a `.spec`
suite to outlive not only the application's implementation but its own
automation technology.

Three families deserve individual notes:

**HTTP is a behavioral surface, not just plumbing.** **Direction.**
`http.get` and `http.post` serve two distinct roles. When the application
under specification _is_ an API, they are the primary interaction surface and
`expect` runs against responses. When the application is something else, they
are the fastest honest way to arrange state — the fixture example in
[ADR-002](./ADR-002-specification-language-design.md) creates a user through
`http.post` precisely because driving a sign-up form is not the behavior under
test. Both roles are legitimate; the Given/When/Then structure
([ADR-002](./ADR-002-specification-language-design.md)) is what keeps them
distinguishable.

**CLI results are values.** **Direction.** `cli.run` returns a result the
specification can bind and assert against — stdout, stderr, exit code — using
`let`:

```
let result = cli.run "node" "index.js"
```

This makes process behavior specifiable with the same `expect` vocabulary as
everything else. The worked examples live where they belong: the
workspace-centered ones in
[ADR-006](./ADR-006-isolated-test-workspaces.md) and the
runtime-compatibility ones in
[ADR-008](./ADR-008-environments-and-compatibility.md). Note that `cli.run`
executes nothing until the caller grants process permission
([ADR-007](./ADR-007-deny-by-default-permissions.md)).

**Filesystem is its own family, deliberately.** **Direction.** It would have
been easy to fold file operations into `cli` — "processes touch files" — but
the brief decides otherwise: filesystem interaction is a dedicated capability,
because the isolated workspace it operates on is a runtime primitive shared
by _all_ families, not an implementation detail of process execution. A
browser download, a compiler artifact, and an `fs.write` all land in the same
workspace. That primitive, its tools, and its path-safety rules are
[ADR-006](./ADR-006-isolated-test-workspaces.md)'s subject; this ADR only
places `fs` in the roster.

**Desktop is a named requirement without a vocabulary.** **Direction.** The
brief requires the language to reach native desktop applications, and nothing
in the architecture prevents it — a desktop plugin exposes typed tools like
any other. But no standard tool set has been sketched for it, and this suite
does not invent one. It is the least-developed family, and it will likely
mature alongside the device/simulator permission design
([ADR-007](./ADR-007-deny-by-default-permissions.md)).

Finally, the set of families is open-ended by construction. "Future
application interfaces" is a listed requirement, and the architecture absorbs
new surfaces as new plugins exposing typed tools — not as changes to the
language grammar. That is the stable-core-grammar lean argued in
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md). The language mechanics of
using a family — namespacing, `use browser`, and the rule that ambiguous
imported names must error rather than guess — are defined in
[ADR-002](./ADR-002-specification-language-design.md).

### 2. Browser interaction operates on the accessibility tree

**Decided.** The browser family identifies UI through semantics, not through
DOM implementation details. A specification names what a _user_ perceives:

- role
- accessible name
- label
- accessible state

The conceptual model deliberately resembles the semantic locator APIs that
Playwright popularized — `getByRole` and `getByLabel`. That lineage should be
acknowledged plainly: Playwright already demonstrated, at scale, that
role-and-name interaction is both practical and more robust than selectors.
This project adopts the model and removes the part that still couples it to an
implementation ecosystem — the JavaScript test file around it.

The canonical notation, from the brief:

```
click button "Sign in"
fill textbox "Email" with "sergio@example.com"

expect heading "Dashboard"
expect link "Settings"
expect checkbox "Remember me" checked
```

Read the pattern: a verb, a role, an accessible name, and — for `expect` — an
optional accessible state (`checked`). Nothing else. No element IDs, no class
names, no tag hierarchy, no test-specific `data-*` attributes.

The alternative is the industry default: CSS/XPath selectors, or their
politer cousin, dedicated test IDs. It loses on all three of this project's
core commitments:

1. **Rewrite survival.** `.login-form > button.primary` describes one
   frontend's markup. `button "Sign in"` describes the product. Rewrite the
   React app in another framework
   ([ADR-001](./ADR-001-executable-specification-language.md) makes this the
   central use case) and every selector dies while every role/name pair — the
   things the product's users actually rely on — survives. Test IDs are only a
   slower version of the same failure: they must be deliberately re-implanted
   into the new implementation, which makes them implementation contract, not
   behavior.
2. **Black-box honesty.** A selector reads private structure; it is the
   browser equivalent of testing a private method. The accessibility tree is
   different in kind: it is the application's _public, deliberately exposed_
   statement of what its UI means — the same interface the operating system
   hands to a screen reader. Asserting against it stays within observable
   behavior, which is the boundary
   [ADR-001](./ADR-001-executable-specification-language.md) draws around the
   whole project.
3. **Readability as documentation.** `spec/` must function as a functional
   description of the product
   ([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)). A
   non-programmer can read `click button "Sign in"`; nobody can read a CSS
   combinator chain and learn what the product does.

**Direction.** The accessibility-first principle is not browser-specific. It
is intended to generalize to any surface that exposes an accessibility tree —
and both iOS and Android do — so mobile interaction is expected to address
elements semantically as well: by what a user perceives, not by view-hierarchy
internals. The concrete mobile interaction vocabulary, however, remains Open
(see the Open Questions below).

### 3. Raw CSS selectors exist only as an escape hatch

**Decided** that an escape hatch exists; **Decided** that it is not the normal
way to interact with a web application.

Why keep it at all? Because real applications have inaccessible corners —
third-party widgets, canvas-adjacent chrome, legacy screens — and a
specification system that flatly cannot address them does not make those
corners accessible; it makes authors abandon the system and write the test in
Playwright directly, which reintroduces everything this project removes. An
escape hatch inside the language keeps even the ugly cases inside the
portable, permission-governed, plugin-neutral world.

The spelling is unsettled; one illustrative possibility, consistent with the
suite's notation, is an explicit marker that cannot be mistaken for the
semantic path:

```
# Escape hatch: the legacy date widget exposes no accessible name.
# See the accessibility backlog before extending this.
click selector ".legacy-datepicker .next-month"
```

The design intent is that the escape hatch should be _visibly_ an escape
hatch. A selector in a `.spec` file is a signal — in review, in documentation,
and to an AI agent consuming the suite — that this interaction is coupled to
one implementation and will not survive a rewrite. The comment explaining why
it exists is exactly the "comments explain why" role defined in
[ADR-002](./ADR-002-specification-language-design.md).

### 4. An application that cannot be addressed semantically is a defective application

**Direction.** If a piece of UI cannot be reached through role, name, label,
or state, this project's stance is that the problem lies with the application,
not with the specification system.

The reasoning is not aesthetic. The accessibility tree is what assistive
technology receives; a button that the browser family cannot name is a button
a screen-reader user cannot find either. A specification language that bent
its interaction model to accommodate such UI would be optimizing for a defect.
Instead, the design makes accessible UI the path of least resistance:
semantic interaction is the short, pleasant, default notation, and the escape
hatch is deliberately heavier. Teams adopting the language get a continuous,
incidental accessibility audit — the first place an unlabeled input hurts is
the spec suite, which is far cheaper than the first place it would otherwise
hurt.

This is a Direction rather than a Decision because the boundary case is real:
some surfaces (fully canvas-rendered applications, games, visualization-heavy
tools) may never expose a useful accessibility tree, and experience may show
they need more than an escape hatch. A better argument from that corner could
reshape the stance without ceremony. The default posture, though, is firm:
the system does not treat inaccessible UI as a use case to design for.

### 5. One specification may interact with several interfaces

**Decided.** A particularly important requirement — the brief's own words — is
that one specification can interact with multiple interfaces. The
specification describes behavior across the application as a system rather
than being tied to one interface. Users do not experience "the API" or "the
web app"; they experience a product whose surfaces are supposed to agree with
each other, and the honest place to specify that agreement is a single test
that touches both sides.

The canonical example, from the brief — a user created through HTTP, behavior
verified through a browser:

```
test "API-created users can sign into the web application" {
  given {
    let user = create_user {
      email: "sergio@example.com"
      password: "secret"
    }
  }

  when {
    browser.open "/login"
    browser.fill textbox "Email" with user.email
    browser.fill textbox "Password" with user.password
    browser.click button "Sign in"
  }

  then {
    expect browser.url "/"
    expect browser.button "Account"
  }
}
```

Walk through what each line is doing, because this one test demonstrates most
of the suite:

- **`given` arranges state on the cheapest honest surface.** `create_user` is
  a shared definition
  ([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)) whose
  body reaches the application through `http` tools — composed entirely inside
  the spec language, per
  [ADR-002](./ADR-002-specification-language-design.md)'s rule that
  composition never escapes it. The test does not care how the user comes to
  exist; it cares that an API-created user is real to the web application.
  Notice the shape of the call, too: the founding example invokes
  `create_user` like a command and binds its value with `let`. Whether
  value-producing setup like this must be spelled as a `fixture` or may also
  be a value-returning command is an open boundary documented in
  [ADR-002](./ADR-002-specification-language-design.md); this ADR uses the
  founding spelling without resolving it.
- **`when` performs the behavior on the surface being specified.** Every call
  carries its explicit `browser.` namespace. In a single-interface file,
  `use browser` would let these read as bare `open` and `click`
  ([ADR-002](./ADR-002-specification-language-design.md)); in a
  multi-interface test, explicit namespaces are the natural style, because two
  imported families may both plausibly own a name and the runtime must never
  guess.
- **`then` asserts observable outcomes, namespaced the same way.**
  `expect browser.url "/"` and `expect browser.button "Account"` verify the
  navigation result and the signed-in state — through role and name, per §2.
  Both lines are further illustrations of the open `expect` grammar recorded
  in [ADR-002](./ADR-002-specification-language-design.md): an existence
  assertion like `expect browser.button "Account"` may omit an explicit
  condition, and `url` is an observable of the browser session rather than an
  element.
- **Notice what is absent.** No base URL, no port, no browser binary, no
  Playwright, no simulator ID. Where the browser points and how HTTP reaches
  the API are environment configuration
  ([ADR-008](./ADR-008-environments-and-compatibility.md)); whether the spec
  is _allowed_ to reach them is a permission the caller grants explicitly
  ([ADR-007](./ADR-007-deny-by-default-permissions.md)) — and knowing a target
  URL never implies permission to access it. The test itself is pure behavior,
  which is why the same file can run against local development, staging, or a
  rewritten implementation unchanged.

The alternative — one test per surface, glued together by convention ("the API
test suite made a user, so the browser suite assumes one exists") — loses
because the agreement between surfaces is then specified nowhere. It lives in
the heads of whoever ordered the CI jobs, which is exactly the kind of hidden
dependency an executable specification exists to eliminate.

### 6. The recurring cross-interface shapes

The brief calls out a set of cross-interface shapes that any real product
eventually needs. They are worth walking through individually, because each
one teaches something different about how the families compose. All snippets
below are new teaching examples in the suite's illustrative notation.

**CLI → web.** Create something through a CLI and verify it appears in a web
application. The `when` holds both physical interactions because together they
are one logical behavior — publish, then look — which is exactly the latitude
[ADR-002](./ADR-002-specification-language-design.md) gives a `when` block:

```
test "posts published from the CLI appear in the web application" {
  given {
    let user = fixture user
    login user
  }

  when {
    cli.run "blog" "publish" "--title" "Hello from the CLI"
    browser.open "/posts"
  }

  then {
    expect browser.link "Hello from the CLI"
  }
}
```

Which `blog` executable runs is environment configuration
([ADR-008](./ADR-008-environments-and-compatibility.md)), and running it at
all requires an explicit process grant
([ADR-007](./ADR-007-deny-by-default-permissions.md)).

**Web → mobile.** Perform an action on a website and verify its result in a
mobile application:

```
test "posts published on the web appear in the iOS app" {
  given {
    let user = fixture user
    login user
  }

  when {
    browser.open "/posts/new"
    browser.fill textbox "Title" with "Hello from the web"
    browser.click button "Publish"
    ios.launch
    ios.tap "Posts"
  }

  then {
    eventually {
      expect ios.text "Hello from the web"
    }
  }
}
```

Three honest notes on this example. First, `eventually`
([ADR-002](./ADR-002-specification-language-design.md)) is doing real work:
propagation between surfaces is where eventual consistency lives, and
cross-interface tests will lean on it more than single-surface tests do.
Second, placing `ios.launch` and `ios.tap` at the end of `when` — rather than
inside `then`, next to the assertion they serve — is a stylistic choice this
ADR does not settle; what interactions `then` may contain is an open question
owned by [ADR-002](./ADR-002-specification-language-design.md). Third,
`ios.tap "Posts"` and `expect ios.text "Hello from the web"` are illustrative
shorthand for accessible-name matching in the spirit of §2, not a committed
text-matching model — the mobile interaction vocabulary is open (see the Open
Questions below).

**Filesystem → compiler → filesystem, and filesystem → runtime → stdout.**
Create source files, execute a compiler or runtime against them, and inspect
what came out — the shapes that make the language suitable for specifying
programming languages, bundlers, build systems, and developer tools. These
run entirely inside the isolated test workspace, which is the shared
substrate that makes them possible: `fs.write` creates the input, `cli.run`
starts in the same workspace, and assertions inspect the artifacts it left
behind. The worked examples live with their owners — the ES-modules
compiler-shaped example in
[ADR-006](./ADR-006-isolated-test-workspaces.md), and the full "specify a
JavaScript runtime" example, with its compatibility-testing payoff, in
[ADR-008](./ADR-008-environments-and-compatibility.md).

**HTTP → browser.** The canonical example in §5.

**Browser download → filesystem.** **Decided** in substance, Illustrative in
spelling. A browser-initiated download is a cross-interface handoff in the
other direction: the artifact lands in the test workspace, where filesystem
assertions can inspect it. That the download lands there is not a new choice;
it follows from the workspace-sharing contract
[ADR-006](./ADR-006-isolated-test-workspaces.md) decides —

```
when {
  browser.click button "Export CSV"
}

then {
  eventually {
    expect file "export.csv" exists
  }
}
```

— with the file-assertion syntax explicitly undecided, per
[ADR-006](./ADR-006-isolated-test-workspaces.md). The interesting property is
architectural, not syntactic: because the workspace is a runtime primitive
rather than something the `fs` plugin owns privately, the browser plugin can
deposit artifacts into the same place other plugins read from.

**Project tree → package manager → filesystem and CLI.** Create a project
tree, invoke a package manager, and inspect both its filesystem effects and
its CLI behavior. This shape combines everything above and is also the one
that stresses the permission model hardest — a package manager needs both
process execution and network access, and how those grants interact is an
open question recorded in
[ADR-007](./ADR-007-deny-by-default-permissions.md).

Across all of these, the composition rule is uniform: there is no special
"multi-interface mode". Families are just namespaces of tools; a test that
uses two of them is written exactly like a test that uses one. That uniformity
is the payoff of putting the specification above the families instead of
inside any one of them.

### 7. What this ADR deliberately does not settle

Cross-interface specifications expose runtime questions that single-surface
tools get to ignore, and this suite records them rather than improvising
answers.

The clearest is state that lives _outside_ the workspace.
[ADR-006](./ADR-006-isolated-test-workspaces.md) gives every test an isolated,
ephemeral filesystem, and that primitive is well understood. But a browser
session, a signed-in cookie jar, a running simulator, and rows the target
application accumulated during `given` have no equivalent primitive yet. Does
the browser a test opens carry any state from the previous test? Is `login
user` establishing a session whose lifetime anyone has defined? Can two tests
running in parallel share one emulator, or one deployed staging application,
without observing each other? These are genuinely open — the general test-data
isolation question is recorded in
[ADR-006](./ADR-006-isolated-test-workspaces.md), and the session- and
device-shaped parts belong to this ADR's list below.

## Consequences

- Specification authors learn one vocabulary per surface instead of one tool
  ecosystem per surface, and a behavior spanning surfaces is written as one
  test instead of two tests and a convention.
- Accessible UI becomes the cheapest UI to specify. The pressure this exerts
  is intentional: an unlabeled control shows up as friction in the spec suite
  long before it shows up as an excluded user.
- A CSS selector in a `.spec` file becomes a legible warning sign — reviewers,
  documentation readers, and AI agents can treat each one as a marked pocket
  of implementation coupling.
- Plugin authors implement to family contracts, so independently built
  plugins for the same surface remain interchangeable beneath unchanged
  specifications ([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)).
- The runtime inherits coordination duties no single-surface tool has:
  sessions, devices, and cross-surface artifacts must eventually get the same
  disciplined treatment the workspace already has — which is precisely what
  the open questions below track.

## Open Questions

- **How does browser and session state persist — or not — across tests and
  phases?** The isolation story is explicit for the filesystem but undefined
  for the browser: whether cookies, local storage, and the authenticated
  session produced by a command like `login` survive from one test to the
  next (or are torn down like a workspace) determines both the cost of
  `given` blocks and how independent tests really are.

- **What do parallel execution and isolation mean for non-filesystem
  surfaces such as sessions and devices?** Workspaces isolate per-test
  filesystem state, but two tests running concurrently may still contend for
  one browser instance, one iOS simulator, one Android emulator, or one
  deployed target application whose database both are mutating — and the
  runtime has no defined primitive yet for isolating or serializing any of
  those.

- **How is access to devices, simulators, and emulators authorized?** Mobile
  and desktop families touch host resources that are neither the workspace
  nor the network, so they need their own permission treatment; the
  principle — plugins declare required privileges, the runtime enforces
  grants centrally — and the open design of that taxonomy live in
  [ADR-007](./ADR-007-deny-by-default-permissions.md).

- **What is the concrete mobile interaction vocabulary?** The
  accessibility-first principle of §2 is intended to extend to iOS and
  Android, which both expose accessibility trees, but the actual tools have
  not been designed: whether `ios.tap "Posts"` addresses an accessible name,
  a role/name pair, or something else, and what `expect ios.text` really
  matches, are undecided. The examples in §6 are shorthand, not commitments.
