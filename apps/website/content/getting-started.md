---
title: Get started with moldea
description: See how the Agent Skill, open-source packages, moldea Cloud, and PR Assurance fit around project context in Git.
navigationTitle: Get started
order: 0
---

# Get started with moldea

Start with your project's purpose, rules, and decisions in Git. moldea brings relevant project context into coding-agent planning and development; the packages documented here make that knowledge readable and structurally checkable.

Runtime agents and their instructions use the same foundation when your project needs them.

## Adopt moldea in a project

Start with the [moldea Agent Skill](https://skill.moldea.ai/). It guides repository adoption and ongoing workflows in your coding agent. Its website owns installation instructions, tutorials, and the adoption process.

The packages documented here are the underlying tools. Installing a package alone does not adopt the repository or write its project knowledge for you.

## Collaborate in Cloud

Explore [moldea Cloud](https://moldea.ai) for pull-request review against the project's Git-owned context. It uses the same foundation as the Agent Skill, with the repository as the source of truth.

[PR Assurance](https://moldea.ai/pr-assurance) is being built to review pull requests against project rules and decisions, with findings connected to the relevant evidence.

Cloud review is in development. The Agent Skill, CLI, and packages can be used locally without it.

## Check an adopted repository locally

Use the [CLI overview and installation guide](/packages/cli/) for the current prerequisites and commands. The CLI composes Core and a filesystem reader, so you normally do not need to assemble them yourself.

The CLI reads only the explicitly selected repository. It does not write repository files, call models, make network requests, or send telemetry. These statements describe the local CLI, not every coding-agent or Agent Skill workflow.

A passing structural check means the completed checks found no errors. Review coverage and warnings to see what was checked. Code semantics and agent behavior need separate evaluation. If a connection breaks, update the repository deliberately and run the check again. Checks do not repair it automatically.

## Build a programmatic integration

Use [Core](/packages/core/) when you need structural checks and inspection inside your own tooling. Supply repository content through [Repository](/packages/repository/), including its in-memory reader, or use [Repository FS](/packages/repository-fs/) for an explicitly selected local directory.

These are read-only building blocks. Your application owns content acquisition and any workflow that acts on the results.

## Choose runtime guidance

Browse [runtime labels and guidance](/runtimes/). A runtime ID selects guidance for your coding agent, which reads the installed SDK's type definitions and reviews the application's integration.

Core checks declared file existence and explicit TypeScript and JavaScript ESM exports. Coverage records state which checks ran and which could not run. They do not establish runtime wiring or SDK compatibility.

## Understand the repository files

The [Repository Format specification](/repository-format/) defines the contract. Every adopted repository has `/moldea/moldea.yaml` and `/moldea/project.md`. Additional context, decision records, and agent instructions are optional, according to the needs of the project.

These open-source packages provide structural checks and declared binding coverage. They are not semantic assurance, hosted Cloud services, or a future client SDK.
