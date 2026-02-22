import AppLayout from "@/components/shared/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users, AlertCircle, CheckCircle, Clock, ArrowRight, Activity } from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();
  const { data: failedJobs } = trpc.admin.failedJobs.useQuery();

  return (
    <AppLayout breadcrumb={[{ label: "Admin Dashboard" }]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 text-white">
          <h1 className="text-xl font-bold mb-1">Admin Dashboard</h1>
          <p className="text-slate-300 text-sm">System overview and management controls</p>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Letters", value: (stats as any).totalLetters ?? 0, icon: <FileText className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Total Users", value: (stats as any).totalUsers ?? 0, icon: <Users className="w-5 h-5" />, color: "text-indigo-600", bg: "bg-indigo-50" },
              { label: "Approved", value: (stats as any).approvedLetters ?? 0, icon: <CheckCircle className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50" },
              { label: "Failed Jobs", value: (stats as any).failedJobs ?? 0, icon: <AlertCircle className="w-5 h-5" />, color: "text-red-600", bg: "bg-red-50", alert: ((stats as any).failedJobs ?? 0) > 0 },
            ].map((stat) => (
              <Card key={stat.label} className={stat.alert ? "border-red-300" : ""}>
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
        ) : null}

        {/* Status Breakdown */}
        {stats && (stats as any).byStatus && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Letters by Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries((stats as any).byStatus as Record<string, number>).map(([status, count]) => (
                  <div key={status} className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-foreground">{count}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{status.replace(/_/g, " ")}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Manage Users", desc: "View and update user roles", href: "/admin/users", icon: <Users className="w-5 h-5 text-indigo-600" />, bg: "bg-indigo-50" },
            { label: "All Letters", desc: "Browse all letter requests", href: "/admin/letters", icon: <FileText className="w-5 h-5 text-blue-600" />, bg: "bg-blue-50" },
            { label: "Failed Jobs", desc: `${failedJobs?.length ?? 0} jobs need attention`, href: "/admin/jobs", icon: <AlertCircle className="w-5 h-5 text-red-600" />, bg: "bg-red-50", alert: (failedJobs?.length ?? 0) > 0 },
          ].map((action) => (
            <Card key={action.label} className={`hover:shadow-md transition-shadow cursor-pointer ${action.alert ? "border-red-300" : ""}`}>
              <CardContent className="p-5">
                <div className={`w-10 h-10 ${action.bg} rounded-xl flex items-center justify-center mb-3`}>
                  {action.icon}
                </div>
                <h3 className="font-semibold text-foreground mb-1">{action.label}</h3>
                <p className="text-xs text-muted-foreground mb-3">{action.desc}</p>
                <Button asChild variant="outline" size="sm" className="w-full bg-background">
                  <Link href={action.href}>
                    Open <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Failed Jobs */}
        {failedJobs && failedJobs.length > 0 && (
          <Card className="border-red-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  Recent Failed Jobs ({failedJobs.length})
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-xs text-red-600">
                  <Link href="/admin/jobs">View All <ArrowRight className="w-3 h-3 ml-1" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {failedJobs.slice(0, 3).map((job) => (
                  <div key={job.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Letter #{job.letterRequestId} — {job.jobType}
                        </p>
                        {job.errorMessage && (
                          <p className="text-xs text-red-600 mt-0.5 truncate max-w-xs">{job.errorMessage}</p>
                        )}
                      </div>
                      <Button asChild variant="outline" size="sm" className="bg-background text-xs">
                        <Link href="/admin/jobs">Retry</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
