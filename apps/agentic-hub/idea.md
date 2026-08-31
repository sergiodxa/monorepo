# Product Specification: Agentic Development Platform

## Overview

Build a modern software development platform where humans define intent and review outcomes, while AI agents execute implementation work.

The platform is not an AI-powered Git hosting service. The core abstraction is the Work Item.

The philosophy:

- Humans decide what should be built.
- Agents or humans execute the work.
- Reviewers validate the result.
- The system enforces policies and integrates changes.

The main workflow:

Triage → Work Item → Plan → Implementation → Review → Merge Queue → Done

Done means merged. Deployment is external and project-specific.

---

# Main Application Structure

A project has these main areas:

```
Code | Triage | Work
```

---

# Code

Code is the repository browser.

Features:

- File explorer
- Code viewer
- Search
- Commit history
- Branches
- Diffs
- Blame/history

This is not intended to replace an IDE. It is a place to understand the codebase and connect code with work.

Users can select code and:

- Ask an agent a question
- Start a discussion
- Create a Triage Item

When creating a Triage Item from code, preserve context:

- repository
- file path
- line range
- commit hash

Example:

```
Triage Item

Source:
src/auth/session.ts

Lines:
84-123

Commit:
abc123
```

---

# Triage

Triage is the inbox of potential work.

Triage is not a backlog.

Things enter Triage before they become Work.

Examples:

- Bug reports
- Feature requests
- Support tickets
- Customer feedback
- Security findings
- Internal requests
- Incidents
- Monitoring alerts

Each category is a different type with:

- custom fields
- permissions
- visibility rules
- creation restrictions
- automation rules

---

## Triage lifecycle

Triage has no board.

Statuses:

```
Review
Accepted
Rejected
Duplicate
Done
```

Flow:

```
Created
  ↓
Review
  ↓
Accepted
  ↓
Work Item created
  ↓
Done when Work completes
```

---

## Triage visibility

Repository owners configure visibility.

Possible visibility:

- Public
- Private
- Disabled

Free plan:

- Code must be public.
- Triage is public by default.
- Triage can become private.
- Work is always private.

Paid plans:

- Everything is private by default.
- Any individual area can be made public.

Examples:

```
Public code
Public triage
Private work
```

or:

```
Private code
Public triage
Private work
```

---

# Triage categories

## Bug Report

Public by default.

Fields:

- title
- description
- reproduction steps
- expected behavior
- actual behavior
- environment

---

## Security Finding

Restricted.

Visible only to:

- reporter
- security team
- repository owners

---

## Support Ticket

Only users with support permissions can create.

---

## Customer Feedback

Can be created through API integrations from customer-facing applications.

---

## Monitoring Alert

Cannot be manually created.

Only integrations can create these.

Examples:

- Sentry
- Cloudflare
- Datadog

---

# Work Items

Work Items are authorized work.

A Work Item contains:

```
Work Item

- Intent
- Stakeholders
- Executor
- Plan
- Changes
- Review Policies
- Reviews
- Merge
- History
```

---

# Stakeholders

Stakeholders are people interested in the outcome.

They do not approve technical decisions.

Examples:

- Customer Support
- Product
- Customers
- Developers

Multiple stakeholders are allowed.

When work finishes, notify stakeholders.

The original Triage Item should show:

```
Resolved by Work #123

Summary:
Implemented password reset flow
```

---

# Executor

Executor is the current owner of implementation.

Possible executors:

- AI Agent
- Human developer
- External runner

The executor can change during the lifecycle.

This is called Take Over.

Example:

```
Executor:
Claude Agent

[Take Over]
```

After takeover:

```
Executor:
Sergio

Previous:
Claude Agent
```

Rules:

- Agent stops immediately.
- Existing committed changes remain.
- Uncommitted changes may be lost.

A human can later return the Work Item to an agent.

Example:

```
Human fixes tricky part.

Return to agent.

Agent continues from current state.
```

Executor history must be recorded.

---

# Work lifecycle

UI:

```
Backlog | WIP | Review | Done
```

Internal lifecycle:

```
Backlog

↓

Planning (when required)

↓

WIP

↓

Review

↓

Merge Queue

↓

Done
```

Users do not manually move cards.

Transitions happen through actions.

---

# Planning

When an AI agent starts a Work Item:

```
Backlog → Planning
```

A planning agent creates a plan.

Example:

```
Plan:

Current architecture:
...

Proposed changes:
1.
2.
3.

Files affected:
...

Risks:
...

Validation:
...
```

The implementation agent receives the approved plan.

The plan should contain everything needed to execute.

---

## Plan requirements

Complexity determines if planning is required.

Small:

```
Backlog → WIP
```

Medium and above:

```
Backlog
 ↓
Plan
 ↓
Approval
 ↓
WIP
```

Examples requiring plans:

- architecture changes
- authentication changes
- database migrations
- risky changes

Simple changes:

- copy updates
- asset replacement
- small CSS fixes

can skip planning.

---

# Agent questions

Agents should be conservative.

Rules:

- Make reversible assumptions when possible.
- Ask questions when blocked.
- Always ask before irreversible actions.

Questions live inside Work Items.

UI:

```
Intent
Plan
Questions
Changes
Review
```

Each question has its own thread.

Example:

```
Question:

Should deleting a user remove projects?

Agent:
Blocked until this decision is made.

[Answer]
```

---

# Conversations

Use GitHub Discussions style.

Every message starts a thread.

No nested threads.

Types:

