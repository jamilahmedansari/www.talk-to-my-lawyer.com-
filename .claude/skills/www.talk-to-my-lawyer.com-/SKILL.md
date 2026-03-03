# www.talk-to-my-lawyer.com- Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill covers development patterns for a TypeScript/Vite-based legal consultation platform. The codebase follows a full-stack architecture with database migrations, API routers, React frontend components, and comprehensive testing. Development happens in phases with frequent checkpoints and emphasizes modular architecture, especially around router organization and feature-specific development cycles.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names
- Test files follow pattern: `*.test.ts`
- Router files organized in `server/routers/` directory
- Database migrations in `drizzle/` directory

### Import/Export Style
```typescript
// Use alias imports
import { someFunction } from '@/utils/helper'
import type { UserType } from '@/types'

// Mixed export styles - both named and default exports
export const namedExport = () => {}
export default function Component() {}
```

### Commit Patterns
- Use freeform commit messages with prefixes: `checkpoint:`, `feat:`, `docs:`
- Average length ~231 characters
- Include descriptive context in commit messages

## Workflows

### Major Feature Integration
**Trigger:** When implementing major new features like storage migration, auth systems, or workflow changes  
**Command:** `/major-feature`

1. Create or modify database migration in `drizzle/*.sql`
2. Update `drizzle/schema.ts` with new schema definitions
3. Implement server-side logic in `server/routers/*.ts`
4. Update `server/db.ts` if database connection changes needed
5. Update frontend components in `client/src/pages/**/*.tsx`
6. Add comprehensive test suite in `server/*test.ts`
7. Update documentation in `docs/*.md`

```typescript
// Example schema update
export const newFeatureTable = pgTable('new_feature', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Router Refactoring
**Trigger:** When routers.ts becomes too large or when organizing code by feature domains  
**Command:** `/split-routers`

1. Create feature-specific router files in `server/routers/`
2. Extract shared guards to `server/routers/_guards.ts`
3. Create `server/routers/index.ts` as aggregation point
4. Update main `server/routers.ts` as re-export shim
5. Preserve all existing import paths for backward compatibility

```typescript
// Example _guards.ts
export const authGuard = (req: Request) => {
  // Shared authentication logic
};

// Example routers/index.ts  
export { userRouter } from './user';
export { documentRouter } from './document';
```

### Phase Development Cycle
**Trigger:** When working through planned development phases or feature iterations  
**Command:** `/phase-checkpoint`

1. Implement current phase features
2. Add phase-specific test file: `server/phase*.test.ts`
3. Create checkpoint commit with phase summary
4. Update `todo.md` with progress and next steps
5. Ensure all tests pass with `npm test`

```typescript
// Example phase test
describe('Phase 2 - Document Management', () => {
  test('should upload legal documents', async () => {
    // Test implementation
  });
});
```

### Documentation Update
**Trigger:** When adding new features, documenting workflows, or improving developer experience  
**Command:** `/update-docs`

1. Create or update main documentation files
2. Add skill-specific documentation in `docs/skills/`
3. Update `README.md` with new features and setup instructions
4. Create reference files for complex workflows
5. Ensure documentation matches current codebase state

### Frontend Component Updates
**Trigger:** When rolling out UI changes, new workflows, or cross-cutting concerns like auth, routing, or styling  
**Command:** `/update-components`

1. Identify affected components across pages
2. Update page components consistently in `client/src/pages/`
3. Update shared components and layouts
4. Ensure responsive design compliance
5. Test across different user roles (client/lawyer/admin)

```tsx
// Example consistent component update
export default function LawyerDashboard() {
  const { user } = useAuth(); // Consistent auth pattern
  
  return (
    <Layout role="lawyer">
      {/* Component content */}
    </Layout>
  );
}
```

### Merge Pull Request
**Trigger:** When completing feature development in branches and integrating to main  
**Command:** `/merge-feature`

1. Merge feature branch using standard git workflow
2. Update Claude/AI metadata files in `.claude/`
3. Sync with any main branch changes
4. Clean up branch references and update tracking files

## Testing Patterns

### Framework: Vitest
- Test files use pattern: `*.test.ts`
- Phase-specific tests for development cycles
- Comprehensive test suites for major features

```typescript
import { describe, test, expect } from 'vitest';

describe('Feature Name', () => {
  test('should handle expected behavior', async () => {
    // Arrange
    const input = setupTestData();
    
    // Act
    const result = await featureFunction(input);
    
    // Assert
    expect(result).toBeDefined();
  });
});
```

## Commands

| Command | Purpose |
|---------|---------|
| `/major-feature` | Implement large features with full-stack changes |
| `/split-routers` | Refactor monolithic routers into feature modules |
| `/phase-checkpoint` | Complete development phase with testing and docs |
| `/update-docs` | Create/update project documentation |
| `/update-components` | Consistent frontend component updates |
| `/merge-feature` | Merge feature branch with metadata updates |