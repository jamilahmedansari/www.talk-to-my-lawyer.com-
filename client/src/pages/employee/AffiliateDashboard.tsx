import AppLayout from "@/components/shared/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  DollarSign,
  TrendingUp,
  Copy,
  Gift,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Wallet,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CommissionStatusBadge({ status }: { status: string }) {
  if (status === "pending")
    return <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  if (status === "paid")
    return <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" />Paid</Badge>;
  return <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50"><XCircle className="w-3 h-3 mr-1" />Voided</Badge>;
}

function PayoutStatusBadge({ status }: { status: string }) {
  if (status === "pending")
    return <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  if (status === "processing")
    return <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
  if (status === "completed")
    return <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
  return <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
}

export default function AffiliateDashboard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // ─── Queries ────────────────────────────────────────────────
  const { data: discountCode, isLoading: codeLoading } = trpc.affiliate.myCode.useQuery();
  const { data: earnings, isLoading: earningsLoading } = trpc.affiliate.myEarnings.useQuery();
  const { data: commissions, isLoading: commissionsLoading } = trpc.affiliate.myCommissions.useQuery();
  const { data: payouts, isLoading: payoutsLoading } = trpc.affiliate.myPayouts.useQuery();

  // ─── Payout Request State ───────────────────────────────────
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");

  const requestPayout = trpc.affiliate.requestPayout.useMutation({
    onSuccess: () => {
      toast.success("Payout request submitted!");
      setPayoutOpen(false);
      setPayoutAmount("");
      utils.affiliate.myPayouts.invalidate();
      utils.affiliate.myEarnings.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleRequestPayout = () => {
    const amountCents = Math.round(parseFloat(payoutAmount) * 100);
    if (isNaN(amountCents) || amountCents < 1000) {
      toast.error("Minimum payout is $10.00");
      return;
    }
    requestPayout.mutate({ amount: amountCents, paymentMethod: payoutMethod });
  };

  // ─── Copy helpers ───────────────────────────────────────────
  const handleCopyCode = () => {
    if (!discountCode?.code) return;
    navigator.clipboard.writeText(discountCode.code).then(
      () => toast.success("Discount code copied!"),
      () => toast.error("Failed to copy")
    );
  };

  const referralLink = useMemo(
    () => `${window.location.origin}/pricing?coupon=${discountCode?.code ?? ""}`,
    [discountCode?.code]
  );

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink).then(
      () => toast.success("Referral link copied!"),
      () => toast.error("Failed to copy")
    );
  };

  const isLoading = codeLoading || earningsLoading;

  return (
    <AppLayout title="Affiliate Dashboard">
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
          <h1 className="text-2xl font-bold">Welcome, {user?.name ?? "Affiliate"}</h1>
          <p className="mt-1 text-blue-100">
            Earn 5% commission on every sale made with your discount code. Share your code and grow your earnings.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Earned</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCents(earnings?.totalEarned ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Lifetime commissions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <Clock className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCents(earnings?.pending ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting payout</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Paid Out</CardTitle>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCents(earnings?.paid ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total withdrawn</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Referrals</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (earnings?.referralCount ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Successful conversions</p>
            </CardContent>
          </Card>
        </div>

        {/* Discount Code + Referral Link */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-indigo-600" />
                Your Discount Code
              </CardTitle>
              <CardDescription>
                Share this code with clients for a {discountCode?.discountPercent ?? 20}% discount. You earn 5% commission on each sale.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {codeLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : discountCode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-lg px-4 py-3 text-lg font-mono font-bold tracking-wider text-center">
                      {discountCode.code}
                    </div>
                    <Button onClick={handleCopyCode} variant="outline" size="icon">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Used {discountCode.usageCount} times</span>
                    <Badge variant={discountCode.isActive ? "default" : "secondary"}>
                      {discountCode.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No discount code found. Contact admin.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-600" />
                Referral Link
              </CardTitle>
              <CardDescription>
                Share this link directly — the discount code is pre-applied at checkout.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-lg px-4 py-3 text-sm font-mono truncate">
                    {referralLink}
                  </div>
                  <Button onClick={handleCopyLink} variant="outline" size="icon">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  When clients visit this link and purchase a letter, your discount code is automatically applied.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payout Request Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-600" />
                Payout Requests
              </CardTitle>
              <CardDescription>Request withdrawal of your pending commissions.</CardDescription>
            </div>
            <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={(earnings?.pending ?? 0) < 1000}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                  Request Payout
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Payout</DialogTitle>
                  <DialogDescription>
                    Available balance: <strong>{formatCents(earnings?.pending ?? 0)}</strong>. Minimum payout: $10.00.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="10"
                      step="0.01"
                      placeholder="10.00"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="method">Payment Method</Label>
                    <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="venmo">Venmo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPayoutOpen(false)}>Cancel</Button>
                  <Button
                    onClick={handleRequestPayout}
                    disabled={requestPayout.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {requestPayout.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    Submit Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {payoutsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : payouts && payouts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{formatDate(p.createdAt)}</TableCell>
                      <TableCell className="font-medium">{formatCents(p.amount)}</TableCell>
                      <TableCell className="text-sm capitalize">{p.paymentMethod.replace("_", " ")}</TableCell>
                      <TableCell><PayoutStatusBadge status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No payout requests yet.</p>
                <p className="text-xs mt-1">Earn commissions and request your first payout.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Commission History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              Commission History
            </CardTitle>
            <CardDescription>Track every commission earned from your referrals.</CardDescription>
          </CardHeader>
          <CardContent>
            {commissionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : commissions && commissions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Sale Amount</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{formatDate(c.createdAt)}</TableCell>
                      <TableCell>{formatCents(c.saleAmount)}</TableCell>
                      <TableCell className="text-sm">{(c.commissionRate / 100).toFixed(1)}%</TableCell>
                      <TableCell className="font-medium text-green-700">{formatCents(c.commissionAmount)}</TableCell>
                      <TableCell><CommissionStatusBadge status={c.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No commissions yet.</p>
                <p className="text-xs mt-1">Share your discount code to start earning.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
