---
title: Get started with moldea
description: Choose the Agent Skill for adoption, the CLI for local checks, or Core and repository readers for a custom integration.
navigationTitle: Get started
order: 0
---

# Get started with moldea

moldea gives project knowledge a structure that tools can check. Keep context and agent instructions in your repository, declare their connections to code, and check those connections as the project changes.

## Adopt moldea in a project

Start with the [moldea Agent Skill](https://skill.moldea.ai/). It guides repository adoption and ongoing workflows in your coding agent. Its website owns installation instructions, tutorials, and the adoption process.

The packages documented here are the underlying tools. Installing a package alone does not adopt the repository or write its project knowledge for you.

## Check an adopted repository locally

Use the [CLI overview and installation guide](/packages/cli/) for the current prerequisites and commands. The CLI composes Core, a filesystem reader, and the packaged runtime adapters, so you normally do not need to assemble them yourself.

The CLI reads only the explicitly selected repository. It does not write repository files, call models, make network requests, or send telemetry. These statements describe the local CLI, not every coding-agent or Agent Skill workflow.

A passing structural check confirms the declared structure and references, not that code follows a policy or that an agent behaves correctly. If a connection breaks, update the repository deliberately and run the check again. Checks do not repair it automatically.

## Build a programmatic integration

Use [Core](/packages/core/) when you need structural checks and inspection inside your own tooling. Supply repository content through [Repository](/packages/repository/), including its in-memory reader, or use [Repository FS](/packages/repository-fs/) for an explicitly selected local directory.

These are read-only building blocks. Your application owns content acquisition and any workflow that acts on the results.

## Check your runtime's exact support

Browse [runtime adapters](/adapters/), then check the [compatibility matrix](/compatibility/) for the exact target, package range, recognized patterns, limitations, and qualification evidence. A recognizable runtime name is not a claim that every version or coding pattern is supported.

Maturity belongs to each published target. Custom runtime declarations use the path built into Core, not a separate adapter package.

## Understand the repository files

The [Repository Format specification](/repository-format/) defines the contract. Every adopted repository has `/moldea/moldea.yaml` and `/moldea/project.md`. Additional context, decision records, and agent instructions are optional, according to the needs of the project.

These open-source packages provide structural checks and runtime-specific evidence. They are not semantic assurance, hosted Cloud services, or a future client SDK.
