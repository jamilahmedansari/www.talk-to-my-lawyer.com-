/**
 * LetterFreeTrialUpsell — shown when a letter is in `generated_unlocked` status.
 *
 * Free trial flow:
 *   - The AI pipeline detected this is the user's first letter → generated_unlocked
 *   - The full draft is visible (no blur)
 *   - Two CTAs are shown:
 *       1. "Submit for Free Review" — calls billing.freeUnlock → pending_review (no charge)
 *       2. "Upgrade: Attorney Review ($100)" — calls billing.payForAttorneyReview → Stripe checkout
 *          Stripe webhook transitions generated_unlocked → pending_review on payment.
 *
 * The $100 upsell is optional. Users can always use the free path.
 */
import { useState, useRef } from "react";
import {
  Gift, Scale, CheckCircle, ArrowRight, X, Loader2, Star,
  Shield, Gavel, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface LetterFreeTrialUpsellProps {
  letterId: number;
  letterType?: string;
  subject: string;
  /** Full AI draft content — shown without blur for free trial letters */
  draftContent?: string;
}

export function LetterFreeTrialUpsell({
  letterId,
  draftContent,
}: LetterFreeTrialUpsellProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const popupRef = useRef<Window | null>(null);

  // Free unlock mutation (no charge)
  const freeUnlockMutation = trpc.billing.freeUnlock.useMutation({
    onSuccess: () => {
      toast.success("Your letter has been submitted for free attorney review!");
      window.location.reload();
    },
    onError: (err) => {
      toast.error("Could not submit for free review", { description: err.message });
    },
  });

  // $100 attorney review upsell checkout
  const payForReviewMutation = trpc.billing.payForAttorneyReview.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        setIsRedirecting(true);
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.location.href = data.url;
        } else {
          window.open(data.url, "_blank");
        }
        popupRef.current = null;
        toast.info("Redirecting to secure payment...", {
          description: "Complete checkout to submit your letter for attorney review.",
        });
      }
    },
    onError: (err) => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
        popupRef.current = null;
      }
      setIsRedirecting(false);
      toast.error("Payment could not be initiated", {
        description: err.message || "Please try again in a moment.",
      });
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

  const isPaidPending = payForReviewMutation.isPending || isRedirecting;
  const previewLines = draftContent?.split("\n") ?? [];
  const hasDraft = previewLines.length > 0;

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
    <div className="space-y-5">
      {/* ── Full Draft Preview (no blur for free trial) ── */}
      {hasDraft && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Your AI Draft</span>
              <Badge variant="secondary" className="ml-auto text-xs bg-green-100 text-green-700 border-green-200">
                Free Trial
              </Badge>
            </div>
            <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {draftContent}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* ── Main Upsell Card ── */}
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
                popupRef.current = window.open("", "_blank");
                payForReviewMutation.mutate({ letterId });
              }}
              disabled={
                payForReviewMutation.isPending ||
                isRedirecting ||
                dismissMutation.isPending
              }
            >
              {payForReviewMutation.isPending || isRedirecting ? (
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
                payForReviewMutation.isPending ||
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
            Choosing "Keep my free copy" saves your letter as-is. You can still submit
            for attorney review later from the letter detail page.
          </p>

          {/* ── FREE PATH CTA ── */}
          <div className="bg-gradient-to-r from-emerald-700 to-emerald-500 rounded-2xl p-6 text-white shadow-lg mt-4">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">Submit for Free Review</h2>
                <p className="text-sm text-white/80 mt-1">
                  Submit for attorney review at no cost. A licensed attorney will review, edit,
                  and approve your letter — completely free.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {[
                { icon: Shield, text: "Licensed attorney review" },
                { icon: CheckCircle, text: "Edits & approval included" },
                { icon: FileText, text: "Professional PDF delivered" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                  <Icon className="w-4 h-4 text-white/80 flex-shrink-0" />
                  <span className="text-xs text-white/90">{text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-3xl font-extrabold text-white">$0</span>
                <p className="text-xs text-white/60 mt-0.5">Free · Includes attorney review + PDF</p>
              </div>
              <Button
                onClick={() => freeUnlockMutation.mutate({ letterId })}
                disabled={freeUnlockMutation.isPending || isPaidPending}
                size="lg"
                className="bg-white text-emerald-800 hover:bg-white/90 font-bold shadow-md w-full sm:w-auto"
              >
                {freeUnlockMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    Submit for Free Review
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
