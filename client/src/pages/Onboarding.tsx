import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale, FileText, Users, Gavel, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getRoleDashboard } from "@/components/ProtectedRoute";

type SelectedRole = "subscriber" | "employee" | "attorney";

const ROLE_OPTIONS: { role: SelectedRole; label: string; description: string; icon: React.ReactNode }[] = [
  {
    role: "subscriber",
    label: "I Need Legal Help",
    description: "Submit letter requests and get AI-drafted legal letters reviewed by real attorneys.",
    icon: <FileText className="w-8 h-8 text-indigo-600" />,
  },
  {
    role: "employee",
    label: "I'm an Affiliate Partner",
    description: "Earn commissions by referring clients. Get a unique discount code to share.",
    icon: <Users className="w-8 h-8 text-emerald-600" />,
  },
  {
    role: "attorney",
    label: "I'm an Attorney",
    description: "Review and approve AI-drafted legal letters in the Review Center.",
    icon: <Gavel className="w-8 h-8 text-purple-600" />,
  },
];

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia",
  "Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland",
  "Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey",
  "New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
  "South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [step, setStep] = useState<"role" | "profile">("role");
  const [selectedRole, setSelectedRole] = useState<SelectedRole | null>(null);
  const [jurisdiction, setJurisdiction] = useState("");
  const [barNumber, setBarNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);

  const completeOnboarding = trpc.auth.completeOnboarding.useMutation({
    onSuccess: (data) => {
      utils.auth.me.invalidate();
      toast.success("Welcome aboard!", {
        description: data.message,
      });
      navigate(getRoleDashboard(data.role));
    },
    onError: (err) => {
      toast.error("Onboarding failed", { description: err.message });
      setLoading(false);
    },
  });

  const handleRoleSelect = (role: SelectedRole) => {
    setSelectedRole(role);
    // Subscribers can skip the profile step
    if (role === "subscriber") {
      setStep("profile");
    } else {
      setStep("profile");
    }
  };

  const handleComplete = () => {
    if (!selectedRole) return;
    setLoading(true);
    completeOnboarding.mutate({
      role: selectedRole,
      jurisdiction: jurisdiction || undefined,
      barNumber: barNumber || undefined,
      companyName: companyName || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663031738932/OabHhALgbskSzGQq.png"
              alt="Talk to My Lawyer"
              className="w-12 h-12 object-contain"
            />
            <span className="text-2xl font-bold text-slate-900">Talk to My Lawyer</span>
          </div>
          <p className="text-slate-600">
            {user?.name ? `Welcome, ${user.name}!` : "Welcome!"} Let's set up your account.
          </p>
        </div>

        {step === "role" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-center text-slate-800 mb-6">
              How will you use Talk to My Lawyer?
            </h2>
            <div className="grid gap-4">
              {ROLE_OPTIONS.map((opt) => (
                <Card
                  key={opt.role}
                  className={`cursor-pointer transition-all hover:shadow-md hover:border-indigo-300 ${
                    selectedRole === opt.role ? "border-indigo-500 ring-2 ring-indigo-200" : ""
                  }`}
                  onClick={() => handleRoleSelect(opt.role)}
                >
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="shrink-0">{opt.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900">{opt.label}</h3>
                      <p className="text-sm text-slate-500 mt-1">{opt.description}</p>
                    </div>
                    {selectedRole === opt.role && (
                      <CheckCircle2 className="w-6 h-6 text-indigo-600 shrink-0" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === "profile" && selectedRole && (
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedRole === "subscriber" && "Almost there!"}
                {selectedRole === "employee" && "Affiliate Profile"}
                {selectedRole === "attorney" && "Attorney Profile"}
              </CardTitle>
              <CardDescription>
                {selectedRole === "subscriber" && "Confirm your details to get started."}
                {selectedRole === "employee" && "Tell us a bit about yourself to set up your affiliate account."}
                {selectedRole === "attorney" && "Provide your professional details for the Review Center."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Jurisdiction — all roles */}
              <div>
                <Label htmlFor="jurisdiction">Primary State / Jurisdiction</Label>
                <Select value={jurisdiction} onValueChange={setJurisdiction}>
                  <SelectTrigger id="jurisdiction">
                    <SelectValue placeholder="Select your state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Attorney-specific fields */}
              {selectedRole === "attorney" && (
                <div>
                  <Label htmlFor="barNumber">Bar Number (optional)</Label>
                  <Input
                    id="barNumber"
                    value={barNumber}
                    onChange={(e) => setBarNumber(e.target.value)}
                    placeholder="e.g., 12345678"
                  />
                </div>
              )}

              {/* Employee-specific fields */}
              {selectedRole === "employee" && (
                <div>
                  <Label htmlFor="companyName">Company / Organization (optional)</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g., Acme Legal Services"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setStep("role"); setSelectedRole(null); }}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleComplete}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
