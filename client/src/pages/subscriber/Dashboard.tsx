import AppLayout from "@/components/shared/AppLayout";
import StatusBadge from "@/components/shared/StatusBadge";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, PlusCircle, Clock, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { LETTER_TYPE_CONFIG } from "../../../../shared/types";

export default function SubscriberDashboard() {
  const { data: letters, isLoading } = trpc.letters.myLetters.useQuery();

  const stats = {
    total: letters?.length ?? 0,
    active: letters?.filter((l) => !["approved", "rejected"].includes(l.status)).length ?? 0,
    approved: letters?.filter((l) => l.status === "approved").length ?? 0,
    needsAttention: letters?.filter((l) => l.status === "needs_changes").length ?? 0,
  };

  const recentLetters = letters?.slice(0, 5) ?? [];

  return (
    <AppLayout
      breadcrumb={[{ label: "Dashboard" }]}
    >
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
          <h1 className="text-xl font-bold mb-1">Welcome to Talk to My Lawyer</h1>
          <p className="text-primary-foreground/80 text-sm mb-4">
            Submit a legal matter and get a professionally drafted, attorney-approved letter.
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link href="/submit">
              <PlusCircle className="w-4 h-4 mr-2" />
              Submit New Letter
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Letters", value: stats.total, icon: <FileText className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "In Progress", value: stats.active, icon: <Clock className="w-5 h-5" />, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Approved", value: stats.approved, icon: <CheckCircle className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50" },
            { label: "Needs Attention", value: stats.needsAttention, icon: <AlertCircle className="w-5 h-5" />, color: "text-red-600", bg: "bg-red-50" },
          ].map((stat) => (
            <Card key={stat.label}>
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

        {/* Recent Letters */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Letters</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/letters">View All <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : recentLetters.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">No letters yet. Submit your first legal matter.</p>
                <Button asChild size="sm">
                  <Link href="/submit"><PlusCircle className="w-4 h-4 mr-2" />Submit Letter</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentLetters.map((letter) => (
                  <Link key={letter.id} href={`/letters/${letter.id}`}>
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
            )}
          </CardContent>
        </Card>

        {/* Status Guide */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Letter Status Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { status: "submitted", desc: "Your request has been received and queued for processing." },
                { status: "researching", desc: "AI is researching applicable laws and statutes." },
                { status: "drafting", desc: "AI is drafting your professional letter." },
                { status: "pending_review", desc: "Letter is queued for attorney review." },
                { status: "under_review", desc: "An attorney is actively reviewing your letter." },
                { status: "approved", desc: "Your letter has been approved and is ready to download." },
              ].map((item) => (
                <div key={item.status} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <StatusBadge status={item.status} size="sm" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
