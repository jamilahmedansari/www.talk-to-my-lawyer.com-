import { CheckCircle2, Circle, Clock, AlertTriangle, XCircle, Loader2, Lock, Unlock } from "lucide-react";

const STATUS_STEPS = [
  { key: "submitted", label: "Submitted", icon: Circle },
  { key: "researching", label: "Researching", icon: Loader2 },
  { key: "drafting", label: "Drafting", icon: Loader2 },
  { key: "generated_locked", label: "Ready to Unlock", icon: Lock },
  { key: "generated_unlocked", label: "Draft Ready", icon: Unlock },
  { key: "pending_review", label: "Pending Review", icon: Clock },
  { key: "under_review", label: "Under Review", icon: Clock },
] as const;

const TERMINAL_STATUSES: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  approved: { label: "Approved", icon: CheckCircle2, color: "text-emerald-500" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-500" },
  needs_changes: { label: "Needs Changes", icon: AlertTriangle, color: "text-amber-500" },
};

interface StatusTimelineProps {
  currentStatus: string;
  className?: string;
}

export default function StatusTimeline({ currentStatus, className }: StatusTimelineProps) {
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === currentStatus);
  const isTerminal = currentStatus in TERMINAL_STATUSES;

  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <h4 className="text-sm font-semibold text-muted-foreground mb-3">Status Timeline</h4>
      <div className="relative">
        {STATUS_STEPS.map((step, idx) => {
          const isComplete = currentIdx > idx || isTerminal;
          const isCurrent = currentIdx === idx && !isTerminal;
          const isInProgress = isCurrent && (step.key === "researching" || step.key === "drafting");
          const isPaywall = isCurrent && step.key === "generated_locked";
          const isUnlocked = isCurrent && step.key === "generated_unlocked";

          // Skip generated_locked step if the letter went through generated_unlocked path (and vice versa)
          if (step.key === "generated_locked" && currentStatus === "generated_unlocked") return null;
          if (step.key === "generated_unlocked" && currentStatus === "generated_locked") return null;
          // For statuses past both, show whichever was used (hide the other)
          if (step.key === "generated_locked" && currentIdx > STATUS_STEPS.findIndex(s => s.key === "generated_unlocked")) return null;
          if (step.key === "generated_unlocked" && currentIdx > STATUS_STEPS.findIndex(s => s.key === "generated_locked") && currentStatus !== "generated_unlocked") return null;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-start gap-3 relative">
              {/* Vertical connector line */}
              {idx < STATUS_STEPS.length - 1 && (
                <div
                  className={`absolute left-[11px] top-[24px] w-0.5 h-6 ${
                    isComplete ? "bg-emerald-500" : "bg-border"
                  }`}
                />
              )}
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {isComplete ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : isCurrent ? (
                  isInProgress ? (
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  ) : isPaywall ? (
                    <Lock className="w-6 h-6 text-amber-500" />
                  ) : isUnlocked ? (
                    <Unlock className="w-6 h-6 text-green-500" />
                  ) : (
                    <Clock className="w-6 h-6 text-blue-500" />
                  )
                ) : (
                  <Circle className="w-6 h-6 text-muted-foreground/30" />
                )}
              </div>
              {/* Label */}
              <span
                className={`text-sm pb-4 ${
                  isComplete
                    ? "text-emerald-600 font-medium"
                    : isPaywall
                    ? "text-amber-600 font-semibold"
                    : isCurrent
                    ? "text-blue-600 font-semibold"
                    : "text-muted-foreground/50"
                }`}
              >
                {step.label}
                {isInProgress && <span className="ml-2 text-xs text-blue-400">(in progress...)</span>}
                {isPaywall && <span className="ml-2 text-xs text-amber-500">(payment required)</span>}
                {isUnlocked && <span className="ml-2 text-xs text-green-500">(free — ready to send for review)</span>}
              </span>
            </div>
          );
        })}

        {/* Terminal status */}
        {isTerminal && (
          <div className="flex items-start gap-3 relative">
            <div className="flex-shrink-0 mt-0.5">
              {(() => {
                const terminal = TERMINAL_STATUSES[currentStatus];
                if (!terminal) return null;
                const TIcon = terminal.icon;
                return <TIcon className={`w-6 h-6 ${terminal.color}`} />;
              })()}
            </div>
            <span className={`text-sm font-semibold ${TERMINAL_STATUSES[currentStatus]?.color ?? ""}`}>
              {TERMINAL_STATUSES[currentStatus]?.label ?? currentStatus}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
