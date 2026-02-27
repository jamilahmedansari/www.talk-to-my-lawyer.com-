# manus-talk-to-my-lawyer Development Patterns

> Auto-generated skill from repository analysis

## Overview

This is a TypeScript-based legal document generation application built with Vite, featuring a client-server architecture with tRPC for API communication, Drizzle ORM for database management, and an AI-powered letter generation pipeline. The codebase follows structured development patterns with frequent checkpointing and systematic database migrations.

## Coding Conventions

### File Naming
- **Pattern**: camelCase for all files
- **Examples**: `letterPreview.tsx`, `databaseMigration.sql`, `userProfile.ts`

### Import Style
- **Pattern**: Alias imports preferred
- **Example**:
```typescript
import { Button } from '@/components/ui/button'
import { api } from '@/lib/trpc'
import type { RouterOutput } from '@/server/routers'
```

### Export Style
- **Pattern**: Mixed - both named and default exports
- **Examples**:
```typescript
// Default export for components
export default function LetterPreview() { ... }

// Named exports for utilities
export const validateInput = () => { ... }
export const formatDate = () => { ... }
```

### Testing
- **Framework**: Vitest
- **Pattern**: `*.test.ts` files
- **Location**: Co-located with source files in `server/` directory

## Workflows

### Database Migration
**Trigger:** When someone needs to modify the database schema
**Command:** `/add-migration`

1. Create a new migration file in `drizzle/` directory following the naming pattern
2. Update `drizzle/schema.ts` with new tables, columns, or schema modifications
3. Update snapshot files in `drizzle/meta/*.json` to reflect schema changes
4. Modify `server/db.ts` if new database connections or configurations are needed
5. Execute migration via MCP or direct database execution
6. Verify migration success and update related types

**Example schema update:**
```typescript
// drizzle/schema.ts
export const newTable = sqliteTable('new_table', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull()
})
```

### Phase Checkpoint
**Trigger:** When finishing a major feature or phase of development
**Command:** `/checkpoint`

1. Complete implementation of all feature changes for the current phase
2. Write or update corresponding test files in `server/*.test.ts`
3. Update `todo.md` documenting phase completion and next steps
4. Run full test suite to ensure all tests pass
5. Commit with descriptive message using pattern: `Checkpoint: Phase X: [description]`

**Example test structure:**
```typescript
// server/feature.test.ts
import { describe, it, expect } from 'vitest'

describe('Feature functionality', () => {
  it('should handle expected behavior', () => {
    // Test implementation
  })
})
```

### UI Component Enhancement
**Trigger:** When implementing UI features that span multiple pages
**Command:** `/enhance-ui`

1. Create or modify React components in `client/src/components/`
2. Update affected pages in `client/src/pages/*/` directories
3. Add necessary styling and responsive design considerations
4. Update shared layout components in `client/src/components/shared/` if needed
5. Test component integration across different page contexts

**Example component structure:**
```tsx
// client/src/components/letterForm.tsx
import { useState } from 'react'
import type { LetterData } from '@/shared/types'

export default function LetterForm() {
  const [formData, setFormData] = useState<LetterData>()
  
  return (
    // Component implementation
  )
}
```

### API Route Addition
**Trigger:** When adding new API endpoints or backend features
**Command:** `/add-api`

1. Add new tRPC procedures to `server/routers.ts`
2. Implement business logic in relevant server files
3. Write comprehensive tests for new functionality in `server/*.test.ts`
4. Update shared types in `shared/types.ts` if new data structures are introduced
5. Document API changes and usage patterns

**Example tRPC procedure:**
```typescript
// server/routers.ts
export const appRouter = router({
  newProcedure: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // Implementation
    })
})
```

### Documentation Sync
**Trigger:** When documentation needs to reflect code changes
**Command:** `/sync-docs`

1. Update `README.md` with new features, installation steps, or usage examples
2. Modify `SPEC_COMPLIANCE.md` to reflect current compliance status
3. Update gap analysis in `docs/GAP_ANALYSIS.md`
4. Sync audit reports in `AUDIT_REPORT.md`
5. Review and update other documentation files in `docs/` directory

### Pipeline Modification
**Trigger:** When modifying the letter generation workflow or AI integration
**Command:** `/update-pipeline`

1. Modify the core pipeline logic in `server/pipeline.ts`
2. Update corresponding test files with focus on pipeline functionality
3. Adjust `package.json` dependencies if new AI or processing libraries are needed
4. Update `todo.md` with pipeline changes and impact assessment
5. Test end-to-end letter generation workflow

**Example pipeline structure:**
```typescript
// server/pipeline.ts
export async function generateLetter(input: LetterInput): Promise<LetterOutput> {
  // AI processing pipeline
  const processed = await processInput(input)
  return formatOutput(processed)
}
```

## Testing Patterns

- **Framework**: Vitest with TypeScript support
- **Location**: Tests co-located with server code in `server/*.test.ts`
- **Pattern**: Descriptive test names focusing on behavior
- **Structure**: Arrange-Act-Assert pattern preferred

```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('Module behavior', () => {
  beforeEach(() => {
    // Setup
  })
  
  it('should perform expected action when valid input provided', () => {
    // Arrange
    const input = createValidInput()
    
    // Act  
    const result = moduleFunction(input)
    
    // Assert
    expect(result).toEqual(expectedOutput)
  })
})
```

## Commands

| Command | Purpose |
|---------|---------|
| `/add-migration` | Create and apply database schema changes |
| `/checkpoint` | Complete development phase with testing and documentation |
| `/enhance-ui` | Add or modify React components across multiple pages |
| `/add-api` | Create new tRPC procedures and backend functionality |
| `/sync-docs` | Update documentation to reflect code changes |
| `/update-pipeline` | Modify AI letter generation workflow |