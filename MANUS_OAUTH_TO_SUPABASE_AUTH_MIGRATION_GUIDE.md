# Migration Guide: From Manus OAuth to Supabase Auth

This document provides a comprehensive guide for migrating the Talk to My Lawyer application from the legacy Manus OAuth system to Supabase Auth.

## 1. Executive Summary

The migration from Manus OAuth to Supabase Auth involves a shift from a custom, JWT-based session management system to Supabase's built-in authentication. The application already has a significant amount of Supabase Auth integration in place, making this a relatively straightforward migration. The core changes involve removing the legacy Manus OAuth client, updating environment variables, and ensuring all authentication flows exclusively use Supabase.

This migration will simplify the authentication architecture, improve security by leveraging a managed auth service, and reduce maintenance overhead by removing bespoke code.

## 2. Detailed Migration Steps

### 2.1. Environment Variable Changes

The first step is to update the environment variables to remove the Manus OAuth configuration and ensure Supabase is correctly configured. The following changes are required in your `.env` file:

**Remove:**

*   `VITE_APP_ID`: No longer needed for Manus OAuth.
*   `JWT_SECRET` or `COOKIE_SECRET`: The session secret for Manus OAuth is obsolete.
*   `OAUTH_SERVER_URL`: The URL for the Manus OAuth server is no longer required.
*   `OWNER_OPEN_ID`: This was used to identify the admin user in the Manus OAuth system.
*   `VITE_OAUTH_PORTAL_URL`: The URL for the Manus OAuth login portal is no longer needed.

**Ensure the following Supabase variables are correctly set:**

*   `SUPABASE_URL` or `VITE_SUPABASE_URL`: The URL of your Supabase project.
*   `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY`: The public anonymous key for your Supabase project.
*   `SUPABASE_SERVICE_ROLE_KEY`: The service role key for your Supabase project, used for admin-level operations on the backend.
*   `SUPABASE_DATABASE_URL`: The connection string for your Supabase database.

### 2.2. Backend (Server-side) Changes

The backend already has a robust Supabase Auth implementation. The primary task is to remove the legacy Manus OAuth code.

#### 2.2.1. Remove Manus OAuth Middleware and Routes

In `server/_core/index.ts`, remove the registration of the Manus OAuth routes:

```typescript
// server/_core/index.ts

// Remove this line:
import { registerOAuthRoutes } from "./oauth";

// And this line:
registerOAuthRoutes(app);
```

#### 2.2.2. Delete Legacy Manus OAuth Files

The following files are now redundant and can be safely deleted:

*   `server/_core/oauth.ts`: The core of the Manus OAuth callback logic.
*   `server/_core/sdk.ts`: The Manus OAuth SDK wrapper.
*   `server/_core/types/manusTypes.ts`: TypeScript types for the Manus OAuth SDK.

#### 2.2.3. Update tRPC Context Creation

The tRPC context (`server/_core/context.ts`) already uses `authenticateRequest` from `server/supabaseAuth.ts`, which is correct. No changes are needed here, but it's important to confirm that the legacy Manus `authenticateRequest` from `server/_core/sdk.ts` is no longer referenced.

#### 2.2.4. Update User Model and Database Logic

The `users` table in `drizzle/schema.ts` uses an `openId` column to store the unique identifier from Manus OAuth. This should be updated to store the Supabase user ID (a UUID).

```typescript
// drizzle/schema.ts

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  // This should now store the Supabase User ID (UUID)
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  // ... other fields
});
```

The length of `openId` should be sufficient for a UUID. The database helper functions in `server/db.ts` that reference `openId` (e.g., `getUserByOpenId`, `upsertUser`) will continue to work correctly as they are agnostic to the format of the ID.

### 2.3. Frontend (Client-side) Changes

The frontend is already heavily integrated with Supabase Auth for login, signup, and session management. The main task is to remove any remaining Manus OAuth-related code.

#### 2.3.1. Remove Manus OAuth Login Logic

The `client/src/const.ts` file contains a `getLoginUrl` function that constructs the URL for the Manus OAuth login portal. This function and any components that use it should be removed. The `ManusDialog.tsx` component, which prompts for "Login with Manus," is also obsolete and should be deleted.

#### 2.3.2. Update tRPC Client Configuration

The tRPC client in `client/src/main.tsx` is correctly configured to send the Supabase access token in the `Authorization` header. No changes are required here.

```typescript
// client/src/main.tsx

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      // ...
      headers() {
        // This correctly sends the Supabase token
        const token = localStorage.getItem("sb_access_token");
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
        return {};
      },
      // ...
    }),
  ],
});
```

#### 2.3.3. Remove Legacy Cookie References

The application uses `COOKIE_NAME` (which resolves to `app_session_id`) for the Manus OAuth session. This is now obsolete. The Supabase session is handled via the `sb_session` cookie and the `sb_access_token` in local storage. All references to `COOKIE_NAME` and `app_session_id` should be removed.

### 2.4. Database Considerations

As mentioned, the `users.openId` column will now store the Supabase user ID. If you are migrating an existing database, you will need to run a script to update the `openId` for each user to their corresponding Supabase user ID. This will require mapping your existing users to their new Supabase identities.

### 2.5. Cleanup of Legacy Code

After the migration, it's recommended to perform a final search for any remaining references to Manus OAuth-related terms and remove them. This includes:

*   `ManusOAuth`
*   `manus.*oauth`
*   `OAUTH_SERVER_URL`
*   `oAuthServerUrl`
*   `registerOAuthRoutes`
*   `VITE_APP_ID`
*   `OWNER_OPEN_ID`
*   `COOKIE_NAME`
*   `app_session_id`

## 3. Conclusion

By following these steps, you can successfully migrate the Talk to My Lawyer application from Manus OAuth to Supabase Auth. This will result in a more streamlined, secure, and maintainable authentication system, fully leveraging the power of the Supabase platform.
