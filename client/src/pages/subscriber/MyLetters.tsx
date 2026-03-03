import AppLayout from "@/components/shared/AppLayout";
import StatusBadge from "@/components/shared/StatusBadge";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, PlusCircle, Search, ArrowRight, Lock, CheckCircle, Download, FileCheck } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { LETTER_TYPE_CONFIG } from "../../../../shared/types";

// Statuses where the list should auto-refresh (pipeline in progress)
const ACTIVE_STATUSES = ["submitted", "researching", "drafting"];

export default function MyLetters() {
  const { data: letters, isLoading } = trpc.letters.myLetters.useQuery(undefined, {
    // Poll every 8s if any letter is in an active pipeline status
    refetchInterval: (query) => {
      const list = query.state.data;
      if (list?.some((l: any) => ACTIVE_STATUSES.includes(l.status))) return 8000;
      return false;
    },
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = (letters ?? []).filter((l) => {
    const matchSearch = l.subject.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const approvedCount = (letters ?? []).filter((l) => l.status === "approved").length;
  const pendingCount = (letters ?? []).filter((l) =>
    ["pending_review", "under_review"].includes(l.status)
  ).length;

  return (
    <AppLayout breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "My Letters" }]}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">My Letters</h1>
            <p className="text-sm text-muted-foreground">
              {letters?.length ?? 0} total
              {approvedCount > 0 && (
                <span className="ml-2 text-green-600 font-medium">· {approvedCount} approved</span>
              )}
              {pendingCount > 0 && (
                <span className="ml-2 text-blue-600 font-medium">· {pendingCount} in review</span>
              )}
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/submit">
              <PlusCircle className="w-4 h-4 mr-2" />
              New Letter
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search letters..."
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="researching">Researching</SelectItem>
              <SelectItem value="drafting">Drafting</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="needs_changes">Needs Changes</SelectItem>
              <SelectItem value="generated_locked">Ready to Unlock</SelectItem>
              <SelectItem value="generated_unlocked">Draft Ready (Free)</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Letter List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-2">
              {search || statusFilter !== "all" ? "No letters match your filters" : "No letters yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filter."
                : "Submit your first legal matter to get started."}
            </p>
            {!search && statusFilter === "all" && (
              <Button asChild size="sm">
                <Link href="/submit">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Submit Letter
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((letter) => {
              const hasPdf = letter.status === "approved" && !!(letter as any).pdfStoragePath;
              const isApproved = letter.status === "approved";

              return (
                <Link key={letter.id} href={`/letters/${letter.id}`}>
                  <div
                    className={`bg-card border rounded-xl p-4 hover:shadow-sm transition-all cursor-pointer ${
                      isApproved
                        ? "border-green-300 hover:border-green-400 bg-green-50/20"
                        : letter.status === "generated_locked"
                        ? "border-amber-300 hover:border-amber-400 bg-amber-50/30"
                        : letter.status === "generated_unlocked"
                        ? "border-blue-300 hover:border-blue-400 bg-blue-50/20"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isApproved ? "bg-green-100" : "bg-primary/10"
                        }`}
                      >
                        {isApproved ? (
                          <FileCheck className="w-5 h-5 text-green-600" />
                        ) : (
                          <FileText className="w-5 h-5 text-primary" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground leading-tight truncate max-w-[200px] sm:max-w-none">
                            {letter.subject}
                          </p>
                          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        </div>

                        <p className="text-xs text-muted-foreground mt-0.5">
                          {LETTER_TYPE_CONFIG[letter.letterType]?.label ?? letter.letterType}
                          {letter.jurisdictionState && ` · ${letter.jurisdictionState}`}
                        </p>

                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <StatusBadge status={letter.status} size="sm" />

                          {/* PDF ready badge */}
                          {hasPdf && (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-700 border-green-300 bg-green-50 font-semibold gap-1 px-2 py-0.5"
                            >
                              <Download className="w-3 h-3" />
                              PDF Ready
                            </Badge>
                          )}

                          {/* Approved but no PDF yet */}
                          {isApproved && !hasPdf && (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-700 border-green-300 bg-green-50 font-semibold gap-1 px-2 py-0.5"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Approved
                            </Badge>
                          )}

                          {/* Unlock prompts */}
                          {letter.status === "generated_locked" && (
                            <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Unlock for Review
                            </span>
                          )}
                          {letter.status === "generated_unlocked" && (
                            <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Free — Send for Review
                            </span>
                          )}

                          <span className="text-xs text-muted-foreground">
                            {new Date(letter.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
