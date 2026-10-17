# Context window

English | [中文](./context-window.zh.md) | [Dictionary](./README.md)

Chinese term: 上下文窗口

The maximum number of tokens a model can process in one request, shared by input and output.

## Mechanism

Each model has a fixed window. Everything the Harness sends for one request competes for that space: instructions, earlier messages, tool output, and the current input. When the next request would exceed the window, the Harness must shorten or drop content before sending it.

## Example

A long coding session can exhaust the window. The Harness compacts older turns into a summary, keeps the recent messages and relevant files, and continues with the smaller context.

## Avoid

Avoid using "context window" for the content currently in the conversation; that is the context. The window is the capacity.

## Context

The tokens available to a model for one request: instructions, conversation, tool results, retrieved material, and the current input.

## Token

The smallest text unit a model consumes and produces. Text is split into tokens before prediction, and the token count is what the window limits.

## Compaction

Replacing part of a conversation with a shorter summary so the remaining context fits the window. Compaction preserves what later work needs and drops detail that no longer matters.
