---
title: Building a Monorepo with Shared Packages
excerpt: A monorepo with shared packages lets you reuse code across apps while keeping everything in sync.
technologies: bun@1.0.0
---

Code duplication across projects is a silent productivity killer. You fix a bug in one app, then remember you need to fix it in three others. You improve a utility function, then copy it everywhere. Eventually, the implementations drift apart, and you end up maintaining slightly different versions of the same code.

A monorepo with shared packages solves this problem by putting all your applications and their shared code in a single repository. Changes to shared code are immediately available to all apps, and you can refactor across the entire codebase in a single commit.

## The Structure

A typical monorepo separates applications from shared packages:

```txt
monorepo/
├── apps/
│   ├── blog/
│   ├── auth/
│   └── uptime/
├── packages/
│   ├── result/
│   ├── validate/
│   ├── logger/
│   ├── cn/
│   └── ui/
└── package.json
```

Applications live in `apps/` and contain the actual deployable code: your web apps, APIs, or services. Packages live in `packages/` and contain reusable code that multiple apps can share.

## Workspace Configuration

Bun's workspace feature connects everything together. The root `package.json` declares which directories contain workspace packages:

```json {% path="package.json" %}
{
	"name": "monorepo",
	"private": true,
	"workspaces": ["apps/*", "packages/*"],
	"type": "module"
}
```

The `workspaces` array uses glob patterns to include all directories under `apps/` and `packages/`. Each directory becomes its own package with its own `package.json`.

## The @pkg Namespace

Internal packages use a consistent namespace to distinguish them from external dependencies. The `@pkg/` prefix makes it immediately clear when you're importing shared code:

```ts
import { success, failure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { cn } from "@pkg/cn";
```

Compare this to importing from `../../packages/result/src/index.ts`. The namespace is cleaner, more portable, and works regardless of where the importing file lives in the directory structure.

Each package declares its name with this namespace:

```json {% path="packages/result/package.json" %}
{
	"name": "@pkg/result",
	"version": "0.0.1",
	"private": true,
	"type": "module",
	"exports": {
		".": "./src/index.ts"
	}
}
```

The `private: true` field prevents accidental publishing to npm. The `exports` field defines what other packages can import.

## Packages Depending on Packages

Shared packages can depend on other shared packages. This creates a layered architecture where lower level utilities support higher level abstractions.

For example, a validation package might depend on a result package for error handling:

```json {% path="packages/validate/package.json" %}
{
	"name": "@pkg/validate",
	"version": "0.0.1",
	"private": true,
	"type": "module",
	"exports": {
		".": "./src/index.ts"
	},
	"dependencies": {
		"@pkg/result": "workspace:*",
		"@pkg/types": "workspace:*"
	}
}
```

The `workspace:*` syntax tells Bun to resolve this dependency from the local workspace rather than fetching it from npm. The `*` means "use whatever version is in the workspace."

This dependency chain appears in the actual code:

```ts {% path="packages/validate/src/index.ts" %}
import type { Result } from "@pkg/result";
import { success, failure } from "@pkg/result";

export async function validate<Schema extends StandardSchemaV1>(
	input: FormData | URLSearchParams | Request | Record<string, unknown>,
	schema: Schema,
): Promise<Result<StandardSchemaV1.InferOutput<Schema>, ValidationError>> {
	// ... validation logic

	if (result.issues) {
		return failure(new ValidationError(result.issues));
	}

	return success(result.value);
}
```

The validation package uses the [Result pattern](/articles/result-objects-in-ts) from `@pkg/result` to return typed success or failure values. Any app using `@pkg/validate` gets consistent error handling without knowing about the underlying result package.

## Apps Consuming Packages

Applications declare their package dependencies just like external npm packages:

```json {% path="apps/blog/package.json" %}
{
	"name": "@apps/blog",
	"private": true,
	"dependencies": {
		"@pkg/cn": "workspace:*",
		"@pkg/logger": "workspace:*",
		"@pkg/result": "workspace:*",
		"@pkg/ui": "workspace:*",
		"@pkg/validate": "workspace:*",
		"react": "^19.1.0",
		"react-router": "^7.6.2"
	}
}
```

Notice the `@apps/` namespace for applications. This keeps the naming consistent and makes it easy to distinguish between apps and packages in import statements.

In the application code, imports look identical to external packages:

```ts {% path="apps/blog/app/routes/contact.tsx" %}
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { z } from "zod";

export async function action({ request }: Route.ActionArgs) {
	let schema = z.object({
		email: z.string().email(),
		message: z.string().min(10),
	});

	let result = await validate(request, schema);
	if (isFailure(result)) {
		return { errors: result.error.issues };
	}

	// Process the validated data
	await sendEmail(result.data);
	return { success: true };
}
```

## Layered Package Architecture

A well designed monorepo has packages at different abstraction levels:

**Foundational packages** provide basic utilities with no internal dependencies:

- `@pkg/result`: Error handling with the [Result pattern](/articles/result-objects-in-ts)
- `@pkg/types`: Shared TypeScript types
- `@pkg/cn`: CSS class name utilities

**Domain packages** build on foundational packages:

- `@pkg/validate`: Input validation using `@pkg/result`
- `@pkg/logger`: Structured logging
- `@pkg/cache`: Caching utilities

**UI packages** provide React components and hooks:

- `@pkg/ui`: Shared component library using `@pkg/cn`
- `@pkg/hooks`: Reusable React hooks

This layering keeps dependencies flowing in one direction: from high level to low level. A foundational package should never import from a domain or UI package. For packages that need to separate server and client code, see [multi-entry package architecture](/articles/multi-entry-package-architecture).

## The Benefits

**Single source of truth**: Fix a bug once, and every app gets the fix. No more hunting down duplicate code across repositories.

**Atomic changes**: Refactor a shared interface and update all consumers in the same commit. No coordination across multiple pull requests.

**Consistent patterns**: When every app uses `@pkg/result` for [error handling with Result types](/articles/result-objects-in-ts), developers move between apps without learning new conventions.

**Faster onboarding**: New team members learn the shared packages once, then apply that knowledge across all applications.

**Easier testing**: Test shared code in isolation, then trust it works everywhere. Apps only need to test their specific behavior. This aligns with [designing for testability](/articles/designing-for-testability-in-serverless-functions) by keeping pure logic in shared packages.

## The Trade-offs

Monorepos are not without challenges. The repository grows larger over time, and CI pipelines need to be smart about which packages changed to avoid rebuilding everything on every commit.

Team coordination becomes more important. A breaking change to `@pkg/result` affects every app, so you need clear communication and versioning strategies.

Tooling matters more. You need a package manager that handles workspaces well (Bun, pnpm, or Yarn), and your IDE needs to resolve workspace dependencies correctly.

## When to Use This Pattern

A monorepo with shared packages works best when:

- You have multiple applications that share significant code
- The same team (or closely collaborating teams) owns all the applications
- You want consistent patterns and tooling across projects
- You frequently make changes that span multiple applications

It works less well when:

- Applications are owned by completely independent teams
- You need to open source some packages but not others
- Your applications have vastly different deployment or testing requirements

## Conclusion

A monorepo with shared packages is not about putting everything in one place for the sake of it. It is about reducing duplication, enabling atomic changes, and creating a consistent developer experience across your applications.

The `@pkg/` namespace pattern makes internal imports clear and portable. Workspace dependencies with `workspace:*` keep everything in sync. And a layered architecture ensures packages remain focused and dependencies flow in one direction.

Start small. Extract one utility that you are copying between apps, give it a proper package, and see how it feels. You can always add more packages as patterns emerge.
