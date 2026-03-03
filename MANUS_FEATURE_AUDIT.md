# Manus Platform Feature Audit & Supabase Migration Status

This document provides a comprehensive audit of all features and services provided by the Manus platform within the **Talk to My Lawyer** codebase. It details the current implementation status, identifies dependencies on Manus, and outlines the path to full migration using Supabase and other third-party services.

## 1. Authentication

The application has a hybrid authentication system. The primary, modern implementation uses Supabase Auth, while legacy code for Manus OAuth remains. The migration is substantially complete, requiring only the removal of obsolete code.

| Feature / Service | Manus Implementation | Supabase / Custom Implementation | Status & Action Required |
| :--- | :--- | :--- | :--- |
| **User Signup** | N/A (Supabase is primary) | `server/supabaseAuth.ts` handles `/api/auth/signup`. Creates user in `auth.users` and syncs to local `users` table. | ✅ **Complete** |
| **User Login** | N/A (Supabase is primary) | `server/supabaseAuth.ts` handles `/api/auth/login` using `signInWithPassword`. | ✅ **Complete** |
| **Session Management** | `server/_core/sdk.ts` creates and verifies a custom JWT stored in the `app_session_id` cookie. | Supabase session tokens (`access_token`, `refresh_token`) are stored in an `sb_session` cookie and `localStorage`. | ⚠️ **Migration In Progress**<br/>The app relies on Supabase sessions, but legacy Manus JWT code (`sdk.ts`, `oauth.ts`) and cookie constants (`COOKIE_NAME`) are still present and should be removed. |
| **Password Reset** | Not provided by Manus SDK. | `server/supabaseAuth.ts` handles `/api/auth/forgot-password` and `/api/auth/reset-password` using Supabase functions. | ✅ **Complete** |
| **Email Verification** | Not provided by Manus SDK. | A custom token-based system (`email_verification_tokens` table) is implemented. `server/supabaseAuth.ts` handles `/api/auth/verify-email` and resend logic. | ✅ **Complete** |
| **User/Session Context** | `server/_core/sdk.ts` (`authenticateRequest`) verifies the Manus JWT. | `server/supabaseAuth.ts` (`authenticateRequest`) verifies the Supabase JWT and is the active context provider for tRPC. | ✅ **Complete**<br/>The tRPC context correctly uses the Supabase implementation. |
| **OAuth Callback** | `server/_core/oauth.ts` handles the `/api/oauth/callback` from the Manus login portal. | N/A. Supabase handles its own OAuth flows if configured, but this app uses email/password. | ❌ **Needs Removal**<br/>The entire Manus OAuth callback flow (`oauth.ts`, `sdk.ts`, `const.ts:getLoginUrl`) is obsolete and must be deleted. |

**Conclusion:** The core authentication logic is fully functional on Supabase. The remaining work is cleanup of legacy Manus OAuth files and code references.

---

## 2. Backend Infrastructure & Services (Forge API)

The application uses the Manus Forge API as a proxy for several backend services. Migrating fully to Supabase requires replacing these proxy calls with direct integrations.

| Feature / Service | Manus (Forge API) Implementation | Supabase / Custom Alternative | Status & Action Required |
| :--- | :--- | :--- | :--- |
| **AI Model Proxy** | `server/_core/chat.ts` uses `createOpenAI` with the Forge API URL (`BUILT_IN_FORGE_API_URL`) to proxy LLM calls. | The core letter generation pipeline (`server/pipeline.ts`) **bypasses Forge** and connects directly to Perplexity and Anthropic using `PERPLEXITY_API_KEY` and `ANTHROPIC_API_KEY`. | ⚠️ **Partial Dependency**<br/>The main AI pipeline is independent. The generic `/api/chat` endpoint depends on Forge. **Action:** Decide if this generic chat endpoint is needed. If so, replace the Forge proxy with a direct OpenAI/Anthropic client. |
| **File Storage (S3)** | `server/storage.ts` provides `storagePut` and `storageGet` functions that proxy uploads/downloads through the Forge API. This is used for letter attachments and generated PDFs. | **Supabase Storage** provides a direct, equivalent S3-compatible API. | ❌ **Critical Dependency**<br/>This is a hard dependency. **Action:** Rewrite `server/storage.ts` to use the `@supabase/supabase-js` client for file uploads and downloads. Update `pdfGenerator.ts` and `routers/letters.ts` to use the new implementation. |
| **Image Generation** | `server/_core/imageGeneration.ts` provides a `generateImage` function that calls the Forge Image Service. | Direct integration with services like OpenAI DALL-E, Stability AI, or Midjourney. | ⚠️ **Minor Dependency**<br/>This service is **not currently used** in any active application code paths. **Action:** If image generation is a future requirement, implement a direct integration. Otherwise, this module can be deleted. |
| **Voice Transcription** | `server/_core/voiceTranscription.ts` provides a `transcribeAudio` function that calls the Forge Speech-to-Text service (Whisper proxy). | Direct integration with OpenAI's Whisper API or other transcription services. | ⚠️ **Minor Dependency**<br/>This service is **not currently used** in any active application code paths. **Action:** If voice transcription is a future requirement, implement a direct integration. Otherwise, this module can be deleted. |
| **Maps Proxy** | `server/_core/map.ts` provides a `makeRequest` function that proxies requests to the Google Maps API via Forge. | Direct integration with the Google Maps Platform APIs. | ⚠️ **Minor Dependency**<br/>This service is **not currently used** in any active application code paths. **Action:** If mapping features are needed, implement a direct integration with the Google Maps SDK and manage the API key. Otherwise, this module can be deleted. |

