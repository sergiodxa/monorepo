---
name: content-writing
description: Use it when creating tutorials or articles in the style of sergiodxa.com.
---

The content is split on two types:

1. Tutorials: How to guides focused on practical implementations with real-world examples and code.
2. Articles: In-depth explorations of technical topics with explanations and context.

Before starting to write confirm if the intended content is a tutorial or article.

If it's a tutorial, fetch the relevant examples from sergiodxa.com/tutorials.

- https://sergiodxa.com/md/tutorials/add-a-color-scheme-toggle-in-react-router
- https://sergiodxa.com/md/tutorials/create-a-per-request-singleton-with-react-router-middleware
- https://sergiodxa.com/md/tutorials/use-action-routes-in-react-router

If it's an article, fetch relevant examples from sergiodxa.com/articles.

- https://sergiodxa.com/md/articles/oauth2-tokens-explained
- https://sergiodxa.com/md/articles/on-frontend-vs-backend
- https://sergiodxa.com/md/articles/making-web-component-good-enough

Every content must start with the following frontmatter:

```yaml
title: How to [Action] with [Technology]
excerpt: [Short description under 130 characters, complete sentence]
```

If it's a tutorial, also include the `tech` field:

```yaml
tech: name@version @namespace/name@version
```

These must point to actual versions of the technology used in the tutorial.

**Rules:**

- If it's a tutorial, the title always starts with "How to"
- Excerpt must be under 130 characters for meta descriptions
- Excerpt should be a complete sentence without dashes (use colons or commas)
- Use actual version numbers for tech field (confirm with me if needed)

## Tutorial Content Structure

- MUST start with one or two paragraphs describing the use case with real-world examples, and the challenge/problem to solve
- MAY include a TL;DR section with a link to a working example repository
  ```markdown
  > TL;DR: [Here's a repository with a working example](https://github.com/sergiodxa/repo) of this tutorial.
  ```
- MUST use practical, action-oriented headings (not explanatory)
- MUST ensure each section accomplishes something specific
- SHOULD build incrementally - each section adds to the previous
- MUST keep explanations short and focused between code blocks
- MUST use file path annotations for code blocks on the same line as the opening backticks
  - For TS `{% path="app/routes.ts" %}`
  - For TSX `{% path="app/routes/component.tsx" %}`
- MUST use realistic file paths
- MUST use code language annotations:
  - Use `tsx` for React components/route modules with JSX
  - Use `ts` for TypeScript without JSX
  - Use `txt` if it's plain text and there's no other suitable language
- MAY show complete, working code examples taken from actual implementation
- MUST show the actual code first
- MUST explain what it does briefly
- MUST explain why it matters

## Language and Style

**Terminology:**

- MUST use "route modules" not "components" when referring to React Router files
- MUST use standard, widely-recognized pattern names (prefer common industry terms)
- MUST be consistent with pattern names throughout the article

**Formatting:**

- MUST use The Chicago Manual of Style title case for headings
- MUST use American English spelling
- MUST NOT use dashes (only in markdown lists or code if needed) or em-dashes in content
- MAY use colons or commas instead of dashes for explanations
- MAY use **bold** for emphasis on key concepts
- MUST use `backticks` for code terms and filenames

**Tone:**

- MUST use a direct and practical language
- MUST avoid words like "clever" or "magic" in headings
- MUST avoid marketing-style language
- MUST focus on practical benefits
- MUST NOT oversell features (avoid "perfect for mobile" unless specifically true)
- MUST ensure practical benefits are clearly communicated

## Content Guidelines

### What to Include

- MUST use real code examples from the actual implementation
- MUST include specific use cases and apps that use the pattern
- MUST include practical benefits and trade-offs
- MUST follow a step-by-step building approach

### What to Avoid

- MUST NOT include long explanatory sections without code
- MUST NOT include theoretical discussions
- MUST NOT include made-up code examples
- MUST NOT include overly complex explanations
- MUST NOT include marketing-style language

### Code Quality

- MUST ensure all code is functional and realistic
- MUST use proper TypeScript types
- MUST include proper imports when relevant
- MUST show complete file contents when relevant
- MUST use consistent naming conventions

## Example Content Structure

````markdown
---
title: How to do X with Y
tech: y@1.0.0
excerpt: Do X using Y to achieve Z in a practical way.
---

Imagine you need to do X in your application using Y. This is common in scenarios like A, B, and C. The challenge is to do this in a way that is efficient and maintainable.

> TL;DR: [Here's a repository with a working example](https://github.com/sergiodxa/repo) of this tutorial.

## Do the First Step

```ts {% path="app/first-step.ts" %}
// Code example for the first step
```

Describe what this step accomplishes and why it's important.

## Do the Second Step

```tsx {% path="app/second-step.tsx" %}
// Code example for the second step
```

Describe what this step accomplishes and how it builds on the previous step.

## Do the Third Step

```ts {% path="app/third-step.ts" %}
// Code example for the third step
```

Describe what this step accomplishes and how it builds on the previous steps.

## Final Thoughts

Brief context about when to use this pattern, trade-offs, or broader implications.
````

## Remember

1. **Code-first approach** - show working code, then explain
2. **Incremental building** - each section adds functionality
3. **Practical focus** - solve real problems with real solutions
4. **Consistent terminology** - use the same terms throughout
5. **Short explanations** - let the code speak, add context briefly

## References

### Libraries and other resources

- Zod: https://zod.dev/llms.txt <- when writing about Zod read this
- Drizzle ORM: https://orm.drizzle.team/llms.txt <- when writing about Drizzle read this
- React Router: https://reactrouter.com/llms.txt <- when writing about React Router read this
- React Router Middleware and Context: https://raw.githubusercontent.com/remix-run/react-router/main/docs/how-to/middleware.md <- when writing about React Router Middleware or router Context read this

### Example tutorials

- https://sergiodxa.com/md/tutorials/add-a-color-scheme-toggle-in-react-router
- https://sergiodxa.com/md/tutorials/create-a-per-request-singleton-with-react-router-middleware
- https://sergiodxa.com/md/tutorials/use-action-routes-in-react-router

### Example articles

- https://sergiodxa.com/md/articles/oauth2-tokens-explained
- https://sergiodxa.com/md/articles/on-frontend-vs-backend
- https://sergiodxa.com/md/articles/making-web-component-good-enough
