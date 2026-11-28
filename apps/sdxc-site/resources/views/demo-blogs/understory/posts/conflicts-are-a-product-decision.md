---
title: Conflicts are a product decision
description: Every sync engine has to pick a winner when two people edit the same thing. That choice belongs to whoever designs the screen, not to whoever wrote the merge function.
kind: articles
date: "2026-06-18"
updated: "2026-09-02"
tags: [crdts, sync, local-first]
---

When two people change the same thing while apart, a sync engine has to decide what the thing is afterwards. Engineers like to call that a conflict and treat it as a bug to minimise. I think it is the opposite: it is one of the few places where the data model and the product meet head on, and the decision belongs to whoever designs the screen.

## Three fields, three answers

Take a shared task list. Each task has a title, a done checkbox and a list of assignees.

- **The title** is fine with last writer wins. If you fix a typo and I fix the same typo differently, either result is acceptable and nobody wants a merge dialog.
- **The checkbox** is more interesting. If you tick it and I untick it, who wins? I make "done" win, because unticking is rare and ticking is the whole point of the app. That is not a technical answer; it is a judgement about what people mean.
- **The assignees** want a set that merges additions and removals, an observed-remove set, so that you adding Ana and me adding Tomás leaves both assigned.

Same record, three strategies, each chosen by asking what a person would expect to see.

## Show the merge when it matters

Most merges should be silent. A few should not. When a merge throws away something a person typed, a paragraph, a long comment, I keep the losing value in the record's history and show a small "edited elsewhere" marker that opens it. The [CRDT](/showcase/understory/demo/glossary/crdt) did its job; the interface still owes the person an explanation.

> [!TIP]
> Write the expected result of every concurrent edit down in the design doc, field by field, before writing the merge code. The table turns into the test suite.

## Who decides

On the teams I have worked with, the best conflict rules came out of a designer and an engineer sitting with that table for an hour. The worst came from a library default nobody chose. Your sync engine will pick a winner either way; it may as well be one you picked on purpose.
