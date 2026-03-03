# Talk to My Lawyer — Comprehensive TODO List

This document outlines all remaining tasks, bugs, and missing features identified during the full-stack audit. Items are prioritized from P0 (critical) to P2 (low priority).

## P0: Critical Bugs & Gaps

| ID | Task | Area | Details |
|:---|:---|:---|:---|
| **P0-1** | **Fix Status Machine for Free Trial** | `shared/types.ts` | The `generated_unlocked` status is missing from `ALLOWED_TRANSITIONS`. The pipeline can never transition to it, so the free trial flow is broken. Add `drafting: ["generated_locked", "generated_unlocked"]` and `generated_unlocked: ["pending_review"]`. |
| **P0-2** | **Implement Attorney Review Upsell** | `server/stripe.ts` | The `$100 attorney review` upsell is not implemented. The `createAttorneyReviewCheckout` function is missing from `stripe.ts`, and the `LetterPaywall` does not call it. The Stripe webhook also does not handle this payment type. |
| **P0-3** | **Fix Free Trial Logic** | `server/pipeline.ts` | The pipeline currently always transitions to `generated_locked`. It needs to call `checkFirstLetterFree` and transition to `generated_unlocked` if the user is eligible. |
| **P0-4** | **Wire Up Employee/Attorney Welcome Emails** | `server/routers/auth.ts` | The `completeOnboarding` procedure does not call `sendEmployeeWelcomeEmail` or `sendAttorneyWelcomeEmail`. New employees and attorneys get no welcome email. |

## P1: High-Priority Features & Fixes

| ID | Task | Area | Details |
|:---|:---|:---|:---|
| **P1-1** | **Implement Employee Commission Display** | `client/AffiliateDashboard.tsx` | The affiliate dashboard is a stub. It needs to call `affiliate.myEarnings` and `affiliate.myCommissions` and display the results in a chart and table. |
| **P1-2** | **Implement Employee Payout Request** | `client/AffiliateDashboard.tsx` | The dashboard needs a "Request Payout" button that calls `affiliate.requestPayout` and a table to display payout history from `affiliate.myPayouts`. |
| **P1-3** | **Wire Up Commission Email** | `server/stripeWebhook.ts` | The Stripe webhook calculates commissions but does not call `sendEmployeeCommissionEmail`. Employees are not notified when they earn a commission. |
| **P1-4** | **Create Profile Settings Pages for All Roles** | `client/App.tsx` | Only a subscriber profile page exists (`/profile`). Employee, attorney, and admin roles have no dedicated settings page, despite the nav link pointing to `/profile`. Create separate pages or a unified page with role-specific sections. |
| **P1-5** | **Wire Up Attorney Notification Emails** | `server/routers/admin.ts`, `server/routers/review.ts` | `admin.assignLetter` does not call `sendReviewAssignedEmail`. `review.approve` does not call `sendReviewCompletedEmail` (to notify the attorney their review is done). |

## P2: Low-Priority & Cleanup

| ID | Task | Area | Details |
|:---|:---|:---|:---|
| **P2-1** | **Add Admin Analytics** | `client/pages/admin/Dashboard.tsx` | The admin dashboard shows basic stats but no charts or trends. Use the `byStatus` data from `admin.stats` to create a pie or bar chart of letter statuses. |
| **P2-2** | **Remove Legacy `payTrialReview`** | `server/routers/billing.ts` | The `payTrialReview` procedure is from a deprecated pricing model. It should be removed. |
| **P2-3** | **Mobile Responsiveness** | CSS | The initial audit noted that many pages need mobile responsiveness improvements. This is a general UI task. |
| **P2-4** | **Add User Management to Admin UI** | `client/pages/admin/Users.tsx` | The `Users.tsx` page is a placeholder. It should call `admin.users` to list all users and `admin.updateRole` to allow role changes. |
