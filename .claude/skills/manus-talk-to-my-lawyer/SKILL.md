# manus-talk-to-my-lawyer Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches development patterns for a legal tech application built with TypeScript, Vite, tRPC, and Drizzle ORM. The codebase follows a full-stack architecture with a client-server structure, comprehensive testing, and database-driven workflows. The project emphasizes checkpoint-driven development with detailed progress tracking and maintains high code quality standards.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names
- Test files follow pattern: `*.test.ts`
- Component files: `ComponentName.tsx`
- Database files: `schema.ts`, `db.ts`

### Import Style
```typescript
// Use alias imports
import { someFunction } from '@/utils/helper'
import type { UserType } from '@/shared/types'
```

### Export Style
```typescript
// Mixed export styles - both named and default exports
export const apiFunction = () => { /* ... */ }
export default MyComponent
```

### Database Schema
```typescript
// drizzle/schema.ts
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  // ...
})
```

## Workflows

### Checkpoint Commit
**Trigger:** When completing a development phase or major feature milestone  
**Command:** `/checkpoint`

1. Complete feature implementation and ensure all functionality works
2. Run full test suite with `npm test` and verify all tests pass
3. Update `todo.md` with phase completion status and feature counts
4. Document current test coverage and TypeScript compilation status
5. Create detailed checkpoint commit message (~300 chars) describing:
   - Phase completed
   - Number of features/tests added
   - Current project state

```bash
# Example checkpoint commit
git commit -m "checkpoint: phase 3 complete - added 5 new features, 12 tests passing, full TS compliance, user management and case tracking implemented"
```

### Database Schema Evolution
**Trigger:** When adding new data models or modifying existing database structure  
**Command:** `/add-table`

1. Update `drizzle/schema.ts` with new tables, enums, or columns
```typescript
// Add new table
export const cases = pgTable('cases', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  status: caseStatusEnum('status').default('open'),
})
```

2. Generate migration SQL file using Drizzle kit
3. Update `drizzle/meta/` snapshots with new schema state
4. Update `server/db.ts` with new database queries and operations
5. Update `shared/types.ts` with corresponding TypeScript types

### Feature Implementation with Tests
**Trigger:** When developing a new feature or capability  
**Command:** `/new-feature`

1. Implement feature logic in relevant server or client files
2. Create comprehensive test file following naming pattern:
```typescript
// server/userManagement.test.ts
import { describe, it, expect } from 'vitest'
import { createUser } from './userManagement'

describe('User Management', () => {
  it('should create user successfully', () => {
    // Test implementation
  })
})
```

3. Update `todo.md` with feature progress and completion status
4. Run test suite to ensure all tests pass
5. Update related UI components and API integrations if needed

### UI Page Enhancement
**Trigger:** When improving user interface or adding new page functionality  
**Command:** `/enhance-ui`

1. Update target page component in `client/src/pages/` with new features
```tsx
// client/src/pages/CasesPage.tsx
export default function CasesPage() {
  // Enhanced functionality
  return <div>Enhanced UI</div>
}
```

2. Add or update related components in `client/src/components/`
3. Update `AppLayout.tsx` or routing configuration if needed
4. Test UI changes across different screen sizes and use cases
5. Update relevant documentation with new UI capabilities

### tRPC API Extension
**Trigger:** When adding new API endpoints or data operations  
**Command:** `/add-api`

1. Add new procedures to `server/routers.ts`:
```typescript
export const appRouter = router({
  getUsers: publicProcedure.query(() => {
    return db.getUsers()
  }),
  createCase: publicProcedure
    .input(z.object({ title: z.string() }))
    .mutation(({ input }) => {
      return db.createCase(input.title)
    })
})
```

2. Implement backend logic in `server/db.ts` or related database files
3. Update `shared/types.ts` with new type definitions if needed
4. Add comprehensive API tests covering success and error cases
5. Update frontend components to utilize new API endpoints

### Documentation Sync
**Trigger:** When codebase changes require documentation updates  
**Command:** `/sync-docs`

1. Update `README.md` with current feature set and setup instructions
2. Sync `SPEC_COMPLIANCE.md` with actual implementation status
3. Update `AUDIT_REPORT.md` with new security considerations
4. Update files in `docs/` folder with latest architectural decisions
5. Update `GAP_ANALYSIS.md` with resolved items and new requirements

## Testing Patterns

### Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup code
  })

  it('should handle success case', () => {
    // Arrange
    const input = { /* test data */ }
    
    // Act
    const result = functionUnderTest(input)
    
    // Assert
    expect(result).toBe(expectedValue)
  })

  it('should handle error case', () => {
    // Error testing
  })
})
```

### Test Coverage Goals
- Aim for comprehensive test coverage on all business logic
- Include both success and error scenarios
- Test database operations and API endpoints
- Maintain test count documentation in checkpoint commits

## Commands

| Command | Purpose |
|---------|---------|
| `/checkpoint` | Create comprehensive development checkpoint with progress summary |
| `/add-table` | Add new database table with migrations and type updates |
| `/new-feature` | Implement new feature with tests and documentation |
| `/enhance-ui` | Improve existing UI pages with new functionality |
| `/add-api` | Add new tRPC API procedures with backend implementation |
| `/sync-docs` | Update project documentation to match current codebase |