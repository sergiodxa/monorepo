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

## Content Type Distinction

**Tutorials** teach readers HOW to build something specific:

- Title MUST start with "How to"
- Focus on implementation steps
- Code is the main content
- Explanations serve the code
- End result is working functionality

**Articles** help readers UNDERSTAND concepts:

- Title should be conceptual (NEVER start with "How to")
- Focus on "why" and "when" questions
- Explore trade-offs and design decisions
- Code illustrates points but is not the main content
- End result is deeper understanding

## Frontmatter

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
- If it's an article, the title NEVER starts with "How to"
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
- SHOULD build incrementally: each section adds to the previous
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

## Article Content Structure

Articles explore concepts rather than provide step-by-step instructions.

**Opening:**

- Start with 1-2 paragraphs establishing the problem space or concept
- Frame the topic in terms of real challenges developers face
- Avoid jumping straight into technical details

**Body:**

- Organize around conceptual sections, not implementation steps
- Use headings that describe concepts or questions: "The Problem with X", "Why Y Matters", "When to Use Z"
- Each section should deepen understanding, not add functionality
- Present trade-offs explicitly: when is this approach good, when does it fail?
- Compare alternatives when relevant
- Use bullet lists for contrasting options or listing considerations

**Code in Articles:**

- Code should illustrate a concept, not be the focus
- Keep code snippets short (10-20 lines typically)
- Pseudocode or simplified examples are acceptable
- No file path annotations needed unless showing a specific file
- Code should demonstrate "what this looks like" not "copy this to your project"

**Closing:**

- Summarize key insights
- Reinforce when to use the approach
- May mention related topics without diving into them

## Writing Style Patterns

**Sentence Structure:**

- Prefer short, declarative sentences
- Lead with the main point, then elaborate
- Break complex ideas across multiple sentences rather than using semicolons or dashes

**Paragraph Length:**

- Keep paragraphs short: 2-4 sentences maximum
- One idea per paragraph
- Use whitespace generously

**Transitions:**

- Don't use explicit transition words like "Furthermore" or "Additionally"
- Let the logical flow carry the reader
- New sections can start directly with the new concept

**Explaining Trade-offs:**

- Present both sides explicitly
- Use patterns like "X provides Y, but at the cost of Z"
- Avoid absolutism: rarely say something is "always" the right choice

**Handling Complexity:**

- Break complex topics into smaller, digestible pieces
- Define terms when introducing them (but inline, not with formal definitions)
- Avoid jargon; when technical terms are necessary, explain them briefly

## Language and Style

**Terminology:**

- MUST use "route modules" not "components" when referring to React Router files
- MUST use standard, widely-recognized pattern names (prefer common industry terms)
- MUST be consistent with pattern names throughout the article
- MUST avoid acronyms unless widely known (e.g., "URL" is fine, "DDL" needs explanation)

**Formatting:**

- MUST use The Chicago Manual of Style title case for headings
- MUST use American English spelling
- MUST NOT use dashes or em-dashes in prose (only in markdown lists or code)
- MAY use colons or commas instead of dashes for explanations
- MAY use periods to break up what would be a dash-separated clause
- MAY use **bold** for emphasis on key concepts (sparingly)
- MUST use `backticks` for code terms, filenames, and technical identifiers

**Tone:**

- Direct and practical
- Confident but not arrogant
- Acknowledge uncertainty when it exists
- Avoid words like "clever", "magic", "simple" (things that seem simple often aren't)
- Avoid marketing language: "powerful", "elegant", "perfect"
- Focus on what works and why

## Content Guidelines

### What to Include

- MUST use real code examples from actual implementations when possible
- MUST include specific use cases and scenarios
- MUST include practical benefits and trade-offs
- MUST follow logical progression (tutorials: step-by-step; articles: concept-by-concept)

### What to Avoid

- MUST NOT include long explanatory sections without supporting examples
- MUST NOT include purely theoretical discussions without practical grounding
- MUST NOT include made-up code that wouldn't work in production
- MUST NOT include overly complex explanations when simpler ones work
- MUST NOT include marketing-style language or hyperbole
- MUST NOT use phrases like "as you can see" or "it's worth noting"

### Code Quality

- MUST ensure all code is functional and realistic
- MUST use proper TypeScript types
- MUST include proper imports when relevant
- MUST show complete file contents when relevant
- MUST use consistent naming conventions
- PREFER `let` over `const` for local variables (project convention)
- PREFER `interface` over `type` when possible (project convention)

## Example Tutorial Structure

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

## Example Article Structure

````markdown
---
title: Understanding X in the Context of Y
excerpt: Explore how X works and when it makes sense for your applications.
---

X seems straightforward until you encounter edge cases. The traditional approach works for simple scenarios, but breaks down when you need A, B, or C. Understanding the underlying mechanics helps you make better architectural decisions.

## The Core Problem

Explain what problem this concept addresses. Ground it in real developer challenges. Use a brief code snippet if it helps illustrate the problem.

```ts
// Brief example showing the problem
```

This happens because of underlying reason. The implications affect how you design your system.

## How X Works

Explain the mechanism or pattern. Not step-by-step instructions, but conceptual understanding.

**Key insight one.** Explanation of why this matters.

**Key insight two.** Explanation of the trade-off this creates.

## When X Makes Sense

List specific scenarios where this approach works well. Be concrete.

## When X Fails

Be honest about limitations. Every approach has trade-offs.

## Conclusion

Summarize the key insight. Reinforce when to use this approach. Keep it brief.
````

## Remember

1. **Code-first for tutorials**: show working code, then explain
2. **Concept-first for articles**: build understanding, use code to illustrate
3. **Incremental building**: each section adds to the previous
4. **Practical focus**: solve real problems with real solutions
5. **Consistent terminology**: use the same terms throughout
6. **Short explanations**: let the code or concept speak, add context briefly
7. **Explicit trade-offs**: every approach has costs and benefits
8. **No dashes in prose**: use commas, colons, or periods instead

## References

### Libraries and other resources

- Zod: https://zod.dev/llms.txt
- Drizzle ORM: https://orm.drizzle.team/llms.txt
- React Router: https://reactrouter.com/llms.txt
- React Router Middleware and Context: https://raw.githubusercontent.com/remix-run/react-router/main/docs/how-to/middleware.md

### Example tutorials

- https://sergiodxa.com/md/tutorials/add-a-color-scheme-toggle-in-react-router
- https://sergiodxa.com/md/tutorials/create-a-per-request-singleton-with-react-router-middleware
- https://sergiodxa.com/md/tutorials/use-action-routes-in-react-router

### Example articles

- https://sergiodxa.com/md/articles/oauth2-tokens-explained
- https://sergiodxa.com/md/articles/on-frontend-vs-backend
- https://sergiodxa.com/md/articles/making-web-component-good-enough
