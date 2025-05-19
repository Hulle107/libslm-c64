# Libslm (Life is boring so let's make) C64

![Version](https://img.shields.io/github/package-json/v/Hulle107/libslm-binary?style=for-the-badge)
![License](https://img.shields.io/github/license/Hulle107/libslm-binary?style=for-the-badge)

## Indexing
- [Libslm (Life is boring so let's make) C64](#libslm-life-is-boring-so-lets-make-c64)
  - [Indexing](#indexing)
  - [Introduction](#introduction)
  - [Virtual Machine (VM)](#virtual-machine-vm)
    - [Features](#features)
    - [Components](#components)
    - [Usage Example](#usage-example)
    - [Roadmap](#roadmap)
    - [Notes](#notes)

## Introduction
Welcome to this library—a chaotic collection of experiments, half-baked ideas, and random bursts of inspiration. This is not a polished, production-ready framework but rather a playground for concepts that may or may not evolve into something useful.

Because of its experimental nature, stability is not guaranteed. Features may change, disappear, or break without warning. If you're looking for a dependable tool, you might want to look elsewhere. But if you're here for curiosity, exploration, or sheer madness, welcome aboard!

Use at your own risk, and enjoy the ride.

## Virtual Machine (VM)
This project is an experimental implementation of a virtual machine (VM) written in TypeScript. The goal is to create a low-level execution environment capable of interpreting a custom instruction set. This VM is a work in progress, so expect frequent changes and refinements.

### Features
- **Custom Instruction Set** – Define and execute bytecode operations.
- **Register-Based Architecture** – Use a set of registers for efficient execution.
- **Memory Management** – Read and write memory using an internal stack and heap.
- **Opcode Execution** – Decode and process instructions dynamically.

### Components
- CPU – Executes instructions and manages registers.
- Memory – Provides an addressable space for storing and retrieving data.
- Stack – Handles function calls and local storage.
- Instruction Set – Defines the available operations and their behavior.

### Usage Example
```typescript
import {mashine} from 'libslm-c64';

// Missing functionality still, so more will come then.
```

### Roadmap
- 🔲 Basic instruction execution
- 🔲 Stack and memory management
- 🔲 Input/output handling
- 🔲 Advanced debugging tools

### Notes
This VM is purely experimental and not optimized for production. Expect breaking changes, and feel free to experiment with modifying the instruction set and execution model.