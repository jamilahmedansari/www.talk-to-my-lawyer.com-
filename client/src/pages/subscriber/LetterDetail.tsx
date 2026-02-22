import AppLayout from "@/components/shared/AppLayout";
import StatusBadge from "@/components/shared/StatusBadge";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Clock, MessageSquare, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { Link, useParams } from "wouter";
import { LETTER_TYPE_CONFIG } from "../../../../shared/types";

export default function LetterDetail() {
  const params = useParams<{ id: string }>();
  const letterId = parseInt(params.id ?? "0");

  const { data, isLoading, error } = trpc.letters.detail.useQuery({ id: letterId }, { enabled: !!letterId });

  const handleDownload = () => {
    if (!data?.versions) return;
    const finalVersion = data.versions.find((v) => v.versionType === "final_approved");
    if (!finalVersion) return;
    const blob = new Blob([finalVersion.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `letter-${letterId}-approved.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <AppLayout breadcrumb={[{ label: "My Letters", href: "/letters" }, { label: "Loading..." }]}>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout breadcrumb={[{ label: "My Letters", href: "/letters" }, { label: "Not Found" }]}>
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-destructive/40 mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Letter not found</h3>
          <Button asChild variant="outline" size="sm" className="bg-background">
            <Link href="/letters"><ArrowLeft className="w-4 h-4 mr-2" />Back to Letters</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { letter, actions, versions, attachments } = data;
  const finalVersion = versions?.find((v) => v.versionType === "final_approved");
  const userVisibleActions = actions?.filter((a) => a.noteVisibility === "user_visible" && a.noteText);

  return (
    <AppLayout breadcrumb={[{ label: "My Letters", href: "/letters" }, { label: letter.subject }]}>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-primary" />
              </div>
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
            </div>
            {letter.status === "approved" && finalVersion && (
              <Button onClick={handleDownload} size="sm" className="flex-shrink-0">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </div>

        {/* Status Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Status Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-border" />
              <div className="space-y-4">
                {[
                  { status: "submitted", label: "Submitted", done: true },
                  { status: "researching", label: "Legal Research", done: ["researching", "drafting", "pending_review", "under_review", "approved", "rejected", "needs_changes"].includes(letter.status) },
                  { status: "drafting", label: "AI Drafting", done: ["drafting", "pending_review", "under_review", "approved", "rejected", "needs_changes"].includes(letter.status) },
                  { status: "pending_review", label: "Attorney Review Queue", done: ["pending_review", "under_review", "approved", "rejected", "needs_changes"].includes(letter.status) },
                  { status: "under_review", label: "Under Attorney Review", done: ["under_review", "approved", "rejected", "needs_changes"].includes(letter.status) },
                  { status: letter.status === "rejected" ? "rejected" : "approved", label: letter.status === "rejected" ? "Rejected" : "Approved & Ready", done: ["approved", "rejected"].includes(letter.status) },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-4 relative pl-8">
                    <div className={`absolute left-0 w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                      step.done
                        ? "bg-primary border-primary"
                        : letter.status === step.status
                        ? "bg-amber-400 border-amber-400"
                        : "bg-background border-border"
                    }`}>
                      {step.done && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className={`text-sm ${step.done ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attorney Notes (user-visible only) */}
        {userVisibleActions && userVisibleActions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Attorney Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {userVisibleActions.map((action) => (
                <div key={action.id} className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-foreground">{action.noteText}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(action.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Final Approved Letter */}
        {letter.status === "approved" && finalVersion && (
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  Final Approved Letter
                </CardTitle>
                <Button onClick={handleDownload} size="sm" variant="outline" className="bg-background border-green-300 text-green-700 hover:bg-green-50">
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-white border border-green-200 rounded-lg p-5">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {finalVersion.content}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Needs Changes Notice */}
        {letter.status === "needs_changes" && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Changes Requested</p>
                  <p className="text-sm text-amber-700 mt-1">
                    The reviewing attorney has requested changes. Please review the attorney notes above. 
                    The AI pipeline will be re-triggered to incorporate the feedback.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Attachments ({attachments.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.storageUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground flex-1 truncate">{att.fileName ?? "Attachment"}</span>
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
