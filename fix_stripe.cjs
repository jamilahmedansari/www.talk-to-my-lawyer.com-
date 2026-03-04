const fs = require('fs');
let code = fs.readFileSync('server/stripe.ts', 'utf8');

const badBlockRegion = code.indexOf('createAttorneyReviewCheckout(params: {');
if (badBlockRegion !== -1) {
    const end = code.indexOf('return { url: session.url, sessionId: session.id };', badBlockRegion);
    
    const newFunc = `export async function createAttorneyReviewCheckout(params: {
  userId: number;
  email: string;
  name: string | null;
  letterId: number;
  origin: string;
}): Promise<{ url: string; sessionId: string }> {
  const { userId, email, name, letterId, origin } = params;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: email,
    metadata: {
      user_id: userId.toString(),
      letter_id: letterId.toString(),
      unlock_type: "attorney_review_upsell",
      // plan_id is read by the webhook's activateSubscription call.
      // Using a dedicated value ensures the webhook does not create a
      // "per_letter" subscription record for this one-time upsell payment.
      plan_id: "attorney_review_upsell",
      customer_email: email,
      customer_name: name ?? "",
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Attorney Review — Talk to My Lawyer",
            description: "A licensed attorney will review, edit, and approve your AI-drafted letter.",
            metadata: {
              letter_id: letterId.toString(),
              plan_id: "attorney_review_upsell",
              unlock_type: "attorney_review_upsell",
            },
          },
          unit_amount: ATTORNEY_REVIEW_UPSELL_PRICE_CENTS,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      metadata: {
        user_id: userId.toString(),
        plan_id: "attorney_review_upsell",
        letter_id: letterId.toString(),
        unlock_type: "attorney_review_upsell",
      },
    },
    success_url: \`\${origin}/letters/\${letterId}?review_submitted=true\`,
    cancel_url: \`\${origin}/letters/\${letterId}?review_canceled=true\`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}`;

    const before = code.substring(0, badBlockRegion);
    // Find the end of the original function
    const afterFunc = code.substring(end + 'return { url: session.url, sessionId: session.id };\n}'.length);

    code = before + newFunc + afterFunc;
    fs.writeFileSync('server/stripe.ts', code);
}