- Question
- Discussion
- Plan feedback
- Review comment
- Decision

---

# Review Policies

Reviewers are not manually assigned.

Policies determine required approvals.

Policies can depend on:

- priority
- file paths
- work type
- teams
- users
- roles

Example:

```yaml
review:
  - condition:
      priority: P0
    require:
      team: backend
      approvals: 2

  - condition:
      paths:
        - src/auth/**
    require:
      user:
        - security-lead
      team:
        - security
      approvals: 1

  - default:
    require:
      team: engineers
      approvals: 1
```

---

## Reviewer resolution

If multiple policies match, combine requirements.

Do not assign independent reviewers for every rule.

Find the smallest set of people that satisfies all requirements.

Example:

Requirements:

```
Backend ×2
Security ×1
Engineer ×1
```

A person who belongs to:

```
Backend
Security
Engineers
```

can satisfy multiple requirements.

Optimize reviewer assignment.

Consider:

- required capabilities
- availability
- current review workload

---

# Code ownership

Teams can own paths.

Example:

```
Backend

/api/**
/db/**
```

```
Security

/src/auth/**
```

```
Frontend

/src/frontend/**
```

Paths can have more specific rules.

Specific paths add requirements; they do not replace broader rules.

Example:

```
src/frontend/**

requires:
Frontend Team


src/frontend/onboarding/**

requires:
Frontend onboarding owners
```

---

# Review

Review screen:

```
Preview
Diff
Checks
Approvals
Conversation
```

Reviewers can:

- approve
- request changes
- comment

Review approval is not completion.

---

# Preview environments

When possible, Work Items in Review should have preview environments.

Example:

```
Preview:

https://work-123.preview.app
```

Reviewers should validate behavior before reading code.

---

# Merge Queue

Approved Work Items enter Merge Queue.

Flow:

```
Review approved

↓

Merge Queue

↓

CI

↓

Merge

↓

Done
```

---

# Deployment

Deployment is external.

The platform does not assume how deployment works.

Possible systems:

- Cloudflare
- AWS
- Vercel
- Kubernetes
- custom CI

A Work Item can be:

```
Done

Deployment:
Failed
```

---

# Branch detection

Users can work manually.

When a new branch is detected:

Suggest:

```
Create Work Item?
```

Similar to GitHub suggesting a PR.

---

# Dependencies

Initially, Work Items are independent.

Users can manually create multiple Work Items.

Dependencies create graphs.

Example:

```
Work A
 ↓
Work B
 ↓
Work C
```

This can visually become an epic/stack.

---

# Repository import

GitHub import only imports:

- repository
- files
- branches
- commits

Do not import:

- issues
- pull requests
- comments
- discussions

The platform has its own workflow.

---

# Permissions

Use capability-based permissions.

Organization and repository permissions are separate.

Examples:

Repository:

```
read code
write code
manage settings
```

Triage:

```
create bug report
create security finding
accept
reject
```

Work:

```
create
execute agent
take over
merge
```

Review:

```
approve
request changes
```

Organization permissions can be forced onto repositories.

Repository overrides can exist unless organization locks them.

---

# Teams

Organizations have teams.

Example:

```
Organization

Backend
Frontend
Security
Product
Support
```

Teams are used for:

- permissions
- ownership
- review policies
- stakeholders

---

# Plans and Billing

## Free

No credit card.

Purpose:

Open source and experimentation.

Includes:

- public repositories
- BYOK agents
- public code
- public triage by default
- private work

No managed AI.

---

## Solo

Credit card required.

Purpose:

Individual developers.

Includes:

- managed AI
- usage billing
- private triage option
- more storage/history

Code remains public.

---

## Pro

Purpose:

Professional private projects.

Includes:

- private repositories
- private triage by default
- advanced policies
- secrets
- environments

Private code is for the individual owner.

Private collaboration requires Team.

---

## Team

Purpose:

Organizations.

Includes:

- members
- teams
- shared permissions
- organization AI provider
- shared billing
- audit logs
- governance

---

# AI Billing

Managed AI:

```
Provider token cost
+
platform fee
```

Same margin for all models.

Plans get better token pricing.

Example:

```
Solo:
provider cost + 20%

Pro:
provider cost + 15%

Team:
provider cost + 10%
```

Market this as:

"Your plan gives you discounted AI rates."

---

# BYOK

Personal:

User provides their own provider key.

Team:

BYOK belongs to the organization.

Not individual developers.

Example:

```
Organization AI Provider

Anthropic key
```

All projects use organization configuration.

---

# Budgets

Budgets are first-class.

Organizations can define:

```
Monthly AI budget:
$1000

Warning:
70%

Critical:
90%

Stop:
100%
```

At limit:

- running jobs can finish
- new agent runs pause

Notify before reaching limits.

Budgets can exist at:

- organization
- project
- Work Item

---

# Infrastructure billing

Usage can include:

- AI tokens
- sandbox runtime
- storage
- previews
- artifacts

Subscriptions include quotas.

Extra usage is billed.

Team plans can include better infrastructure quotas as membership grows.

---

# Agent configuration

Projects can define:

```
AGENTS.md
```

Contains:

- coding conventions
- commands
- restrictions
- architecture rules
- safety rules

Example:

```
Never modify migrations without approval.

Always run tests before review.

Use existing components.
```

---

# Future: Executable Specs

Not part of MVP.

Optional CI integration.

Possible future:

```
spec run
```

Used as another verification step.

The platform should remain compatible with existing testing tools.
