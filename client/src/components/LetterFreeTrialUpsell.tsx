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
import { useState } from "react";
import {
  CheckCircle, ArrowRight, Shield, Gavel,
  FileText, Gift, Loader2, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      toast.error("Payment could not be initiated", {
        description: err.message || "Please try again in a moment.",
      });
      setIsRedirecting(false);
    },
  });

  const isPaidPending = payForReviewMutation.isPending || isRedirecting;

  const previewLines = draftContent?.split("\n") ?? [];
  const hasDraft = previewLines.length > 0;

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

      {/* ── FREE PATH CTA ── */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">Your First Letter is Free!</h2>
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

      {/* ── $100 UPSELL CTA (optional) ── */}
      <div className="border border-amber-200 bg-amber-50/40 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Star className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-foreground">Priority Attorney Review</h3>
              <Badge className="bg-amber-500 text-white text-xs">Optional Upgrade</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Skip the queue and have a senior attorney review your letter with priority
              turnaround. Includes the same professional PDF as the free path.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {[
            { icon: Gavel, text: "Senior attorney assigned" },
            { icon: Shield, text: "Priority queue placement" },
            { icon: FileText, text: "Professional PDF delivered" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 bg-amber-100/60 rounded-lg px-3 py-2">
              <Icon className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-xs text-amber-900">{text}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-3xl font-extrabold text-foreground">$100</span>
            <p className="text-xs text-muted-foreground mt-0.5">One-time · Priority review + PDF</p>
          </div>
          <Button
            onClick={() => payForReviewMutation.mutate({ letterId })}
            disabled={isPaidPending || freeUnlockMutation.isPending}
            size="lg"
            variant="outline"
            className="border-amber-400 text-amber-800 hover:bg-amber-100 font-bold w-full sm:w-auto"
          >
            {isPaidPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing checkout...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Gavel className="w-4 h-4" />
                Upgrade — Priority Review ($100)
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
