import AppLayout from "@/components/shared/AppLayout";
import StatusBadge from "@/components/shared/StatusBadge";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  Edit3,
  FileText,
  BookOpen,
  History,
  AlertCircle,
  Loader2,
  Save,
  ClipboardList,
} from "lucide-react";
import { useParams } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { LETTER_TYPE_CONFIG } from "../../../../shared/types";

export default function ReviewDetail() {
  const params = useParams<{ id: string }>();
  const letterId = parseInt(params.id ?? "0");
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.review.letterDetail.useQuery(
    { id: letterId },
    {
      enabled: !!letterId,
      // Poll every 8s while letter is in active review statuses
      refetchInterval: (query) => {
        const status = query.state.data?.letter?.status;
        if (status && ["pending_review", "under_review", "researching", "drafting"].includes(status)) return 8000;
        return false;
      },
    }
  );

  const [editContent, setEditContent] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [changesDialog, setChangesDialog] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [changesNote, setChangesNote] = useState("");
  const [retrigger, setRetrigger] = useState(false);

  const invalidate = () => utils.review.letterDetail.invalidate({ id: letterId });

  const claimMutation = trpc.review.claim.useMutation({
    onSuccess: () => { toast.success("Letter claimed for review"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const saveMutation = trpc.review.saveEdit.useMutation({
    onSuccess: () => { toast.success("Draft saved"); setEditMode(false); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const approveMutation = trpc.review.approve.useMutation({
    onSuccess: () => { toast.success("Letter approved!"); setApproveDialog(false); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.review.reject.useMutation({
    onSuccess: () => { toast.success("Letter rejected"); setRejectDialog(false); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const changesMutation = trpc.review.requestChanges.useMutation({
    onSuccess: () => { toast.success("Changes requested"); setChangesDialog(false); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppLayout breadcrumb={[{ label: "Review Center", href: "/review" }, { label: "Loading..." }]}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout breadcrumb={[{ label: "Review Center", href: "/review" }, { label: "Error" }]}>
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-destructive/40 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Letter not found or access denied.</p>
        </div>
      </AppLayout>
    );
  }

  const { letter, versions, actions, jobs, research, attachments } = data;
  const latestDraft = versions?.find((v) => v.versionType === "ai_draft") ?? versions?.find((v) => v.versionType === "attorney_edit");
  const currentContent = editMode ? editContent : (latestDraft?.content ?? "No draft available yet.");
  const canReview = ["pending_review", "under_review"].includes(letter.status);
  const isUnderReview = letter.status === "under_review";

  const startEdit = () => {
    setEditContent(latestDraft?.content ?? "");
    setEditMode(true);
  };

  return (
    <AppLayout breadcrumb={[{ label: "Review Center", href: "/review" }, { label: "Queue", href: "/review/queue" }, { label: letter.subject }]}>
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">{letter.subject}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {LETTER_TYPE_CONFIG[letter.letterType]?.label ?? letter.letterType}
                {letter.jurisdictionState && ` · ${letter.jurisdictionState}`}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge status={letter.status} />
                <span className="text-xs text-muted-foreground">
                  Submitted {new Date(letter.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {letter.status === "pending_review" && (
                <Button
                  onClick={() => claimMutation.mutate({ letterId })}
                  disabled={claimMutation.isPending}
                  size="sm"
                >
                  <ClipboardList className="w-4 h-4 mr-1.5" />
                  {claimMutation.isPending ? "Claiming..." : "Claim for Review"}
                </Button>
              )}
              {isUnderReview && (
                <>
                  {!editMode ? (
                    <Button variant="outline" size="sm" onClick={startEdit} className="bg-background">
                      <Edit3 className="w-4 h-4 mr-1.5" />
                      Edit Draft
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveMutation.mutate({ letterId, content: editContent })}
                      disabled={saveMutation.isPending || editContent.length < 50}
                      className="bg-background"
                    >
                      <Save className="w-4 h-4 mr-1.5" />
                      {saveMutation.isPending ? "Saving..." : "Save Edit"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChangesDialog(true)}
                    className="bg-background border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    <MessageSquare className="w-4 h-4 mr-1.5" />
                    Request Changes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRejectDialog(true)}
                    className="bg-background border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setApproveNote(currentContent); setApproveDialog(true); }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="draft">
          <TabsList className="w-full">
            <TabsTrigger value="draft" className="flex-1">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              AI Draft
            </TabsTrigger>
            <TabsTrigger value="research" className="flex-1">
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              Research
            </TabsTrigger>
            <TabsTrigger value="intake" className="flex-1">
              <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
              Intake
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <History className="w-3.5 h-3.5 mr-1.5" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Draft Tab */}
          <TabsContent value="draft" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {editMode ? "Editing Draft" : "AI Draft"}
                  </CardTitle>
                  {latestDraft && (
                    <span className="text-xs text-muted-foreground">
                      v{versions?.indexOf(latestDraft)! + 1} · {new Date(latestDraft.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[500px] font-mono text-sm resize-none"
                    placeholder="Edit the letter content..."
                  />
                ) : (
                  <div className="bg-muted/30 rounded-lg p-5">
                    <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                      {currentContent}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Research Tab */}
          <TabsContent value="research" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Legal Research Packet</CardTitle>
              </CardHeader>
              <CardContent>
                {!research || research.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Research data not yet available.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {research.map((run) => {
                      const packet = (run.resultJson ?? run.validationResultJson) as any;
                      return (
                        <div key={run.id} className="space-y-3">
                          {packet?.researchSummary && (
                            <div className="bg-blue-50 rounded-lg p-4">
                              <h4 className="text-xs font-semibold text-blue-800 mb-2">Research Summary</h4>
                              <p className="text-sm text-blue-900">{packet.researchSummary}</p>
                            </div>
                          )}
                          {packet?.applicableRules && packet.applicableRules.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-foreground mb-2">Applicable Laws & Rules</h4>
                              <div className="space-y-2">
                                {packet.applicableRules.slice(0, 5).map((rule: any, i: number) => (
                                  <div key={i} className="bg-muted/50 rounded-lg p-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-medium text-foreground">{rule.ruleTitle}</p>
                                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                                        rule.confidence === "high" ? "bg-green-100 text-green-700" :
                                        rule.confidence === "medium" ? "bg-amber-100 text-amber-700" :
                                        "bg-gray-100 text-gray-600"
                                      }`}>{rule.confidence}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{rule.summary}</p>
                                    {rule.citationText && (
                                      <p className="text-xs text-primary mt-1 font-mono">{rule.citationText}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {packet?.riskFlags && packet.riskFlags.length > 0 && (
                            <div className="bg-red-50 rounded-lg p-3">
                              <h4 className="text-xs font-semibold text-red-800 mb-2">Risk Flags</h4>
                              <ul className="space-y-1">
                                {packet.riskFlags.map((flag: string, i: number) => (
                                  <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                    {flag}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {packet?.openQuestions && packet.openQuestions.length > 0 && (
                            <div className="bg-amber-50 rounded-lg p-3">
                              <h4 className="text-xs font-semibold text-amber-800 mb-2">Open Questions</h4>
                              <ul className="space-y-1">
                                {packet.openQuestions.map((q: string, i: number) => (
                                  <li key={i} className="text-xs text-amber-700">• {q}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Intake Tab */}
          <TabsContent value="intake" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Subscriber Intake Data</CardTitle>
              </CardHeader>
              <CardContent>
                {letter.intakeJson ? (
                  <div className="space-y-4">
                    {(() => {
                      const intake = letter.intakeJson as any;
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground mb-1">Sender</p>
                              <p className="text-sm font-medium">{intake.sender?.name}</p>
                              <p className="text-xs text-muted-foreground">{intake.sender?.address}</p>
                              {intake.sender?.email && <p className="text-xs text-muted-foreground">{intake.sender.email}</p>}
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground mb-1">Recipient</p>
                              <p className="text-sm font-medium">{intake.recipient?.name}</p>
                              <p className="text-xs text-muted-foreground">{intake.recipient?.address}</p>
                            </div>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Description</p>
                            <p className="text-sm text-foreground">{intake.matter?.description}</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Desired Outcome</p>
                            <p className="text-sm text-foreground">{intake.desiredOutcome}</p>
                          </div>
                          {intake.financials?.amountOwed && (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground mb-1">Amount Owed</p>
                              <p className="text-sm font-semibold text-foreground">
                                ${intake.financials.amountOwed.toLocaleString()} {intake.financials.currency ?? "USD"}
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No intake data available.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Audit Trail</CardTitle>
              </CardHeader>
              <CardContent>
                {!actions || actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {actions.map((action) => (
                      <div key={action.id} className="flex gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground capitalize">
                              {action.action.replace(/_/g, " ")}
                            </span>
                            {action.noteVisibility === "internal" && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">internal</span>
                            )}
                          </div>
                          {action.noteText && (
                            <p className="text-xs text-muted-foreground mt-0.5">{action.noteText}</p>
                          )}
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {new Date(action.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              Approve Letter
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Final Letter Content *</Label>
              <Textarea
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                className="min-h-[300px] font-mono text-sm resize-none"
                placeholder="Final letter content..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)} className="bg-background">Cancel</Button>
            <Button
              onClick={() => approveMutation.mutate({ letterId, finalContent: approveNote })}
              disabled={approveMutation.isPending || approveNote.length < 50}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              Reject Letter
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Reason for Rejection *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this letter is being rejected..."
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)} className="bg-background">Cancel</Button>
            <Button
              onClick={() => rejectMutation.mutate({ letterId, reason: rejectReason })}
              disabled={rejectMutation.isPending || rejectReason.length < 10}
              variant="destructive"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Changes Dialog */}
      <Dialog open={changesDialog} onOpenChange={setChangesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <MessageSquare className="w-5 h-5" />
              Request Changes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Note to Subscriber *</Label>
              <Textarea
                value={changesNote}
                onChange={(e) => setChangesNote(e.target.value)}
                placeholder="Explain what changes are needed..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="retrigger"
                checked={retrigger}
                onChange={(e) => setRetrigger(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="retrigger" className="text-sm text-foreground">
                Re-trigger AI pipeline to regenerate draft
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesDialog(false)} className="bg-background">Cancel</Button>
            <Button
              onClick={() => changesMutation.mutate({ letterId, userVisibleNote: changesNote, retriggerPipeline: retrigger })}
              disabled={changesMutation.isPending || changesNote.length < 10}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {changesMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
