# Agent instructions

<!-- sdxc:start · sdxc upgrade rewrites this section from the release it installs; keep project rules outside it -->

## sdxc conventions

A Remix v3 app on Cloudflare Workers, built on the `@sdxc/*` packages. Every package is
documented at `https://sdxc.dev/api/<name>.md` (`https://sdxc.dev/api/result.md` for
`@sdxc/result`), and the guides at https://sdxc.dev/docs.

### Commands

Read a command's flags from `sdxc <command> --help`, which always matches the installed version,
and what each command is for in the guides, starting from
https://sdxc.dev/docs/getting-started/the-sdxc-command.

```sh
sdxc make <kind> <name>            # write a file where the layout puts it, with its test
sdxc make <kind> <name> --dry-run  # print what it would write, and write nothing
sdxc make model <name> [field...]  # a model, the migration creating its table, and its factory
sdxc make secret <NAME>            # declare bindings.secret() and append .env.example
sdxc make binding <kind> <NAME>    # declare a Cloudflare binding in cloudflare.config.ts
sdxc make do <Name> [--role …]     # Durable Object class, worker re-export and binding
sdxc scaffold <name> [field:type]  # model, migration, pages, tests and a feature .spec
sdxc setup                         # list installable features (auth, billing, flags)
sdxc setup auth [-y]               # OIDC relying party; prints a plan unless -y writes it
sdxc fix                           # re-run command-shaped doctor repairs (typegen, ui, …)
sdxc fix env                       # append missing secrets to .env.example
sdxc fix models                    # register unmapped createModel modules
sdxc fix emails                    # map unmapped emails in the mail initializer
sdxc ui add <component>            # copy an @sdxc/ui component into the app to edit it
sdxc routes --json                 # every route, its controller and the middleware it runs
sdxc doctor --json                 # release drift, installs, secrets, migrations and wiring
sdxc run <command>                 # the app's own command line: db migrate, db console, typegen
sdxc run db prepare                # migrate the local database, seeding it when it is new
sdxc run db fresh --seed           # drop every local table, apply every migration, seed
sdxc run console                   # Bun's REPL with the local db and models on globalThis
sdxc upgrade                       # move every @sdxc package to the latest release
sdxc deploy --dry-run              # build and print the deploy plan, changing nothing
bunx spec run spec --allow-config  # black-box .spec suite under spec/
bun check                          # format, lint and type check
bun run test                       # every test, under Vitest
```

- Create every file a feature needs with `sdxc make`, then fill it in. The kinds are
  `controller`, `middleware`, `validator`, `job`, `model`, `migration`, `factory`, `service`,
  `policy`, `initializer`, `email`, `mcp` and `command`. `make` writes the test beside the file
  and declares and maps controllers, jobs, MCP tools, commands and emails, so the file works at
  once. Controllers, commands and MCP tools also get a pairing `.spec` under `spec/` (pages use
  `browser`, API routes use `http`, commands use `cli`, MCP tools use `mcp`); `--no-spec` or
  `make.specs: false` skips it. `sdxc make email <name> field ...` takes fields as `make model`
  does; they become the email's props. Bindings and Durable Objects use `sdxc make secret`,
  `sdxc make binding` and `sdxc make do` instead of hand-editing `cloudflare.config.ts`.
- Install a multi-file feature with `sdxc setup <feature>` (`auth`, `billing`, `flags`). Without
  `-y` it prints the plan and writes nothing; `-y` applies it. Prefer `sdxc fix` over re-typing
  a doctor finding's fix string when the repair is command-shaped, env, models or emails.
- For a resource people list, show, create, edit and delete, start from
  `sdxc scaffold <name> title body:text` (`--mcp` and `--command` add its tools and commands, and
  one feature `.spec` mixes the surfaces the scaffold wrote).