**Conclusion:** The Forge API is a significant dependency, especially for file storage. The AI pipeline has already been migrated to direct APIs. The other Forge services (Image, Voice, Maps) are present but unused.

---

## 3. Frontend & Build Process

The frontend has several minor dependencies on Manus services and build tools.

| Feature / Service | Manus Implementation | Supabase / Custom Alternative | Status & Action Required |
| :--- | :--- | :--- | :--- |
| **Build-time Plugin** | `vite-plugin-manus-runtime` is included in `vite.config.ts`. Its exact function is unclear but likely involves environment variable injection or runtime helpers. | Standard Vite environment variable handling (`import.meta.env`). | ❌ **Needs Removal**<br/>This plugin is a dependency. It must be removed from `vite.config.ts`. Any functionality it provides (like injecting `VITE_APP_ID`) must be replaced with standard Vite `.env` file usage. |
| **Debug Collector** | `vite-plugin-manus-debug-collector` is a development-only tool for collecting browser logs. | N/A. This is a non-essential development utility. | ⚠️ **Minor Dependency**<br/>Can be safely removed from `vite.config.ts` without impacting application functionality. |
| **Asset CDN** | Multiple images (logos, marketing assets) are hot-linked from `files.manuscdn.com` and `cdn.manus.im`. | Host these static assets directly in the project's `/public` folder or upload them to Supabase Storage. | ❌ **Needs Migration**<br/>These assets will become unavailable. **Action:** Download all images from Manus CDN URLs and replace the links with local paths or Supabase Storage URLs. |
| **Hosting/Domains** | The `vite.config.ts` `allowedHosts` list and the `n8nCallback` URL construction in `pipeline.ts` contain references to Manus hosting domains (`.manus.computer`, `.manuspre.computer`). | These should be updated to the application's actual production and staging domains. | ⚠️ **Needs Cleanup**<br/>These are configuration artifacts from the Manus development environment and should be removed or replaced with your own domains. |

**Conclusion:** The frontend dependencies are minor but require action. Assets must be migrated from the CDN, and the Vite configuration needs to be cleaned of Manus-specific plugins and settings.

---

## 4. Other Services (Status: Fully Independent)

The following services are already implemented using third-party providers and have **no dependency** on the Manus platform:

*   **Database:** PostgreSQL via Supabase, using `drizzle-orm`. (✅ **Complete**) 
*   **Email:** Resend API. (✅ **Complete**)
*   **Payments:** Stripe API. (✅ **Complete**)
*   **Rate Limiting:** Upstash Redis. (✅ **Complete**)
*   **Error Monitoring:** Sentry. (✅ **Complete**)

## Overall Summary & Next Steps

The application is in a strong position for a full migration. The most critical dependencies have already been replaced with Supabase and other direct integrations.

**The required actions to become fully independent of Manus are:**

1.  **Replace Storage Proxy:** Rewrite `server/storage.ts` to use Supabase Storage. This is the most critical step.
2.  **Remove Legacy Auth:** Delete `server/_core/oauth.ts`, `server/_core/sdk.ts`, and all related code for Manus OAuth.
3.  **Migrate CDN Assets:** Download all images from `manuscdn.com` and host them within the project.
4.  **Clean Up Build Config:** Remove `vite-plugin-manus-runtime` and other Manus-specific settings from `vite.config.ts`.
5.  **Remove Unused Forge Proxies:** Delete the modules for Image Generation, Voice Transcription, and Maps, as they are not used.
