import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, Scale, Shield, Zap } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PLANS = [
  {
    id: "per_letter",
    name: "Pay Per Letter",
    price: "$29",
    period: "per letter",
    description: "One professional legal letter, no commitment",
    badge: null,
    features: [
      "1 professional legal letter",
      "Attorney legal research included",
      "Attorney review & approval",
      "Final approved letter",
      "Email delivery",
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    id: "monthly",
    name: "Monthly Plan",
    price: "$79",
    period: "per month",
    description: "Unlimited letters for active legal needs",
    badge: "Most Popular",
    features: [
      "Unlimited legal letters",
      "Priority attorney review",
      "Attorney legal research included",
      "All letter types supported",
      "Email delivery",
      "Cancel anytime",
    ],
    cta: "Subscribe Monthly",
    highlight: true,
  },
  {
    id: "annual",
    name: "Annual Plan",
    price: "$599",
    period: "per year",
    description: "Best value for ongoing legal protection",
    badge: "Best Value",
    features: [
      "50 legal letters per year",
      "Priority attorney review",
      "Attorney legal research included",
      "All letter types supported",
      "Email delivery",
      "Dedicated support",
      "Save 37% vs monthly",
    ],
    cta: "Subscribe Annually",
    highlight: false,
  },
];

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      toast.info("Redirecting to secure checkout...");
      window.open(data.url, "_blank");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create checkout session");
    },
  });

  const handleSelectPlan = (planId: string) => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    checkoutMutation.mutate({ planId });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0f172a] via-[#1e3a5f] to-[#0f172a] text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <Scale className="w-12 h-12 text-[#3b82f6]" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Professional Legal Letters</h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Get professional legal letters drafted and reviewed by licensed attorneys. Choose the plan that fits your needs.
          </p>
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                plan.highlight
                  ? "border-[#3b82f6] shadow-lg shadow-blue-500/20 scale-105"
                  : "border-border"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className={plan.highlight ? "bg-[#3b82f6] text-white" : "bg-amber-500 text-white"}>
                    {plan.badge}
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground ml-2">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${plan.highlight ? "bg-[#3b82f6] hover:bg-[#2563eb] text-white" : ""}`}
                  variant={plan.highlight ? "default" : "outline"}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending && checkoutMutation.variables?.planId === plan.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
                  ) : (
                    plan.cta
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <Shield className="w-8 h-8 text-[#3b82f6]" />
            <h3 className="font-semibold">Attorney Reviewed</h3>
            <p className="text-sm text-muted-foreground">Every letter reviewed and approved by a licensed attorney</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Zap className="w-8 h-8 text-amber-500" />
            <h3 className="font-semibold">Attorney-Led Research</h3>
            <p className="text-sm text-muted-foreground">Our legal team researches jurisdiction-specific laws and statutes for your case</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Scale className="w-8 h-8 text-green-500" />
            <h3 className="font-semibold">Secure & Confidential</h3>
            <p className="text-sm text-muted-foreground">Your legal matters are handled with strict confidentiality</p>
          </div>
        </div>

        {/* Test card notice */}
        <div className="mt-12 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-center">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Testing:</strong> Use card number <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">4242 4242 4242 4242</code> with any future expiry and CVC.
          </p>
        </div>
      </div>
    </div>
  );
}
