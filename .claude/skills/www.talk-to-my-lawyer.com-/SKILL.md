# www.talk-to-my-lawyer.com- Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill documents development patterns for a full-stack TypeScript application built with Vite, featuring a legal consultation platform. The codebase follows a client-server architecture with Supabase authentication, Stripe payments, and Drizzle ORM for database management. The application supports multiple user roles (subscribers, employees, admins) with role-specific dashboards and functionality.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names
- Component files: `UserProfile.tsx`
- Utility files: `supabaseAuth.ts`
- Test files: `auth.test.ts`

### Import Style
```typescript
// Use alias imports
import { Button } from '@/components/ui/button'
import { getUserProfile } from '@/lib/auth'
```

### Export Style
```typescript
// Mixed export patterns - use default for main components
export default function UserDashboard() { }

// Named exports for utilities
export const validateEmail = (email: string) => { }
export const formatCurrency = (amount: number) => { }
```

### Commit Messages
- Use freeform style with common prefixes: `feat:`, `chore:`, `docs:`, `checkpoint`
- Average length: ~218 characters
- Examples:
  - `feat: add mobile responsive grid layouts across all role pages`
  - `checkpoint: implement stripe webhook handler for subscription updates`

## Workflows

### Feature Pull Request Merge
**Trigger:** When completing a feature development cycle
**Command:** `/merge-feature`

1. Create feature branch from main
2. Implement changes across client/server/database layers:
   - Update `client/src/pages/**/*.tsx` for UI changes
   - Modify `server/routers/*.ts` for API endpoints
   - Update `drizzle/schema.ts` for database schema
   - Sync types in `shared/types.ts`
3. Create pull request with comprehensive description
4. Review code focusing on type safety and mobile responsiveness
5. Merge and update related documentation

```typescript
// Example: Adding new user feature across layers
// shared/types.ts
export interface UserPreference {
  id: string;
  userId: string;
  theme: 'light' | 'dark';
}

// server/routers/user.ts
export const updatePreferences = async (preferences: UserPreference) => {
  // Implementation
}

// client/src/pages/subscriber/Profile.tsx
const ProfilePage = () => {
  // Use the new types and API
}
```

### Mobile Responsiveness Fix
**Trigger:** When fixing mobile layout issues
**Command:** `/fix-mobile-responsive`

1. Identify non-responsive grid layouts using fixed `grid-cols-X`
2. Replace with responsive Tailwind variants:
   ```tsx
   // Before
   <div className="grid grid-cols-3 gap-4">
   
   // After
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
   ```
3. Test across all role-specific pages:
   - `client/src/pages/subscriber/*.tsx`
   - `client/src/pages/admin/*.tsx`
   - `client/src/pages/employee/*.tsx`
4. Update skeleton components for consistent loading states
5. Verify on mobile devices and browser dev tools

### Authentication System Enhancement
**Trigger:** When enhancing authentication capabilities
**Command:** `/add-auth-method`

1. Update client-side auth components:
   ```typescript
   // client/src/pages/Login.tsx
   const handleNewAuthMethod = async () => {
     const { data, error } = await supabase.auth.signInWith...
   }
   ```
2. Modify server auth router to handle new flow
3. Update Supabase configuration in `client/src/lib/supabase.ts`
4. Add callback handling in `client/src/pages/AuthCallback.tsx`
5. Update `server/supabaseAuth.ts` for server-side validation
6. Test complete auth flow including redirects

### Database Schema Migration
**Trigger:** When changing database structure
**Command:** `/add-migration`

1. Create migration SQL file in `drizzle/` directory:
   ```sql
   -- drizzle/0001_add_user_preferences.sql
   CREATE TABLE user_preferences (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES users(id),
     theme VARCHAR(10) NOT NULL DEFAULT 'light'
   );
   ```
2. Update `drizzle/schema.ts` with new table definitions
3. Sync types in `shared/types.ts`
4. Add database functions in `server/db.ts`
5. Update affected routers to use new schema
6. Update metadata in `drizzle/meta/*.json`

### Stripe Payment Integration
**Trigger:** When working on billing or payment features
**Command:** `/update-payment-flow`

1. Update Stripe configuration in `server/stripe.ts`
2. Modify billing router in `server/routers/billing.ts`:
   ```typescript
   export const createCheckoutSession = async (priceId: string) => {
     const session = await stripe.checkout.sessions.create({
       // Configuration
     });
   }
   ```
3. Update webhook handlers in `server/stripeWebhook.ts`
4. Adjust frontend billing page `client/src/pages/subscriber/Billing.tsx`
5. Test payment flow in Stripe test mode
6. Verify webhook delivery and subscription updates

### Documentation and Skill Updates
**Trigger:** When documenting features or updating AI skill definitions
**Command:** `/update-docs`

1. Create or update skill files in `docs/skills/**/*.md`
2. Add reference documentation for new features
3. Update Claude instincts in `.claude/homunculus/instincts/**/*.yaml`
4. Create migration guides or audit documentation
5. Update main README.md if needed
6. Ensure examples are current and functional

### Admin Panel Enhancement
**Trigger:** When enhancing admin functionality
**Command:** `/enhance-admin`

1. Update admin pages in `client/src/pages/admin/*.tsx`
2. Add new procedures to `server/routers/admin.ts`:
   ```typescript
   export const getUserMetrics = async () => {
     // Admin-only data aggregation
   }
   ```
3. Update admin layout in `client/src/components/shared/AppLayout.tsx`
4. Add role-based access controls
5. Include analytics or management features
6. Test admin permissions and data access

### Configuration and Tooling Setup
**Trigger:** When setting up new tools or updating project configuration
**Command:** `/setup-tooling`

1. Add configuration files (`.mcp.json`, `eslint.config.js`)
2. Update `package.json` with new dependencies
3. Create setup scripts in `scripts/*.mjs`
4. Update environment examples in `.env.example`
5. Configure build tools in `vite.config.ts`
6. Test development and build processes

## Testing Patterns

### Test Structure
- Use **vitest** as the testing framework
- Test files follow pattern: `*.test.ts`
- Place tests adjacent to source files when possible

```typescript
// auth.test.ts
import { describe, it, expect } from 'vitest'
import { validateEmail } from './auth'

describe('Auth utilities', () => {
  it('should validate email format', () => {
    expect(validateEmail('user@example.com')).toBe(true)
    expect(validateEmail('invalid-email')).toBe(false)
  })
})
```

## Commands

| Command | Purpose |
|---------|---------|
| `/merge-feature` | Complete feature development cycle with full-stack changes |
| `/fix-mobile-responsive` | Convert fixed layouts to responsive grid variants |
| `/add-auth-method` | Implement new authentication methods or improve auth flow |
| `/add-migration` | Create database migrations and update schema |
| `/update-payment-flow` | Implement or fix Stripe payment features |
| `/update-docs` | Add or update documentation and skill definitions |
| `/enhance-admin` | Add or improve admin dashboard functionality |
| `/setup-tooling` | Configure development tools and project setup |