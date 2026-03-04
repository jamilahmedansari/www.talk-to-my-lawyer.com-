/**
 * LetterFreeTrialUpsell — shown when a letter is in `generated_unlocked` status.
 *
 * Free-trial flow:
 *   - Pipeline detected this is the user's first letter → set status to generated_unlocked.
 *   - User sees the FULL letter draft (no blur, no paywall).
 *   - Below the letter, an optional upsell card offers:
 *       A) "Submit for Attorney Review" for $100 (attorney_review_upsell Stripe checkout)
 *       B) "Keep my free copy" — dismisses the upsell, letter stays accessible.
 *
 * Copilot fix (comment 5): "Keep Free Copy" path is fully implemented — it calls
 * billing.dismissAttorneyReviewUpsell which marks the upsell as dismissed so the
 * card is not shown again on reload.
 */
import { useState, useRef } from "react";
import {
  Gift, Scale, CheckCircle, ArrowRight, X, Loader2, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface LetterFreeTrialUpsellProps {
  letterId: number;
  letterType: string;
  subject: string;
}

export function LetterFreeTrialUpsell({
  letterId,
  letterType,
  subject,
}: LetterFreeTrialUpsellProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Ref to the blank popup opened synchronously on click so browsers don't block it.
  // The popup's URL is set to the Stripe checkout URL once the mutation resolves.
  const popupRef = useRef<Window | null>(null);

  // $100 attorney review upsell checkout
  const attorneyReviewMutation = trpc.billing.createAttorneyReviewCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        setIsRedirecting(true);
        if (popupRef.current && !popupRef.current.closed) {
          // Navigate the already-open blank popup to the Stripe URL
          popupRef.current.location.href = data.url;
        } else {
          // Fallback: popup was blocked — open normally
          window.open(data.url, "_blank");
        }
        popupRef.current = null;
        toast.info("Redirecting to secure payment...", {
          description: "Complete checkout to submit your letter for attorney review.",
        });
      }
    },
    onError: (err) => {
      // Close the blank popup if the mutation failed
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
        popupRef.current = null;
      }
      setIsRedirecting(false);
      toast.error("Could not start checkout", { description: err.message });
    },
  });

  // Dismiss upsell — keeps letter accessible, hides the upsell card permanently
  const dismissMutation = trpc.billing.dismissAttorneyReviewUpsell.useMutation({
    onSuccess: () => {
      setDismissed(true);
      toast.success("Your free letter is saved!", {
        description: "You can download it anytime from your letters dashboard.",
      });
    },
    onError: (err) => {
      toast.error("Could not dismiss upsell", { description: err.message });
    },
  });

  if (dismissed) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Your free letter is saved</p>
              <p className="text-xs text-green-700 mt-0.5">
                You can download it anytime. If you change your mind, you can still submit for
                attorney review from the letter detail page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Gift className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base text-amber-900">
                Your first letter is free!
              </CardTitle>
              <p className="text-xs text-amber-700 mt-0.5">
                Your AI-drafted letter is ready. Want an attorney to review and sign off on it?
              </p>
            </div>
          </div>
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs whitespace-nowrap">
            Free Trial
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Value props */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { icon: Scale, text: "Reviewed by a licensed attorney" },
            { icon: CheckCircle, text: "Professionally approved & signed" },
            { icon: Star, text: "Stronger legal standing" },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 bg-white/70 rounded-lg px-3 py-2 text-xs text-amber-900"
            >
              <Icon className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
              {text}
            </div>
          ))}
        </div>

        <Separator className="bg-amber-200" />

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Primary: pay for attorney review */}
          <Button
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => {
              // Open a blank popup synchronously in the click handler so browsers
              // don't block it. The URL is set in onSuccess once Stripe responds.
              popupRef.current = window.open("", "_blank");
              attorneyReviewMutation.mutate({ letterId });
            }}
            disabled={
              attorneyReviewMutation.isPending ||
              isRedirecting ||
              dismissMutation.isPending
            }
          >
            {attorneyReviewMutation.isPending || isRedirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Redirecting...
              </>
            ) : (
              <>
                <Scale className="h-4 w-4 mr-2" />
                Submit for Attorney Review — $100
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>

          {/* Secondary: keep free copy and dismiss upsell */}
          <Button
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-100 sm:w-auto"
            onClick={() => dismissMutation.mutate({ letterId })}
            disabled={
              dismissMutation.isPending ||
              attorneyReviewMutation.isPending ||
              isRedirecting
            }
          >
            {dismissMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Keep my free copy
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-amber-700 text-center">
          Choosing &ldquo;Keep my free copy&rdquo; saves your letter as-is. You can still submit
          for attorney review later from the letter detail page.
        </p>
      </CardContent>
    </Card>
  );
}
