import AppLayout from "@/components/shared/AppLayout";
import StatusBadge from "@/components/shared/StatusBadge";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Clock, CheckCircle, ArrowRight, FileText, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { LETTER_TYPE_CONFIG } from "../../../../shared/types";

export default function EmployeeDashboard() {
  const { data: pendingLetters } = trpc.review.queue.useQuery({ status: "pending_review" }, {
    refetchInterval: 15000, // Poll every 15s for new pending letters
  });
  const { data: myLetters } = trpc.review.queue.useQuery({ myAssigned: true }, {
    refetchInterval: 15000,
  });
  const { data: allLetters } = trpc.review.queue.useQuery({});

  const stats = {
    pending: pendingLetters?.length ?? 0,
    myActive: myLetters?.filter((l) => l.status === "under_review").length ?? 0,
    totalReviewed: allLetters?.filter((l) => ["approved", "rejected"].includes(l.status)).length ?? 0,
  };

  return (
    <AppLayout breadcrumb={[{ label: "Review Center" }]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-6 text-white">
          <h1 className="text-xl font-bold mb-1">Attorney Review Center</h1>
          <p className="text-blue-100 text-sm mb-4">
            Review AI-drafted letters, edit as needed, and approve or request changes.
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link href="/review/queue">
              <ClipboardList className="w-4 h-4 mr-2" />
              View Full Queue
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending Review", value: stats.pending, icon: <Clock className="w-5 h-5" />, color: "text-amber-600", bg: "bg-amber-50", urgent: stats.pending > 5 },
            { label: "My Active", value: stats.myActive, icon: <FileText className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50", urgent: false },
            { label: "Total Reviewed", value: stats.totalReviewed, icon: <CheckCircle className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50", urgent: false },
          ].map((stat) => (
            <Card key={stat.label} className={stat.urgent ? "border-amber-300" : ""}>
              <CardContent className="p-4">
                <div className={`w-9 h-9 ${stat.bg} rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
                  {stat.icon}
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending Review Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Needs Review ({stats.pending})
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/review/queue">View All <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {!pendingLetters || pendingLetters.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No letters pending review. Great work!</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pendingLetters.slice(0, 5).map((letter) => (
                  <Link key={letter.id} href={`/review/${letter.id}`}>
                    <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{letter.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {LETTER_TYPE_CONFIG[letter.letterType]?.label ?? letter.letterType}
                          {letter.jurisdictionState && ` · ${letter.jurisdictionState}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={letter.status} size="sm" />
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Assigned Letters */}
        {myLetters && myLetters.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">My Assigned Letters</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {myLetters.map((letter) => (
                  <Link key={letter.id} href={`/review/${letter.id}`}>
                    <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{letter.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {LETTER_TYPE_CONFIG[letter.letterType]?.label ?? letter.letterType}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={letter.status} size="sm" />
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
