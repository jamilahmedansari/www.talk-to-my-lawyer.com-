const fs = require('fs');
let code = fs.readFileSync('server/routers/billing.ts', 'utf8');

// Fix duplicates in imports
code = code.replace(/createAttorneyReviewCheckout,\n.*createAttorneyReviewCheckout,/s, 'createAttorneyReviewCheckout,');

// Replace lines 319-354 with correct ones
const startComment = `  /**\n   * Creates a $100 Stripe Checkout session for the optional attorney review upsell.\n   * Only valid when the letter is in generated_unlocked status (free trial).\n   */`;
code = code.replace(/  \/\*\*\n   \* Creates a \$100 Stripe Checkout session.*?origin,\n      \}\);\n    \}\),/s, 
`  /**
   * Creates a $100 Stripe checkout for the attorney review upsell.
   * Only available on generated_unlocked (free-trial) letters.
   */
  createAttorneyReviewCheckout: subscriberProcedure
    .input(z.object({ letterId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await checkTrpcRateLimit("payment", \`user:\${ctx.user.id}\`);
      const letter = await getLetterRequestSafeForSubscriber(input.letterId, ctx.user.id);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND", message: "Letter not found" });
      
      // Allow both generated_unlocked (upsell not yet dismissed) and
      // upsell_dismissed (subscriber dismissed but then changed their mind)
      if (letter.status !== "generated_unlocked" && letter.status !== "upsell_dismissed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: \`Attorney review upsell only available on free-trial letters (got: \${letter.status}). Expected: generated_unlocked or upsell_dismissed\`,
        });
      }
      
      const origin = getAppUrl(ctx.req);
      return createAttorneyReviewCheckout({
        userId: ctx.user.id,
        email: ctx.user.email ?? "",
        name: ctx.user.name,
        letterId: input.letterId,
        origin,
      });
    }),`);

fs.writeFileSync('server/routers/billing.ts', code);
