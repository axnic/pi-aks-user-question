# Documentation

| Document                             | Description                                                       |
| ------------------------------------ | ----------------------------------------------------------------- |
| [architecture.md](./architecture.md) | Code structure, module interaction, data flow diagrams            |
| [schema.md](./schema.md)             | JSON Schema reference — all 5 question types and design decisions |
| [ui.md](./ui.md)                     | TUI layout spec: tab bar, input widgets, colors, review, footer   |
| [schema.json](./schema.json)         | Machine-readable tool parameter schema (generated from code)      |
| [styles/](./styles/)                 | Annotated renders across pi, Claude Code, and Gemini              |

## Regenerating schema.json

`schema.json` is auto-generated from the TypeBox definitions in `src/schema.ts`:

```sh
mise run docs:schema    # or: npx tsx scripts/generate-schema.ts
```

Always regenerate after modifying `src/schema.ts` or `src/validation.ts`.
