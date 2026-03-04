import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowLeft, RefreshCw, Shield } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTimeline from "@/components/shared/StatusTimeline";

const ALL_STATUSES = [
  "submitted",
  "researching",
  "drafting",
  "generated_locked",
  "generated_unlocked",
  "pending_review",
  "under_review",
  "approved",
  "rejected",
  "needs_changes",
] as const;

export default function AdminLetterDetail() {
  const { id } = useParams<{ id: string }>();
  const letterId = parseInt(id ?? "0");
  const { user } = useAuth();
  const [forceStatus, setForceStatus] = useState<string>("");
  const [forceNote, setForceNote] = useState("");
  const [showForceForm, setShowForceForm] = useState(false);

  const { data: letter, refetch } = trpc.admin.getLetterDetail.useQuery(
    { letterId },
    { enabled: !!letterId, refetchInterval: 8000 }
  );

  const forceStatusMutation = trpc.admin.forceStatusTransition.useMutation({
    onSuccess: () => {
      toast.success("Status updated", { description: "The letter status has been changed." });
      setShowForceForm(false);
      setForceStatus("");
      setForceNote("");
      refetch();
    },
    onError: (err) => toast.error("Status update failed", { description: err.message }),
  });

  const [retryStage, setRetryStage] = useState<"research" | "drafting">("research");
  const retryMutation = trpc.admin.retryJob.useMutation({
    onSuccess: () => {
      toast.success("Pipeline retry triggered", { description: "The letter is being re-processed through the AI pipeline." });
      refetch();
    },
    onError: (err) => toast.error("Retry failed", { description: err.message }),
  });
  const triggerPipelineMutation = trpc.admin.triggerPipeline.useMutation({
    onSuccess: () => {
      toast.success("Full pipeline triggered", { description: "The letter is now being processed from scratch through the AI pipeline." });
      refetch();
    },
    onError: (err) => toast.error("Trigger failed", { description: err.message }),
  });

  if (!letter) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading letter details...
      </div>
    );
  }

  // Cast to any to handle Drizzle's unknown return type for enum columns
  const l = letter as any;
  const letterStatus = (l.status ?? "submitted") as string;

  const handleForceStatus = () => {
    if (!forceStatus) { toast.error("Missing status", { description: "Please select a target status before proceeding." }); return; }
    if (!forceNote.trim()) { toast.error("Reason required", { description: "Please provide a reason for the force transition." }); return; }
    forceStatusMutation.mutate({ letterId, newStatus: forceStatus as any, reason: forceNote });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/letters">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to All Letters
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{l.subject}</h1>
            <StatusBadge status={letterStatus} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Letter #{l.id} · {l.letterType} · Submitted {new Date(l.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Timeline */}
      <StatusTimeline currentStatus={letterStatus} />

      {/* Admin Controls */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Shield className="h-5 w-5" />
            Admin Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="border-amber-400 text-amber-700"
              onClick={() => setShowForceForm(!showForceForm)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Force Status Transition
            </Button>
            {(letter.status === "submitted") && (
              <Button
                variant="outline"
                size="sm"
                className="border-green-500 text-green-700"
                onClick={() => triggerPipelineMutation.mutate({ letterId })}
                disabled={triggerPipelineMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${triggerPipelineMutation.isPending ? "animate-spin" : ""}`} />
                Trigger Full Pipeline
              </Button>
            )}
            {(letter.status === "researching" || letter.status === "drafting") && (
              <Button
                variant="outline"
                size="sm"
                className="border-blue-400 text-blue-700"
                onClick={() => retryMutation.mutate({ letterId, stage: retryStage })}
                disabled={retryMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${retryMutation.isPending ? "animate-spin" : ""}`} />
                Retry Pipeline
              </Button>
            )}
          </div>

          {showForceForm && (
            <div className="space-y-3 pt-2 border-t border-amber-200">
              <p className="text-sm text-amber-700 font-medium">
                ⚠️ Force transition bypasses normal workflow. Use only for admin corrections.
              </p>
              <div className="flex gap-3">
                <Select value={forceStatus} onValueChange={setForceStatus}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select target status" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.filter(s => s !== letter.status).map(s => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Reason for force transition (required for audit trail)"
                value={forceNote}
                onChange={e => setForceNote(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleForceStatus}
                  disabled={forceStatusMutation.isPending}
                >
                  {forceStatusMutation.isPending ? "Applying..." : "Apply Force Transition"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowForceForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Letter Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letter Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{l.letterType}</span>
              <span className="text-muted-foreground">Jurisdiction</span>
              <span className="font-medium">{l.jurisdictionState || "—"}, {l.jurisdictionCountry || "US"}</span>
              <span className="text-muted-foreground">Subscriber</span>
              <span className="font-medium">User #{l.userId}</span>
              <span className="text-muted-foreground">Reviewer</span>
              <span className="font-medium">{l.assignedReviewerId ? `Employee #${l.assignedReviewerId}` : "Unassigned"}</span>
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{new Date(l.createdAt).toLocaleString()}</span>
              <span className="text-muted-foreground">Updated</span>
              <span className="font-medium">{new Date(l.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {l.workflowJobs && l.workflowJobs.length > 0 ? (
              <div className="space-y-2">
                {l.workflowJobs.map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between text-sm p-2 rounded border">
                    <div>
                      <span className="font-medium">{job.jobType}</span>
                      <span className="text-muted-foreground ml-2">({job.provider})</span>
                    </div>
                    <Badge variant={
                      job.status === "completed" ? "default" :
                      job.status === "failed" ? "destructive" :
                      job.status === "running" ? "secondary" : "outline"
                    }>
                      {job.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pipeline jobs yet</p>
            )}
          {/* end jobs */}
          </CardContent>
        </Card>
      </div>

      {/* Intake Data */}
      {l.intakeJson && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intake Data (Raw)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-64">
              {JSON.stringify(l.intakeJson, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* AI Draft */}
      {l.aiDraftContent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Draft (Internal)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap">
              {l.aiDraftContent}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail */}
      {l.reviewActions && l.reviewActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Full Audit Trail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {l.reviewActions.map((action: any) => (
                <div key={action.id} className="flex gap-3 text-sm p-2 rounded border">
                  <div className="text-muted-foreground text-xs w-32 shrink-0">
                    {new Date(action.createdAt).toLocaleString()}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium">{action.action}</span>
                    {action.fromStatus && action.toStatus && (
                      <span className="text-muted-foreground ml-2">
                        {action.fromStatus} → {action.toStatus}
                      </span>
                    )}
                    {action.noteText && (
                      <p className="text-muted-foreground mt-1">{action.noteText}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {action.actorType}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
