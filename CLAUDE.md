# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WebGL-based project called "haruka-webgl" that is currently in the initial setup phase. The repository contains only this CLAUDE.md file, indicating the project is at the very beginning of development.

## Development Setup

The project currently has no package.json, build configuration, or source files. When setting up this WebGL project, typical development workflow will likely include:

- Initialize with `npm init` or similar package manager
- Install WebGL development dependencies (three.js, babylon.js, or vanilla WebGL)
- Set up build tools (webpack, vite, or parcel for bundling)
- Configure development server with hot reload
- Add TypeScript configuration if using TypeScript

## Expected Architecture

As a WebGL project, the architecture should include:

- **Rendering Pipeline**: Core WebGL context setup, shader compilation, and rendering loop
- **Scene Management**: 3D object hierarchy, camera controls, and scene graph
- **Shader System**: Vertex and fragment shaders for various rendering effects
- **Asset Pipeline**: Texture, model, and audio loading with proper resource management
- **Input Handling**: Mouse, keyboard, and potentially gamepad input for 3D interaction
- **Performance Systems**: Frame rate optimization, LOD systems, and memory management

## Current Status

This is a completely new project with no existing code structure. Future development should establish:
1. Project structure and build configuration
2. WebGL context initialization and basic rendering setup
3. Core rendering and scene management systems
4. Asset loading and management infrastructure