- `sdxc make policy <resource>` adds the resource's `create`, `read`, `update` and `delete`
  abilities to `app/policies/abilities.ts` and grants them in `app/policies/policy.ts`, reads to
  `everyone` and writes to `member`. Check them in a handler with `ctx.access.can(…)`: a hidden
  read answers 404, a refused write 403. A signed-in visitor (`ctx.session.set("actor", { id })`)
  is a `member`; tests sign in with `signIn()` from `app/test/session.ts`.
- `sdxc make middleware <name> --mount <router|page|api>` also adds the middleware to that chain.
- `sdxc make model post title body published_at` writes the model, the migration creating its
  plural table (`posts`) and its factory; `--skip migration,factory` leaves those out.
- Change a table with `sdxc make migration add-slug-to-posts 'slug?'` or
  `remove-slug-from-posts slug` (`create-posts title …` creates one). After changing a model's
  columns, write its migration with `sdxc make migration <name> --from-model <model>`; read its
  warnings before applying it. Apply migrations with `sdxc run db migrate`.
- Seed the local database from `database/seed.ts`: a `defineSeed(registry, { … })` from
  `@sdxc/data-model/seed`, whose named steps run in order and write through `models` for fixed
  rows or `factories` (`database/factories/`) for generated ones. `db seed`, `db fresh` and
  `db prepare` refuse `--remote`.
- Read `sdxc routes --json` to find the controller and middleware behind a URL; narrow it with
  `-g <text>`, `-c <controller>`, `--method`, `--contract`, and `--unused` for what no router maps.
- Run `sdxc doctor` after an upgrade or a structural change; each finding names its fix.
- Build UI from `@sdxc/ui` components; `sdxc ui add` copies one in when it needs changes.
- `sdxc upgrade` prints a prompt with the release notes to apply; follow it, then run
  `bun check` and `bun run test`.
- Run `bun check` and `bun run test` before every commit.

### Where code goes

| If the code…                                                                                             | It goes in                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| is the Worker, browser, command-line or REPL entry point                                                 | `bootstrap/` (`worker.ts`, `browser.ts`, `cli.ts`, `console.ts`)   |
| is a Durable Object class                                                                                | `app/models/` when it owns stored state, `app/services/` otherwise |
| builds the one instance of something (logger, router, dispatcher, MCP handler, database, mailer, assets) | `app/initializers/`                                                |
| handles HTTP: controllers, middleware, input validators                                                  | `app/http/{controllers,middleware,validators}/`                    |
| is a background job, an MCP tool or resource, an email                                                   | `app/jobs/`, `app/mcp/`, `app/emails/`                             |
| is a command for `sdxc run`                                                                              | `app/commands/`                                                    |
| reads or writes stored state, in any storage (D1, KV, R2, Durable Object)                                | `app/models/`                                                      |
| is a rule about one model                                                                                | a method on that model                                             |
| is business logic across models, or a rule about none                                                    | `app/services/`                                                    |
| is an authorization rule                                                                                 | `app/policies/`                                                    |
| is a view, component, layout, stylesheet or translation                                                  | `resources/` (`resources/locales/` for translations)               |
| is a route contract, a migration, a test factory, the seed                                               | `routes/`, `database/{migrations,factories}/`, `database/seed.ts`  |
| is static configuration (site constants, security policy, security.txt, API problems)                    | `config/`                                                          |
| is any other test helper                                                                                 | `app/test/`                                                        |

- `bootstrap/` holds entry points only, and only `bootstrap/` imports from it. A Durable Object
  class lives where its role puts it, and `bootstrap/worker.ts` re-exports it in one line.
- Every file lives in a folder the table names. Code with no knowledge of the app belongs in a
  package of its own.
- An initializer exports a singleton, or a function when the instance needs per-request input.
- Group a crowded layer by feature with the same folder name in every layer
  (`app/jobs/billing/`, `app/services/billing/`).
- `app/mcp/` declares tools in `tools/index.ts` and resources in `resources/index.ts`, with one
  handler file per tool or resource beside them; `app/initializers/mcp.ts` maps each one
  through `lazy()` from `@sdxc/mcp/server`. `app/commands/` follows the same shape, with the contract
  in `app/commands/index.ts` and the wiring in `app/initializers/cli.ts`.

