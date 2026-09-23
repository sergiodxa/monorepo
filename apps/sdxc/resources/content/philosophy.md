<section-block id="premise" title="Six habits, kept for sixty packages">

A collection is worth taking as a set only if the next package behaves like the last one. These
{% $packageCount %} were written one at a time, over a couple of years, and what makes them a
collection is not a shared build or a shared release — it is six habits that recur in every one of
them.

Each is stated below with what it costs, and with the decisions where it was argued out. Those
decisions are in the repository, in the open, and they are worth more than this page is: a habit
you can read the reasoning for is one you can decide you disagree with.

</section-block>

<section-block id="failure-is-a-value" title="1. Failure is a value" tone="tinted">

Every fallible entry point answers with a `Result`. Parsing a document, reading a cache, verifying
a signature, sending a message — none of them throw past you, and each failure carries where it
happened, which for a parser means the line and column in the source you handed it.

The cost is real and it is paid at every call site: you check before you use. What it buys is that
the type signature stops lying. A function that says it returns a document returns a document, and
the ones that might not say so in the type rather than in a paragraph of prose nobody reads.

[Result everywhere](/docs/conventions/result-everywhere) is the guide;
[`@sdxc/result`](/docs/packages/result) is the type itself, and it installs alongside anything in
the set that can fail.

</section-block>

<section-block id="the-platform" title="2. The platform is the baseline">

`Request`, `Response`, Web Crypto, `Intl`, `<dialog>`, the Popover API, Invoker Commands. The
starting assumption is that the runtime already has the answer, and a dependency is what you reach
for once it demonstrably does not.

This is why dates are formatted through `Intl` and nothing else,
why the crypto primitives are Web Crypto with a smaller surface over them,
and why caching is the HTTP specification's own semantics rather than an invented policy object.

Each of those had a well-known library available. Each of them would have shipped a second
implementation of something the runtime already does, and a second thing to keep current.

</section-block>

<section-block id="implement-the-spec" title="3. Implement the spec, don't invent one" tone="tinted">

Where a standard exists, follow it. The knowledge transfers, the data interoperates, and the
argument about what the right shape is has already been had by people with more context than a
single author has.

So webhooks are Standard Webhooks,
feature flags are OpenFeature,
feeds are Atom and JSON Feed as published,
and sitemaps are the sitemaps protocol.

<note kind="info">
A spec's field names are the spec's. They live in the serialized document and nowhere else: the
package's own surface is camelCase, like everything you already write, and the translation happens
where the bytes are read and written.
</note>

</section-block>

<section-block id="one-contract" title="4. One contract, adapters at the edge">

The shape recurs so often it is the easiest habit to spot: a vendor-neutral core, and the vendor
behind a driver you can swap, or fake.

Mail has transports.
Rate limiting has stores.
Billing has providers.
Caching has a memory adapter and a Workers KV one,
and jobs have queue adapters.

The point is not portability between vendors, which almost nobody actually exercises. It is that a
test runs the real code against an in-process adapter, so the thing under test is the thing you
deploy.

</section-block>

<section-block id="own-the-core" title="5. Own the core, depend at the rim" tone="tinted">

When a dependency would own something load-bearing — the parser your content pipeline is built on,
the code that decides what a signature means — write it instead. {% $standaloneCount %} of the
{% $packageCount %} pull in nothing from outside the collection.

XML parsing and serialization is first-party,
so is syntax highlighting,
frontmatter,
YAML
and markdown.
This page is a markdown file parsed by that last one.

The rim is where dependencies belong, and there are some: a JOSE implementation, a DOM, an
internationalization runtime. The test is whether replacing it later would be an afternoon or a
rewrite.

</section-block>

<section-block id="written-for-remix" title="6. Written for Remix, usable without it">

These are written for Remix on Cloudflare Workers. That is what they are for, and
{% $remixCount %} of them depend on `remix` directly — the middleware, the routing bindings, the
context integration. Pretending otherwise would undersell exactly the part most readers are here
for.

What the habit actually says is narrower, and it is about where the framework sits: the logic goes
in a core that needs no framework, and the binding is an export you opt into. The authentication
core is independent of Remix and gets its Remix surface as a subpath,
and services reach a request through Remix's own request context rather than a container of this
collection's invention.

So {% $frameworkFreeCount %} of the {% $packageCount %} depend on no framework at all and run
anywhere `fetch` does. That is a consequence of where the seam was drawn, not a marketing position.

</section-block>

<section-block id="reversals" title="What was tried and undone" tone="tinted">

The habits above are what survived. Some things did not.

A service container was adopted here, and eight workspaces took it up. It was removed three months
later, once someone counted what it was actually carrying: one service, almost everywhere, that
the framework's own request context already carries — with one mechanism instead of two.

That reversal is recorded rather than quietly dropped, and it is the more useful half of the
record. A set of habits is only evidence if it is not a highlight reel, so the decisions that were
taken back are written down beside the ones that held.

</section-block>
