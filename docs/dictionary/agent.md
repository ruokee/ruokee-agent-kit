# Agent

English | [中文](./agent.zh.md) | [Dictionary](./README.md)

Chinese term: Agent

An agent is a model plus a Harness: the Harness supplies tools and instructions, holds the context, and runs the tool loop.

## Mechanism

An agent runs a loop. The Harness sends the current context to the model, the model returns text or requests tool calls, the Harness executes those calls and appends the results, and the loop continues until the model stops.

## Example

A chat product and a coding Harness can call the same model and behave differently because their tools, prompts, and context management differ.

## Avoid

Avoid calling the model an agent. Avoid calling a chat product a model. Avoid treating Harness and host as interchangeable when the distinction matters.

## Model

The token predictor an agent calls. Each request is independent: tokens in, tokens out. The model opens no files, runs no commands, and keeps no state between requests.

## Harness

The runtime layer around a model. It supplies tools and the system prompt, manages the context window, enforces permissions, and runs the loop that carries out tool calls and returns their results.

## Host

The Agent Harness or product that discovers, loads, and runs a component. In this repository, a host package or Skill installation targets a specific Harness.
