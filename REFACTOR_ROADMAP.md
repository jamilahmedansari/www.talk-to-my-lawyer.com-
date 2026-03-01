# Refactor Roadmap

This document outlines planned improvements to the codebase structure and quality. The current codebase is **stable and production-ready**; these are enhancements for maintainability and scalability.

---

## Phase 1: Module Organization (Medium Priority)

### Goal
Reorganize `server/routers.ts` (1,271 lines) and `server/db.ts` (932 lines) into feature-based modules while maintaining backward compatibility.

### Tasks

#### 1.1 Extract Letter Generation Router
- **File:** `server/features/generation/router.ts`
- **Content:** `letters.*` procedures from routers.ts
- **Related DB helpers:** Move to `server/features/generation/db.ts`
- **Impact:** ~200 lines moved
- **Effort:** 2-3 hours
- **Risk:** Low (can use index.ts re-export)

#### 1.2 Extract Letter Review Router
- **File:** `server/features/review/router.ts`
- **Content:** `review.*` procedures
- **Related DB helpers:** Move to `server/features/review/db.ts`
- **Impact:** ~250 lines moved
- **Effort:** 2-3 hours
- **Risk:** Low

#### 1.3 Extract Billing Router
- **File:** `server/features/billing/router.ts`
- **Content:** `billing.*` procedures
- **Related DB helpers:** Move to `server/features/billing/db.ts`
- **Impact:** ~230 lines moved
- **Effort:** 2 hours
- **Risk:** Low

#### 1.4 Extract Admin Router
- **File:** `server/features/admin/router.ts`
- **Content:** `admin.*` procedures
- **Related DB helpers:** Move to `server/features/admin/db.ts`
- **Impact:** ~120 lines moved
- **Effort:** 1.5 hours
- **Risk:** Low

#### 1.5 Create Router Index
- **File:** `server/features/index.ts`
- **Content:** Re-export all routers for backward compatibility
- **Effort:** 30 minutes
- **Risk:** None

### Expected Outcome
- `server/routers.ts` reduced to ~300 lines (imports + main router definition)
- `server/db.ts` reduced to ~200 lines (shared helpers + exports)
- Each feature has its own router and db module
- All existing imports continue to work

---

## Phase 2: Type Consolidation (Low Priority)

### Goal
Establish single source of truth for all data shapes and remove duplication in `shared/types.ts`.

### Tasks

#### 2.1 Audit Type Definitions
- Identify duplicate type definitions across files
- Check for inconsistent naming (e.g., `LetterRequest` vs `Letter`)
- Verify all types match database schema

#### 2.2 Create Type Categories
- **Domain Types:** `User`, `LetterRequest`, `Subscription`
- **API Types:** `IntakeJson`, `ResearchPacket`, `DraftOutput`
- **UI Types:** `StatusBadge`, `NotificationMessage`
- **Error Types:** `TRPCError`, `ValidationError`

#### 2.3 Document Type Hierarchy
- Add JSDoc comments to all exported types
- Include examples for complex types
- Link to database schema

### Expected Outcome
- `shared/types.ts` is the canonical source for all types
- No duplicate definitions across codebase
- Clear type hierarchy and relationships

---

## Phase 3: Error Handling Standardization (Medium Priority)

### Goal
Establish consistent error handling patterns across server and client.

### Tasks

#### 3.1 Create Error Utility Module
- **File:** `server/lib/errors.ts`
- **Content:** Error classes, error codes, error formatters
- **Examples:**
  ```typescript
  class PipelineError extends Error { /* ... */ }
  class SubscriptionError extends Error { /* ... */ }
  class ReviewError extends Error { /* ... */ }
  ```

#### 3.2 Standardize tRPC Error Responses
- All procedures should throw `TRPCError` with consistent format
- Include error code, message, and context
- Log errors to Sentry with context

#### 3.3 Add Client Error Boundaries
- Create `ErrorBoundary` for each major page
- Display user-friendly error messages
- Log to Sentry from client

### Expected Outcome
- Consistent error handling across all procedures
- Better error messages for users
- Easier debugging via Sentry

---

## Phase 4: Client Organization (Low Priority)

### Goal
Reorganize `client/src/` for better feature isolation and reusability.

### Tasks

