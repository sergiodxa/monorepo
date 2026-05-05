# Agent Guidelines

## Rules

- MUST NOT mention Pokemon, or any specific Pokemon related content in any of the code, with exception of the `src/content` directory, which is meant to be a data layer for Pokemon-related content.
- MUST follow ECS architecture principles, with a clear separation of concerns between the engine, domain, and content layers.
- MUST use TypeScript for all code, including tests and scripts.
- MUST use the provided domain types and structures for representing game entities, mechanics, and data.
- MUST implement the game engine in a way that is agnostic to the specific content, allowing for easy extension and modification of game mechanics without affecting the core engine.
- MUST implement the game engine in a way that is testable, with clear interfaces and separation of concerns to facilitate unit testing of individual components and integration testing of the overall system.
- MUST implement the game engine in a way that is agnostic to the specific UI or presentation layer, allowing for flexibility in how the game is rendered and interacted with.
- MUST add JSDoc block at the beginning of a file/module explaining its purpose and how it fits into the overall architecture of the game engine. The description can be multiple paragraphs if necessary, but should provide a clear overview of the module's responsibilities and how it interacts with other parts of the system.
- MUST include `@author [Sergio Xalambrí](https://sergiodxa.com)` in the module-level JSDoc block for all files, to ensure proper attribution and recognition of the original author of the code.
- MUST include `@copyright Sergio Xalambrí 2026` in the module-level JSDoc block for all files, to ensure proper attribution and recognition of the original author of the code.
