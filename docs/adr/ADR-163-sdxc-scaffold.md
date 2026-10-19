# ADR-163: `sdxc scaffold`

## Status

**Accepted** - 2026-10-18

## Background

ADR-143 gives `sdxc make` one file per run: a model, a migration, a controller. A resource a
person can list, read, create, change and delete through pages takes a dozen of those runs, and
then most of each generated file is rewritten by hand, because a stub knows nothing about the
resource's fields. This ADR records `sdxc scaffold`, the equivalent of `rails g scaffold`: one
command that writes a working resource, from its table to its pages, with tests that pass.

## Context

- `make` plans each file from a stub, refuses to overwrite anything, and declares and maps what
  it writes through `declare()` (`src/make/declare.ts`), which reads the project from disk:
  the route contract, the router, the sitemap, the model registry, the MCP and command
  declarations and their initializers.
- `declare()` computes each edit against the files as they are on disk, so two declarations in
  the same file planned one after the other would each start from the original text.
- `remix/data-table` builds a table's columns, and `src/make/schema.ts` renders a table
  definition as its `CREATE TABLE` statement (`createTableStatement`).
- The `app` template's pages use `@sdxc/ui`, the page middleware (session, honeypot, i18n,
  document assets), `ctx.models` from the model registry, and `resources/locales/*.json` for copy.

## Decision

### The command

```text
sdxc scaffold <name> [field[:type][?] ...] [--plural <word>] [--mcp] [--command] [--[no-]test] [--dry-run]
```

`sdxc scaffold post title body published` writes:

| What                        | Where                                                                          |
| --------------------------- | ------------------------------------------------------------------------------ |
| Model, registered           | `app/models/post.ts`, as `post` in `app/models/index.ts`                       |
| Migration                   | `database/migrations/NNNN_CreatePosts.sql`, from `createTableStatement`        |
| Factory                     | `database/factories/post.ts`                                                   |
| Validator                   | `app/http/validators/post.ts`, the form's `remix/data-schema`                  |
| Abilities and grants        | `post.*` in `app/policies/abilities.ts` and `policy.ts`, as `make policy` adds |
| Form shared by new and edit | `resources/views/posts/form.tsx`                                               |
| Pages, declared and mapped  | `app/http/controllers/posts/{index,new,show,edit,destroy}.tsx` in `routes/web` |
| Copy                        | a `posts` block in every `resources/locales/*.json`                            |
| `--mcp`: tools              | `app/mcp/tools/posts/{list,get,create,update,delete}.ts`                       |
| `--command`: app commands   | `app/commands/posts/{list,show,create,delete}.ts`                              |
| Test helpers, when missing  | `app/test/database.ts`, and `app/test/mcp.ts` with `--mcp`                     |

The model, validator, abilities (`app/policies/post.test.ts`), pages, tools and commands each
get a test beside them, unless `--no-test` or `make.tests` says otherwise; the generated tests
pass on a fresh project.

- **Top level, not a `make` kind.** A kind writes one file of one kind; a scaffold writes many
  kinds at once and takes a field list no kind takes, so it is its own command beside `make`.
- **Names.** The name is one singular word or a kebab-case phrase without folders (`post`,
  `blog-post`). The model, its key and its files take the singular (`BlogPost`, `blogPost`,
  `app/models/blog-post.ts`); the table, the URLs, the route group, the controller, view, tool and
  command folders and the copy take the plural (`blog_posts`, `/blog-posts`, `blogPosts`).
  Pluralizing follows three English rules (`-s`/`-x`/`-z`/`-ch`/`-sh` add `-es`, a consonant
  then `-y` becomes `-ies`, anything else adds `-s`); `--plural` names any other plural.
- **Routes.** `index` (`GET /posts`), `new` (a `form` route at `/posts/new`: the page and the
  create action), `show` (`GET /posts/:id`), `edit` (a `form` route at `/posts/:id/edit`: the
  page and the update action) and `destroy` (`POST /posts/:id/destroy`, since an HTML form posts).
  The sitemap lists the index and the pages of each row, and leaves the two forms out.
- **Tools and commands.** `--mcp` declares `list_posts`, `get_post`, `create_post`,
  `update_post` and `delete_post` with their JSON Schema input. `--command` declares
  `posts list`, `posts show <id>`, `posts create --<field> …` and `posts delete <id>`.

### Fields

A field is `name`, `name:type`, or either with a trailing `?` (`bio?`, `subtitle:string?`),
which makes it nullable. The name is written as the column's snake_case name (`publishedOn` and
`published-on` both become `published_on`); `id`, `created_at` and `updated_at` belong to every
table and are refused. A scaffold needs at least one field without `?`, which a form must fill.
`sdxc make model` takes the same list (ADR-143), through the same parser.

