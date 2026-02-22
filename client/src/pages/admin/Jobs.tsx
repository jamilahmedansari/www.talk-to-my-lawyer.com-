import AppLayout from "@/components/shared/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function AdminJobs() {
  const { data: failedJobs, isLoading, refetch } = trpc.admin.failedJobs.useQuery();
  const [retrying, setRetrying] = useState<number | null>(null);

  const retryJob = trpc.admin.retryJob.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`Retry started for letter #${vars.letterId}`);
      setRetrying(null);
      setTimeout(() => refetch(), 2000);
    },
    onError: (e) => { toast.error(e.message); setRetrying(null); },
  });

  const handleRetry = (letterId: number, jobType: string) => {
    const stage = jobType.includes("research") ? "research" : "drafting";
    setRetrying(letterId);
    retryJob.mutate({ letterId, stage: stage as any });
  };

  return (
    <AppLayout breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Failed Jobs" }]}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Failed Jobs</h1>
            <p className="text-sm text-muted-foreground">{failedJobs?.length ?? 0} failed pipeline jobs</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="bg-background">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : !failedJobs || failedJobs.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-2">No Failed Jobs</h3>
            <p className="text-sm text-muted-foreground">All pipeline jobs are running normally.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {failedJobs.map((job) => (
              <Card key={job.id} className="border-red-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Letter #{job.letterRequestId} — {job.jobType.replace(/_/g, " ")}
                        </p>
                        {job.errorMessage && (
                          <p className="text-xs text-red-600 mt-1 max-w-md">{job.errorMessage}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Failed at {new Date(job.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetry(job.letterRequestId, job.jobType)}
                      disabled={retrying === job.letterRequestId}
                      className="bg-background flex-shrink-0"
                    >
                      {retrying === job.letterRequestId ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Retrying...</>
                      ) : (
                        <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Retry</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
