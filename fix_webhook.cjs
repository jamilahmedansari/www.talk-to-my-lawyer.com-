const fs = require('fs');
let code = fs.readFileSync('server/stripeWebhook.ts', 'utf8');

const regex = /if \(letterIdStr && unlockType === "attorney_review_upsell"\) \{[\s\S]*?\/\/\s*For subscription mode, the subscription\.\* events handle activation\./;

const replacement = `if (letterIdStr && unlockType === "attorney_review_upsell") {
              const letterId = parseInt(letterIdStr, 10);
              if (!isNaN(letterId)) {
                try {
                  const letter = await getLetterRequestById(letterId);
                  
                  // Accept both generated_unlocked and upsell_dismissed:
                  // subscriber may have dismissed the upsell card then paid anyway.
                  const validUpsellStatuses = ["generated_unlocked", "upsell_dismissed"] as const;
                  const isValidStatus = letter && (validUpsellStatuses as readonly string[]).includes(letter.status);
                  
                  if (isValidStatus) {
                    // Atomic compare-and-set prevents duplicate side-effects on Stripe retries.
                    const updated = await updateLetterStatusIfCurrent(
                      letterId,
                      letter!.status,
                      "pending_review"
                    );
                    
                    if (!updated) {
                      console.warn(\`[StripeWebhook] Attorney review upsell: letter #\${letterId} status changed concurrently — skipping duplicate processing\`);
                    } else {
                      await logReviewAction({
                        letterRequestId: letterId,
                        actorType: "system",
                        action: "attorney_review_upsell_paid",
                        noteText: \`Attorney review upsell payment received. Letter queued for review. Stripe session: \${session.id}\`,
                        noteVisibility: "user_visible",
                        fromStatus: letter!.status as string,
                        toStatus: "pending_review",
                      });
                      
                      await createNotification({
                        userId,
                        type: "letter_unlocked",
                        title: "Payment confirmed — letter sent for attorney review!",
                        body: \`Your letter "\${letter.subject}" is now in the attorney review queue.\`,
                        link: \`/letters/\${letterId}\`,
                      });
                      
                      const subscriber = await getUserById(userId);
                      const origin = session.success_url?.split('/letters')[0] ?? process.env.APP_BASE_URL ?? 'https://www.talk-to-my-lawyer.com';
                      
                      if (subscriber?.email) {
                        await sendLetterUnlockedEmail({
                          to: subscriber.email,
                          name: subscriber.name ?? "Subscriber",
                          subject: letter.subject,
                          letterId,
                          appUrl: origin,
                        }).catch(console.error);
                      }
                      
                      // Notify attorney team (send to admin/review email)
                      const effectiveReviewEmail = process.env.REVIEW_TEAM_EMAIL ?? process.env.ADMIN_REVIEW_EMAIL ?? process.env.DEVOPS_EMAIL ?? process.env.OWNER_EMAIL;
                      if (!effectiveReviewEmail) {
                          console.error(\`[StripeWebhook] No admin email configured, review-team notification NOT sent for letter #\${letterId}\`);
                      } else {
                          await sendNewReviewNeededEmail({
                            to: effectiveReviewEmail,
                            name: "Review Team",
                            letterSubject: letter.subject,
                            letterId,
                            letterType: letter.letterType ?? "General",
                            jurisdiction: [letter.jurisdictionCity, letter.jurisdictionState, letter.jurisdictionCountry].filter(Boolean).join(", ") || "Not specified",
                            appUrl: origin,
                          }).catch(console.error);
                      }
                      
                      console.log(\`[StripeWebhook] Attorney review upsell paid for letter #\${letterId} → pending_review\`);
                    } // end else (!updated)
                  } else {
                    console.warn(\`[StripeWebhook] Attorney review upsell: letter #\${letterId} not in a valid upsell status (status: \${letter?.status})\`);
                  }
                } catch (upsellErr) {
                  console.error(\`[StripeWebhook] Failed to process attorney review upsell for letter #\${letterId}:\`, upsellErr);
                }
              }
            }
          }
          // For subscription mode, the subscription.* events handle activation.`;

code = code.replace(regex, replacement);
fs.writeFileSync('server/stripeWebhook.ts', code);