**A bare name takes its type by convention, and an explicit `:type` always wins.** The rules are
read top to bottom, so `published_at` is a timestamp and `published` a box:

| A bare name                                                                                                   | Takes        |
| ------------------------------------------------------------------------------------------------------------- | ------------ |
| ending in `_id` (`author_id`)                                                                                 | `references` |
| ending in `_at` (`published_at`, `publishedAt`)                                                               | `timestamp`  |
| ending in `_on` or `_date`, or `birthday`, `birthdate`                                                        | `date`       |
| starting `is_`, `has_`, `can_`, `should_`, `was_`, `allow_`; or `published`, `active`, `enabled`, `archived`… | `boolean`    |
| ending in `_count` or `_cents`; or `position`, `quantity`, `age`, `rank`, `priority`, `score`, `year`…        | `integer`    |
| ending in `email` (`email`, `billing_email`)                                                                  | `email`      |
| ending in `url`, or `website`, `homepage`                                                                     | `url`        |
| `body`, `description`, `content`, `notes`, `bio`, `summary`, `excerpt`, `message`… or ending in one           | `text`       |
| anything else                                                                                                 | `string`     |

A name whose words hold `password` is refused whatever its type, unless it ends in `hash` or
`digest`: a scaffold would keep the password as typed and show it on a page. A `?` on a box is
refused, since a checkbox is ticked or not. `zsh` reads `?` as a glob, so a nullable field is
quoted there (`'bio?'`).

| Type         | Column                   | Form control                 | Form schema                               | Tool input    |
| ------------ | ------------------------ | ---------------------------- | ----------------------------------------- | ------------- |
| `string`     | `c.text()`               | `TextField`                  | non-blank `s.string()`                    | `s.string()`  |
| `text`       | `c.text()`               | `Label` + `TextArea`         | non-blank `s.string()`                    | `s.string()`  |
| `integer`    | `c.integer()`            | `TextField type=number`      | whole number, converted                   | `s.integer()` |
| `boolean`    | `c.boolean()`            | `Checkbox`                   | `coerce.boolean()`, `false` when unticked | `s.boolean()` |
| `date`       | `c.text()`               | `DateField`                  | `YYYY-MM-DD`                              | `s.string()`  |
| `timestamp`  | `c.integer()`            | `Label` + `Input` (datetime) | `YYYY-MM-DDTHH:MM` as UTC, to ms          | `s.integer()` |
| `email`      | `c.text()`               | `TextField type=email`       | `local@domain`                            | `s.string()`  |
| `url`        | `c.text()`               | `TextField type=url`         | `URL.canParse()`                          | `s.string()`  |
| `references` | `c.text().references(…)` | `make model` only            |                                           |               |

- **Not null by default.** A column without `?` is `NOT NULL`, as `createTableStatement`
  writes a column that is not `.nullable()`, so a form field is required and a row reads back
  complete. A nullable column is `.nullable()`, its control drops `required`, its form schema
  reads a blank input as `null`, its tool input takes `null`, and its command flag is optional.
- **A `date` is ISO text**, which sorts and compares as a date in SQLite and renders without a
  time zone.
- **A `timestamp` is milliseconds since the epoch in an integer column**, as the template's
  database stamps `created_at` and `updated_at` (`now: () => Date.now()`), so every instant in a
  row reads and sorts the same way. The form takes a `datetime-local` value as UTC; a page shows
  it as ISO text; a tool and a command take the milliseconds. `@sdxc/ui` has no date-time field,
  so the form uses `Input` beside a `Label`.
- **`email` gets no unique index.** An email column is as often a contact field as an identity;
  uniqueness is the app's rule to add with `.unique()` and a migration.
- **A reference is a foreign key to the referenced model's table**, `<table>_<column>_fkey`,
  with the column typed like that table's `id` (text for the UUIDv7 ids models create). The table
  is the one `app/models/<model>.ts` declares, or the plural of the model's name when the
  project has none yet. `author:references` and a bare `author_id` write the same column.
  `sdxc scaffold` refuses a reference: D1 enforces foreign keys, so every generated test that
  writes a row would first need a row of the referenced table; `make model` writes it.

### Composing the kinds

The scaffold uses `declare()` for every declaration and mapping, so a scaffolded route, tool or
command is declared exactly as `make` declares one. Two small options on `DeclarationRequest`
make that possible: `sitemap` replaces the decision a page's pattern implies, and `options`
writes a tool's description and input, or a command's arguments and flags, adding the imports
they use.

