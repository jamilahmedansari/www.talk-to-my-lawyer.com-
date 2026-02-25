import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import StatusBadge from "./StatusBadge";
import RichTextEditor, { plainTextToHtml, htmlToPlainText } from "./RichTextEditor";
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
  Eye,
  Gavel,
  Shield,
  X,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { LETTER_TYPE_CONFIG } from "../../../../shared/types";

interface ReviewModalProps {
  letterId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReviewModal({ letterId, open, onOpenChange }: ReviewModalProps) {
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.review.letterDetail.useQuery(
    { id: letterId },
    {
      enabled: open && !!letterId,
      refetchInterval: (query) => {
        const status = query.state.data?.letter?.status;
        if (status && ["pending_review", "under_review", "researching", "drafting"].includes(status)) return 8000;
        return false;
      },
    }
  );

  // Editor state
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Action dialog states
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | "changes" | null>(null);
  const [approveContent, setApproveContent] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [changesNote, setChangesNote] = useState("");
  const [retrigger, setRetrigger] = useState(false);

  const invalidate = useCallback(() => {
    utils.review.letterDetail.invalidate({ id: letterId });
    utils.review.queue.invalidate();
  }, [utils, letterId]);

  // Mutations
  const claimMutation = trpc.review.claim.useMutation({
    onSuccess: () => { toast.success("Letter claimed for review"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const saveMutation = trpc.review.saveEdit.useMutation({
    onSuccess: () => {
      toast.success("Draft saved successfully");
      setHasUnsavedChanges(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMutation = trpc.review.approve.useMutation({
    onSuccess: () => {
      toast.success("Letter approved and sent to subscriber!");
      setActiveAction(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.review.reject.useMutation({
    onSuccess: () => {
      toast.success("Letter rejected");
      setActiveAction(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const changesMutation = trpc.review.requestChanges.useMutation({
    onSuccess: () => {
      toast.success("Changes requested from subscriber");
      setActiveAction(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Initialize editor content when data loads
  useEffect(() => {
    if (data?.versions) {
      const latestDraft = data.versions.find((v) => v.versionType === "attorney_edit") ??
        data.versions.find((v) => v.versionType === "ai_draft");
      if (latestDraft?.content) {
        const html = plainTextToHtml(latestDraft.content);
        setEditContent(html);
        setApproveContent(latestDraft.content);
      }
    }
  }, [data?.versions]);

  if (!open) return null;

  const letter = data?.letter;
  const versions = data?.versions ?? [];
  const actions = data?.actions ?? [];
  const research = data?.research ?? [];
  const canReview = letter && ["pending_review", "under_review"].includes(letter.status);
  const isUnderReview = letter?.status === "under_review";
  const isPending = letter?.status === "pending_review";
  const isTerminal = letter && ["approved", "rejected"].includes(letter.status);

  const latestDraft = versions.find((v) => v.versionType === "attorney_edit") ??
    versions.find((v) => v.versionType === "ai_draft");

  const handleStartEdit = () => {
    const html = plainTextToHtml(latestDraft?.content ?? "");
    setEditContent(html);
    setIsEditing(true);
    setHasUnsavedChanges(false);
  };

  const handleEditorChange = (html: string) => {
    setEditContent(html);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    const plainText = htmlToPlainText(editContent);
    if (plainText.length < 50) {
      toast.error("Content must be at least 50 characters");
      return;
    }
    saveMutation.mutate({ letterId, content: editContent });
  };

  const handleApprove = () => {
    // Use the current editor content (or latest draft) as the final content
    const finalContent = isEditing ? editContent : (latestDraft?.content ?? "");
    const plainText = htmlToPlainText(finalContent);
    if (plainText.length < 50) {
      toast.error("Letter content must be at least 50 characters to approve");
      return;
    }
    setApproveContent(finalContent);
    setActiveAction("approve");
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Are you sure you want to close?")) return;
    }
    setIsEditing(false);
    setHasUnsavedChanges(false);
    setActiveAction(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[92vh] sm:max-h-[92vh] h-[100dvh] sm:h-auto p-0 gap-0 overflow-hidden rounded-none sm:rounded-lg">
        {/* ─── Modal Header ─── */}
        <div className="flex flex-col sm:flex-row items-start justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-card gap-2 sm:gap-0">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-5 w-64 bg-muted animate-pulse rounded" />
                <div className="h-4 w-40 bg-muted animate-pulse rounded" />
              </div>
            ) : letter ? (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-bold text-foreground truncate">{letter.subject}</h2>
                  <StatusBadge status={letter.status} />
                  {hasUnsavedChanges && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                      Unsaved changes
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {LETTER_TYPE_CONFIG[letter.letterType]?.label ?? letter.letterType}
                  {letter.jurisdictionState && ` · ${letter.jurisdictionState}`}
                  {" · "}Submitted {new Date(letter.createdAt).toLocaleDateString()}
                </p>
              </>
            ) : null}
          </div>

          {/* ─── Action Buttons (top-right) ─── */}
          <div className="flex items-center gap-2 ml-4 flex-shrink-0 overflow-x-auto">
            {isPending && (
              <Button
                onClick={() => claimMutation.mutate({ letterId })}
                disabled={claimMutation.isPending}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ClipboardList className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{claimMutation.isPending ? "Claiming..." : "Claim for Review"}</span>
                <span className="sm:hidden">{claimMutation.isPending ? "..." : "Claim"}</span>
              </Button>
            )}
            {isUnderReview && (
              <>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={handleStartEdit} className="bg-background">
                    <Edit3 className="w-4 h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Edit Draft</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={saveMutation.isPending || !hasUnsavedChanges}
                    className="bg-background"
                  >
                    <Save className="w-4 h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">{saveMutation.isPending ? "Saving..." : "Save"}</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveAction("changes")}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <MessageSquare className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Changes</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveAction("reject")}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Reject</span>
                </Button>
                {/* ─── PROMINENT APPROVE BUTTON ─── */}
                <Button
                  size="sm"
                  onClick={handleApprove}
                  className="bg-green-600 hover:bg-green-700 text-white px-5 shadow-md shadow-green-200 font-semibold"
                >
                  <CheckCircle className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Approve</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ─── Modal Body ─── */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row" style={{ height: "calc(92vh - 140px)" }}>
          {/* Left: Editor / Draft */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
            <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {isEditing ? "Editing Draft" : "AI Draft"}
                </span>
                {latestDraft && (
                  <span className="text-xs text-muted-foreground">
                    v{versions.indexOf(latestDraft) + 1}
                  </span>
                )}
              </div>
              {isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setIsEditing(false); setHasUnsavedChanges(false); }}
                  className="text-xs h-7"
                >
                  Cancel Edit
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : isEditing ? (
                <RichTextEditor
                  content={editContent}
                  onChange={handleEditorChange}
                  editable={true}
                  placeholder="Edit the letter content..."
                  minHeight="500px"
                  className="border-0 rounded-none"
                />
              ) : (
                <div className="p-5">
                  {latestDraft?.content ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: plainTextToHtml(latestDraft.content),
                      }}
                    />
                  ) : (
                    <div className="text-center py-16">
                      <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No draft available yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Side Panel (Tabs) — collapsible accordion on mobile */}
          <div className="w-full lg:w-[380px] flex flex-col overflow-hidden bg-card border-t lg:border-t-0 max-h-[40vh] lg:max-h-none">
            <Tabs defaultValue="intake" className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="w-full rounded-none border-b border-border bg-muted/30 h-auto p-0">
                <TabsTrigger value="intake" className="flex-1 rounded-none py-2.5 text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <ClipboardList className="w-3.5 h-3.5 mr-1" />
                  Intake
                </TabsTrigger>
                <TabsTrigger value="research" className="flex-1 rounded-none py-2.5 text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <BookOpen className="w-3.5 h-3.5 mr-1" />
                  Research
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 rounded-none py-2.5 text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <History className="w-3.5 h-3.5 mr-1" />
                  History
                </TabsTrigger>
              </TabsList>

              {/* Intake Tab */}
              <TabsContent value="intake" className="flex-1 overflow-y-auto m-0 p-4">
                {letter?.intakeJson ? (
                  <div className="space-y-3">
                    {(() => {
                      const intake = letter.intakeJson as any;
                      return (
                        <>
                          <div className="space-y-2">
                            <SideLabel label="Sender" />
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-sm font-medium">{intake.sender?.name}</p>
                              <p className="text-xs text-muted-foreground">{intake.sender?.address}</p>
                              {intake.sender?.email && <p className="text-xs text-muted-foreground">{intake.sender.email}</p>}
                              {intake.sender?.phone && <p className="text-xs text-muted-foreground">{intake.sender.phone}</p>}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <SideLabel label="Recipient" />
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-sm font-medium">{intake.recipient?.name}</p>
                              <p className="text-xs text-muted-foreground">{intake.recipient?.address}</p>
                              {intake.recipient?.email && <p className="text-xs text-muted-foreground">{intake.recipient.email}</p>}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <SideLabel label="Jurisdiction" />
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-sm">
                                {intake.jurisdiction?.state && `${intake.jurisdiction.state}, `}
                                {intake.jurisdiction?.country ?? "US"}
                              </p>
                              {intake.jurisdiction?.city && (
                                <p className="text-xs text-muted-foreground">{intake.jurisdiction.city}</p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <SideLabel label="Matter Description" />
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-sm text-foreground leading-relaxed">{intake.matter?.description}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <SideLabel label="Desired Outcome" />
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-sm text-foreground">{intake.desiredOutcome}</p>
                            </div>
                          </div>
                          {intake.financials?.amountOwed && (
                            <div className="space-y-2">
                              <SideLabel label="Amount Owed" />
                              <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-sm font-semibold">
                                  ${intake.financials.amountOwed.toLocaleString()} {intake.financials.currency ?? "USD"}
                                </p>
                              </div>
                            </div>
                          )}
                          {intake.tonePreference && (
                            <div className="space-y-2">
                              <SideLabel label="Tone" />
                              <Badge variant="outline" className="capitalize">{intake.tonePreference}</Badge>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No intake data available.</p>
                )}
              </TabsContent>

              {/* Research Tab */}
              <TabsContent value="research" className="flex-1 overflow-y-auto m-0 p-4">
                {research.length === 0 ? (
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
                            <div className="bg-blue-50 rounded-lg p-3">
                              <h4 className="text-xs font-semibold text-blue-800 mb-1.5">Research Summary</h4>
                              <p className="text-xs text-blue-900 leading-relaxed">{packet.researchSummary}</p>
                            </div>
                          )}
                          {packet?.applicableRules?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-foreground mb-2">Applicable Laws</h4>
                              <div className="space-y-2">
                                {packet.applicableRules.slice(0, 5).map((rule: any, i: number) => (
                                  <div key={i} className="bg-muted/50 rounded-lg p-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-medium text-foreground">{rule.ruleTitle}</p>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                                        rule.confidence === "high" ? "bg-green-100 text-green-700" :
                                        rule.confidence === "medium" ? "bg-amber-100 text-amber-700" :
                                        "bg-gray-100 text-gray-600"
                                      }`}>{rule.confidence}</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1">{rule.summary}</p>
                                    {rule.citationText && (
                                      <p className="text-[10px] text-primary mt-1 font-mono">{rule.citationText}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {packet?.riskFlags?.length > 0 && (
                            <div className="bg-red-50 rounded-lg p-2.5">
                              <h4 className="text-xs font-semibold text-red-800 mb-1.5">Risk Flags</h4>
                              <ul className="space-y-1">
                                {packet.riskFlags.map((flag: string, i: number) => (
                                  <li key={i} className="text-[11px] text-red-700 flex items-start gap-1.5">
                                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                    {flag}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {packet?.openQuestions?.length > 0 && (
                            <div className="bg-amber-50 rounded-lg p-2.5">
                              <h4 className="text-xs font-semibold text-amber-800 mb-1.5">Open Questions</h4>
                              <ul className="space-y-1">
                                {packet.openQuestions.map((q: string, i: number) => (
                                  <li key={i} className="text-[11px] text-amber-700">• {q}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="flex-1 overflow-y-auto m-0 p-4">
                {actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No actions recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {actions.map((action) => (
                      <div key={action.id} className="flex gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground capitalize">
                              {action.action.replace(/_/g, " ")}
                            </span>
                            {action.noteVisibility === "internal" && (
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">internal</span>
                            )}
                          </div>
                          {action.noteText && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{action.noteText}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {new Date(action.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* ─── Approve Confirmation Dialog ─── */}
        {activeAction === "approve" && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Approve Letter</h3>
                  <p className="text-xs text-muted-foreground">This will finalize the letter and notify the subscriber.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Final Letter Preview</Label>
                  <div className="bg-muted/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div
                      className="prose prose-sm max-w-none text-xs"
                      dangerouslySetInnerHTML={{ __html: plainTextToHtml(approveContent) }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {htmlToPlainText(approveContent).length} characters
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="outline" onClick={() => setActiveAction(null)} className="bg-background">
                  Cancel
                </Button>
                <Button
                  onClick={() => approveMutation.mutate({ letterId, finalContent: approveContent })}
                  disabled={approveMutation.isPending || htmlToPlainText(approveContent).length < 50}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 font-semibold"
                >
                  {approveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <Gavel className="w-4 h-4 mr-1.5" />
                      Confirm Approval
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Reject Confirmation Dialog ─── */}
        {activeAction === "reject" && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Reject Letter</h3>
                  <p className="text-xs text-muted-foreground">The subscriber will be notified of the rejection.</p>
                </div>
              </div>
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
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="outline" onClick={() => setActiveAction(null)} className="bg-background">
                  Cancel
                </Button>
                <Button
                  onClick={() => rejectMutation.mutate({ letterId, reason: rejectReason })}
                  disabled={rejectMutation.isPending || rejectReason.length < 10}
                  variant="destructive"
                >
                  {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Request Changes Dialog ─── */}
        {activeAction === "changes" && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Request Changes</h3>
                  <p className="text-xs text-muted-foreground">Ask the subscriber for additional information.</p>
                </div>
              </div>
              <div className="space-y-3">
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
                    id="retrigger-modal"
                    checked={retrigger}
                    onChange={(e) => setRetrigger(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="retrigger-modal" className="text-sm text-foreground">
                    Re-trigger AI pipeline to regenerate draft
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="outline" onClick={() => setActiveAction(null)} className="bg-background">
                  Cancel
                </Button>
                <Button
                  onClick={() => changesMutation.mutate({ letterId, userVisibleNote: changesNote, retriggerPipeline: retrigger })}
                  disabled={changesMutation.isPending || changesNote.length < 10}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {changesMutation.isPending ? "Sending..." : "Send Request"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SideLabel({ label }: { label: string }) {
  return <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>;
}
