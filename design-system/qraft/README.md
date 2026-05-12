# Qraft Design System

Qraft's design system is a service-facing foundation for current and future product UI. It documents the visual and writing principles behind the landing, question result, profile, and community surfaces. It does not ship components.

## Source Policy

- Typography rules are adapted from MiniMax only.
- Layout, spacing, container, radius, elevation, and motion principles are adapted from Runway only.
- Color is Qraft-owned. The current landing background remains Qraft's desert tone and should not be replaced with Runway colors.

## Brand Frame

Qraft is the architect of silence: structured, restrained, editorial, and atmospheric. The interface should feel calm and deliberate, with depth coming from background shader, opacity, spacing, and composition rather than decorative UI.

## Current Product Surfaces

- Landing: first-contact explanation, source input, loading ritual, and result transition.
- Question result: generated questions, another person's reflection, personal reflection, save/bookmark, and profile handoff.
- Profile: history, saved questions, and personal reflections as durable records.
- Community: shared questions and accumulated thoughts in a two-column, irregular card flow.

These surfaces should share the same desert palette, hairline structure, compact mono labels, and restrained motion. Product additions should extend this grammar instead of introducing separate visual languages.

## Folder Contents

- `foundations.md`: full design system guidance for future services.
- `writing-guidelines.md`: UX microcopy and brand voice rules.
- `tokens.json`: structured design tokens for implementation planning.

## Non-goals

- No React components are defined here.
- No current UI is changed by this folder.
- No Runway color palette is applied to the landing background.