**Every write is planned before any is made.** The scaffold copies `app/`, `routes/` and
`tsconfig.json` into a temporary staging folder and runs each declaration there in order, writing
its edits into the copy, so the second declaration in `routes/web.ts` sees the first. Once every
declaration ran, each touched file's edit is its original text against its staged text. The
generated files are rendered from their stubs, every target path is checked to be free, the
locale files and `package.json` edits are computed, and only then does anything reach the
project: a name that is taken, an unknown field type, a locale block that already exists or a
stub with an unknown placeholder leaves the project as it was. `--dry-run` prints every file and
the diff of every edit instead. A declaration `declare()` cannot place falls back as in `make`:
the files are written and the declaration is printed for the user to add.

### Stubs

Each scaffolded file has a stub named `scaffold.<piece>.stub` (`scaffold.model.stub`,
`scaffold.controller.index.stub`, `scaffold.mcp.list.test.stub`…) beside the `make` stubs, so a
project overrides one by keeping a file of that name in `make.stubs`, and `sdxc make stubs
scaffold` copies them to start from. A stub's placeholders are the resource's names in each
spelling (`{{Name}}`, `{{key}}`, `{{pluralKey}}`, `{{table}}`, `{{words}}`…) and blocks the
scaffold renders from the fields (`{{columns}}`, `{{schemaFields}}`, `{{formFields}}`,
`{{tableCells}}`…), which keeps the field-by-field code in one TypeScript table rather than in
loops inside stubs.

### What the generated code does

- Pages render through the page middleware and `DocumentLayout`, with every string from
  `ctx.intl`, `@sdxc/ui` components, and `HoneypotFields` on every form, which the page
  middleware checks on each POST.
- A refused submission renders the form again as a 422 with each issue beside its field. A
  missing row, and one `post.read` hides, is a 404. A write `post.create`, `post.update` or
  `post.delete` refuses is a 403; the index lists only the rows `post.read` allows
  ([ADR-164](./ADR-164-generated-authorization-uses-authz.md)).
- Reads are granted to `everyone` and writes to `member`, which the template binds to a visitor
  whose session holds an `actor`.
- Tools and commands bind the model to the invocation's database (`ctx.db`); a tool reports a
  missing or hidden row and a write the database refuses with `ToolError` and a refused write
  with `ForbiddenError`, a command with a failure. Commands run as the operator and check no
  ability.
- Tests apply every migration to the in-memory `DB` binding (`app/test/database.ts`) and drive
  pages through the router (writes as a member signed in with `app/test/session.ts`, and as a
  refused guest), tools through `/mcp` as a guest and through a member-bound router, and
  commands through `invoke()`, with the
  command line's local database replaced by that binding. A page test allows 30 seconds, since
  its first request imports the page middleware and `@sdxc/ui` while Vitest transforms them cold.

## Consequences

### Positive

- One command gives a resource every layer, wired, with passing tests to change from.
- Declarations stay `make`'s: a fix to how `make controller` maps a route reaches scaffolds too.

### Negative

- A scaffold copies `app/` to a temporary folder for each run. Apps are small, so the copy
  costs milliseconds.
- `declare()` gained two options the `make` command line does not expose.
- Conventions are English words; a name in another language takes `string` until it names its
  type.

## Alternatives Considered

### 1. `sdxc make scaffold`

**Rejected because**: every `make` kind writes one file and takes `<name>` alone; a scaffold
takes a field list and writes a dozen files, and `make stubs` and `make --help` list kinds.

### 2. A virtual file layer inside `declare()`

Thread a map of pending edits through every read `declare()` makes.

**Rejected because**: it touches every reader in a module other commands depend on; a staged
copy gives `declare()` the same view with no change to how it reads.

### 3. Loops in stubs

**Rejected because**: stubs are plain text with placeholders, which keeps them easy to override;
a template language would make every project stub a program.

## Deferred

- Pages, tools and commands for a reference (`author_id`): a select of the referenced rows, and
  generated tests that create the referenced row through its factory first.
- Decimals: data-table has no floating column and `TextField` takes no `step`.
- Scaffolds inside a folder (`admin/post`) and in a contract other than `make.routes`.

## References

- [ADR-129: One Folder Layout for Every App](./ADR-129-app-folder-layout.md)
- [ADR-143: `sdxc make` Generators](./ADR-143-sdxc-make-generators.md)
- [ADR-142: `sdxc create` Templates](./ADR-142-sdxc-create-templates.md)

## Current Progress

- [x] Field types, names and pluralization
- [x] Name conventions, `timestamp`, `email`, `url` and nullable fields
- [x] `make model` fields, references included
- [x] Staged declarations and one plan for every write
- [x] Stubs for the model, migration, factory, validator, policy, pages, tools and commands
- [x] Generated project type checks and its tests pass
