# Payment & Paywall Flow Reference

## Table of Contents
- [Paywall States](#paywall-states)
- [Free Unlock Flow](#free-unlock-flow)
- [Pay-Per-Letter Flow](#pay-per-letter-flow)
- [Trial Review Flow](#trial-review-flow)
- [Subscription Bypass](#subscription-bypass)
- [Stripe Webhook Processing](#stripe-webhook-processing)
- [Discount Codes & Affiliate](#discount-codes--affiliate)

---

## Paywall States

**Procedure:** `billing.checkPaywallStatus`

Returns one of three states:

| State | Meaning | Action |
|-------|---------|--------|
| `free` | First letter, no prior unlocked letters | Show "Free" button |
| `subscribed` | Active monthly/annual subscription | Bypass paywall entirely |
| `pay_per_letter` | Free letter used, no subscription | Show $200 checkout |

### Detection Logic
1. Check for active recurring subscription → if yes, return `subscribed`
2. Count letters that moved past `generated_locked` (i.e., were unlocked)
3. If count = 0 → return `free` (eligible for first-letter-free)
4. Otherwise → return `pay_per_letter`

---

## Free Unlock Flow

**Procedure:** `billing.freeUnlock`
**Guard:** `subscriberProcedure`

```
Subscriber clicks "Unlock Free" on LetterPaywall
    │
    ▼
billing.freeUnlock({ letterId })
    │
    ├─ Verify letter is generated_locked
    ├─ Verify user has zero previously unlocked letters
    ├─ Transition: generated_locked → pending_review
    ├─ Log review action: free_unlock (internal)
    ├─ Send letter-unlocked email to subscriber
    ├─ Send new-review-needed email to attorney team
    │
    └─ Return { success: true, free: true }
```

---

## Pay-Per-Letter Flow

**Procedure:** `billing.payToUnlock`
**Guard:** `subscriberProcedure`
**Rate limit:** 10 payment attempts per hour per user

```
Subscriber clicks "Pay $200" on LetterPaywall
    │
    ▼
billing.payToUnlock({ letterId, discountCode? })
    │
    ├─ Verify letter is generated_locked
    ├─ Create Stripe checkout session ($200, or discounted)
    │
    └─ Return { sessionId, url } → redirect to Stripe
    
    ... Stripe checkout completes ...
    
    ▼
Stripe webhook: checkout.session.completed
    │
    ├─ Extract letterId from metadata
    ├─ Transition: generated_locked → pending_review
    ├─ Process discount code (if used):
    │   ├─ Increment usage count
    │   ├─ Create commission ledger entry for employee
    │
    ├─ Send letter-unlocked email
    ├─ Send new-review-needed email to attorneys
    │
    └─ Done
```

---

## Trial Review Flow

**Procedure:** `billing.payTrialReview`
**Guard:** `subscriberProcedure`
**Price:** $50

```
Subscriber clicks "Pay $50 for Attorney Review"
    │
    ▼
billing.payTrialReview({ letterId, discountCode? })
    │
    ├─ Verify letter is generated_unlocked
    ├─ Create Stripe checkout session ($50)
    │
    └─ Return { sessionId, url } → redirect to Stripe
    
    ... Stripe checkout completes ...
    
    ▼
Stripe webhook processes and transitions to pending_review
```

---

## Subscription Bypass

**Procedure:** `billing.checkPaywallStatus` returns `{ state: "subscribed" }`

Active subscribers with monthly or annual plans:
- Never see the paywall overlay
- Letters transition directly from `generated_locked` to `pending_review`
- Checked via `hasActiveRecurringSubscription(userId)`

### Subscription Plans
Managed via `billing.createCheckout` → Stripe checkout for plan subscription.

### Billing Portal
`billing.createBillingPortal` → creates Stripe billing portal session for subscription management.

---

## Stripe Webhook Processing

**File:** `server/stripeWebhook.ts`

### Events Handled
- `checkout.session.completed` → letter unlock or subscription activation
- `invoice.payment_succeeded` → subscription renewal
- `customer.subscription.deleted` → subscription cancellation

### Metadata Convention
Stripe checkout sessions include metadata:
```json
{
  "letterId": "123",
  "userId": "456",
  "type": "letter_unlock" | "trial_review" | "subscription"
}
```

---

## Discount Codes & Affiliate

### Discount Code Application
When a subscriber uses a discount code at checkout:
1. Code validated via `affiliate.validateCode` (public procedure)
2. Discount percentage applied to Stripe checkout price
3. On successful payment, webhook handler:
   - Increments `discount_codes.usageCount`
   - Creates `commission_ledger` entry for the referring employee
   - Commission = configurable percentage of the transaction

### Employee Affiliate System
- Each employee gets an auto-generated discount code
- Employees view earnings via `affiliate.myEarnings`
- Employees request payouts via `affiliate.requestPayout`
- Admins process payouts via `affiliate.adminProcessPayout`

### Related Tables
- `discount_codes` — code, employeeId, discountPercent, usageCount, maxUses, isActive
- `commission_ledger` — employeeId, transactionId, amount, status (pending/paid)
- `payout_requests` — employeeId, amount, status (pending/completed/rejected), paymentMethod
