const fs = require('fs');
let code = fs.readFileSync('server/routers/billing.ts', 'utf8');

const regex = /  payForAttorneyReview: subscriberProcedure\s*\.input\(z\.object\(\{ letterId: z\.number\(\) \}\)\)\s*\*\s*Creates a \$100 Stripe checkout for the attorney review upsell\.\s*\*\s*Only available on generated_unlocked \(free-trial\) letters\.\s*\*\/\s*createAttorneyReviewCheckout: subscriberProcedure\s*\.input\(z\.object\(\{ letterId: z\.number\(\)\.int\(\)\.positive\(\) \}\)\)\s*\.mutation\(async \(\{ ctx, input \} \).*?origin,\n\s*\}\);\n\s*\}\),/s;


// First, we can just replace payForAttorneyReview to the end of createAttorneyReviewCheckout
const badBlockMatch = code.match(/payForAttorneyReview:[\s\S]*?origin,\s*\}\);\n\s*\}\),/);

if (badBlockMatch) {
    code = code.replace(/payForAttorneyReview:[\s\S]*?origin,\s*\}\);\n\s*\}\),/, `  /**
   * Creates a $100 Stripe checkout for the attorney review upsell.
   * Only available on generated_unlocked (free-trial) letters.
   */
  createAttorneyReviewCheckout: subscriberProcedure
    .input(z.object({ letterId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await checkTrpcRateLimit("payment", \`user:\${ctx.user.id}\`);
      const letter = await getLetterRequestSafeForSubscriber(input.letterId, ctx.user.id);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND", message: "Letter not found" });
      
      if (letter.status !== "generated_unlocked" && letter.status !== "upsell_dismissed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: \`Attorney review upsell only available on free-trial letters (got: \${letter.status})\`,
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
}

// remove duplicate import
const importMatch = code.match(/createAttorneyReviewCheckout,\s*createAttorneyReviewCheckout,/s);
if (importMatch) {
    code = code.replace(/createAttorneyReviewCheckout,\s*createAttorneyReviewCheckout,/s, 'createAttorneyReviewCheckout,');
}

fs.writeFileSync('server/routers/billing.ts', code);