#### 4.1 Create Feature-Based Page Structure
```
client/src/pages/
├── generation/
│   ├── SubmitLetter.tsx
│   ├── MyLetters.tsx
│   └── LetterDetail.tsx
├── review/
│   ├── ReviewQueue.tsx
│   └── ReviewDetail.tsx
├── billing/
│   ├── Billing.tsx
│   └── Receipts.tsx
└── ...
```

#### 4.2 Extract Reusable Hooks
- `useLetterGeneration()` — Submit + track progress
- `useLetterReview()` — Claim, edit, approve
- `useSubscription()` — Manage subscription
- `usePaywall()` — Handle payment flow

#### 4.3 Create Component Library
- Organize UI components by feature
- Document component props and usage
- Create Storybook stories (optional)

### Expected Outcome
- Client code is more organized and reusable
- Easier to add new features
- Better component documentation

---

## Phase 5: Testing Infrastructure (Low Priority)

### Goal
Establish comprehensive testing for critical paths.

### Tasks

#### 5.1 Add Unit Tests
- Test all tRPC procedures
- Test database helpers
- Test email templates
- Target: 80% coverage

#### 5.2 Add Integration Tests
- Test full letter generation flow
- Test payment flow
- Test review workflow
- Use test database (Supabase)

#### 5.3 Add E2E Tests (Optional)
- Test critical user journeys
- Use Playwright or Cypress
- Run against staging environment

### Expected Outcome
- Confidence in code changes
- Faster debugging
- Easier refactoring

---

## Phase 6: Documentation (High Priority)

### Goal
Ensure all code is well-documented and easy to understand.

### Tasks

#### 6.1 Add JSDoc Comments
- All exported functions
- All tRPC procedures
- All database helpers
- Include examples and error cases

#### 6.2 Create API Reference
- Document all tRPC procedures
- Include input/output types
- Include error codes
- Include usage examples

#### 6.3 Create Developer Guide
- How to add a new feature
- How to debug the pipeline
- How to add a new email template
- How to add a new payment plan

### Expected Outcome
- New developers can onboard quickly
- Code is self-documenting
- Fewer questions in code reviews

---

## Phase 7: Performance Optimization (Low Priority)

### Goal
Identify and fix performance bottlenecks.

### Tasks

#### 7.1 Profile Pipeline Performance
- Measure time for each stage
- Identify slow AI calls
- Optimize prompt engineering

#### 7.2 Optimize Database Queries
- Add missing indexes
- Reduce N+1 queries
- Use batch operations where possible

#### 7.3 Optimize Frontend
- Code splitting by route
- Lazy load heavy components (Tiptap, Recharts)
- Optimize images and assets

### Expected Outcome
- Faster pipeline execution
- Faster database queries
- Faster page loads

---

## Estimated Timeline

| Phase | Priority | Effort | Timeline |
|-------|----------|--------|----------|
| 1: Module Organization | Medium | 10 hours | 1-2 weeks |
| 2: Type Consolidation | Low | 4 hours | 1 week |
| 3: Error Handling | Medium | 6 hours | 1 week |
| 4: Client Organization | Low | 8 hours | 1-2 weeks |
| 5: Testing | Low | 15 hours | 2-3 weeks |
| 6: Documentation | High | 6 hours | 1 week |
| 7: Performance | Low | 8 hours | 1-2 weeks |

**Total:** ~57 hours (~2 months at 5 hours/week)

---

## Implementation Strategy

### For Each Phase:

1. **Create feature branch:** `refactor/phase-X-description`
2. **Implement changes** with backward compatibility
3. **Run full test suite:** `pnpm test && pnpm build`
4. **Code review:** Verify no regressions
5. **Merge to main** and deploy

### Backward Compatibility:

- Use index.ts re-exports to maintain existing import paths
- Add deprecation warnings for old imports (if needed)
- Update imports gradually across codebase

### Risk Mitigation:

- Commit frequently (every 1-2 hours)
- Test after each logical change
- Use feature flags for large changes
- Keep rollback plan ready

---

## Success Criteria

- ✅ All tests pass
- ✅ No performance regression
- ✅ Code is easier to understand
- ✅ New developers can onboard in <1 day
- ✅ Feature addition time reduced by 20%
- ✅ Bug fix time reduced by 15%

---

## Questions?

Refer to `ARCHITECTURE.md` for current structure or `docs/skills/` for pipeline details.
