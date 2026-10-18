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
sdxc scaffold <name> [field:type ...] [--plural <word>] [--mcp] [--command] [--[no-]test] [--dry-run]
```

`sdxc scaffold post title:string body:text published:boolean` writes:

| What                        | Where                                                                          |
| --------------------------- | ------------------------------------------------------------------------------ |
| Model, registered           | `app/models/post.ts`, as `post` in `app/models/index.ts`                       |
| Migration                   | `database/migrations/NNNN_CreatePosts.sql`, from `createTableStatement`        |
| Factory                     | `database/factories/post.ts`                                                   |
| Validator                   | `app/http/validators/post.ts`, the form's `remix/data-schema`                  |
| Policy                      | `app/policies/post.ts`, `authorizePost(actor, action)`                         |
| Form shared by new and edit | `resources/views/posts/form.tsx`                                               |
| Pages, declared and mapped  | `app/http/controllers/posts/{index,new,show,edit,destroy}.tsx` in `routes/web` |
| Copy                        | a `posts` block in every `resources/locales/*.json`                            |
| `--mcp`: tools              | `app/mcp/tools/posts/{list,get,create,update,delete}.ts`                       |
| `--command`: app commands   | `app/commands/posts/{list,show,create,delete}.ts`                              |
| Test helpers, when missing  | `app/test/database.ts`, and `app/test/mcp.ts` with `--mcp`                     |

The model, validator, policy, pages, tools and commands each get a test beside them, unless
`--no-test` or `make.tests` says otherwise; the generated tests pass on a fresh project.

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

### Field types

A field is `name:type`; the type defaults to `string`. The name is written as the column's
snake_case name (`publishedOn` and `published-on` both become `published_on`); `id`,
`created_at` and `updated_at` belong to every table and are refused. At least one field is
required.

| Type      | Column        | Form control            | Form schema                               | Tool input    |
| --------- | ------------- | ----------------------- | ----------------------------------------- | ------------- |
| `string`  | `c.text()`    | `TextField`             | non-empty `s.string()`                    | `s.string()`  |
| `text`    | `c.text()`    | `Label` + `TextArea`    | non-empty `s.string()`                    | `s.string()`  |
| `integer` | `c.integer()` | `TextField type=number` | `coerce.number()`, whole                  | `s.integer()` |
| `boolean` | `c.boolean()` | `Checkbox`              | `coerce.boolean()`, `false` when unticked | `s.boolean()` |
| `date`    | `c.text()`    | `DateField`             | `YYYY-MM-DD`                              | `s.string()`  |

Every column is `NOT NULL`, as `createTableStatement` writes a column that is not
`.nullable()`, so a form field is required and a row reads back complete. A `date`
is stored as its ISO text, which sorts and compares as a date in SQLite and renders without a
time zone.

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
  missing row is a 404. Each handler asks the policy first and answers 403 when it refuses.
- The policy lets every visitor take every action, and the anonymous set is the one line to
  narrow once the app signs people in.
- Tools and commands bind the model to the invocation's database (`ctx.db`); a tool reports a
  missing row or a refused write with `ToolError`, a command with a failure.
- Tests apply every migration to the in-memory `DB` binding (`app/test/database.ts`) and drive
  pages through the router, tools through `/mcp`, and commands through `invoke()`, with the
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
- The field vocabulary is small; see Deferred.

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

- `references` fields (`author:references`), which need the referenced table's factory in every
  generated test.
- Nullable fields (`subtitle:string?`), decimals (data-table has no floating column and
  `TextField` takes no `step`) and timestamps (`@sdxc/ui` has no date-time field).
- Scaffolds inside a folder (`admin/post`) and in a contract other than `make.routes`.

## References

- [ADR-129: One Folder Layout for Every App](./ADR-129-app-folder-layout.md)
- [ADR-143: `sdxc make` Generators](./ADR-143-sdxc-make-generators.md)
- [ADR-142: `sdxc create` Templates](./ADR-142-sdxc-create-templates.md)

## Current Progress

- [x] Field types, names and pluralization
- [x] Staged declarations and one plan for every write
- [x] Stubs for the model, migration, factory, validator, policy, pages, tools and commands
- [x] Generated project type checks and its tests pass