### Writing code

- Map every route through `lazy()` from `@sdxc/lazy-route`, so a request loads only the
  controller it reaches; a route group's guards go in `lazy()`'s second argument.
- Write the router's global middleware inline in `createRouter({ middleware: [...] })`.
  Middleware publishes services onto the context (`ctx.db`, `ctx.models`, `ctx.email`), so a
  handler reads them there and a test installs its own.
- Send an email by its declaration, with the reader's language rather than translated copy:
  `ctx.email.send(emails.welcome, { to, locale, props })`, or `queue()` for a delivery that must
  survive a failure. The template translates with `handle.props.t`, so a queued delivery stays
  plain JSON.
- Give every email template a `preview()`: `bun dev` lists and renders each one at `/_emails`, and
  `sdxc run emails preview <name> --locale <language>` prints it.
- Build UI with `remix/component` JSX, styled with `css()` mixins through `mix`. Render server
  HTML as JSX. A page renders through `ctx.render()` inside `DocumentLayout`, passing it
  `ctx.assets` for the stylesheets, entry script and CSP nonce.
- Build dialogs, popovers, menus, tooltips and disclosures with the platform: `<dialog>`, the
  Popover API, `<button commandfor command>`, and `<details>`. Reach for JavaScript only for
  behavior HTML cannot express.
- Return a `Result` from `@sdxc/result` (`success`, `failure`, `wrap`) for an operation that
  can fail, so callers see the failure in the type.
- Log through `ctx.log` in controllers, jobs and commands, and `currentLog()` from
  `@sdxc/logger` anywhere else; every line then carries the request's `trace_id`.
- Validate every untrusted input (params, forms, JSON bodies, webhooks, environment values) with
  `remix/data-schema`.
- Run background work as a job from `@sdxc/jobs` (`sdxc make job`).
- Import `env` from `cloudflare:workers`. Declare each binding in `cloudflare.config.ts`, then
  run `sdxc run typegen`; declare each secret with `bindings.secret()` and list it in
  `.env.example`.
- Call the global `fetch` directly; tests intercept it with MSW.
- Create record ids with `generateUUID` from `@sdxc/uuid/v7`, other identifiers with
  `@sdxc/uuid/v4`, and secrets (tokens, codes, OAuth `state`) with `randomToken` from
  `@sdxc/crypto`.
- Write each multi-step database change as a single statement or upsert, or with compensating
  steps: D1 commits every statement as it runs. Keep every migration chain applicable to an
  empty database.
- Use `let` for local variables and `const` for module-level constants, named in
  `UPPER_SNAKE_CASE`. Prefer `interface` to `type`, and import types in their own
  `import type` statement.

### Testing

- Write tests with Vitest, in a `*.test.ts` file beside the module.
- Back database tests with the in-memory D1 from `@sdxc/cloudflare-mocks/sqlite`: `migrate()` and
  `factories()` from `app/test/database.ts` apply the migrations and seed rows through the models.
- Call MCP tools in tests with `callTool()` from `app/test/mcp.ts`, through the app's router.
- Mock outbound HTTP with MSW (`setupServer` from `msw/node`).
- Add a regression test with every bug fix, one that fails without the fix.

### Deploying

`sdxc deploy` builds, then runs this app's `db migrate --remote` and `deploy` commands, so the
new code reaches production only once its schema is there. Change how the app migrates or ships
in `app/commands/db/migrate.ts` and `app/commands/deploy.ts`, never by running `cf deploy` by
hand. It changes production, so run it only when asked to deploy, and print the plan first:

```sh
bun check
sdxc deploy --dry-run
sdxc deploy
```

<!-- sdxc:end -->

## This project

Rules for this project go here. `sdxc upgrade` keeps everything outside the sdxc section as
you wrote it.
