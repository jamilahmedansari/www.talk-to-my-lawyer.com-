import AppLayout from "@/components/shared/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, CheckCircle, FileText, MapPin, Users, AlignLeft, Target } from "lucide-react";
import { LETTER_TYPE_CONFIG, US_STATES } from "../../../../shared/types";

const STEPS = [
  { id: 1, label: "Letter Type", icon: <FileText className="w-4 h-4" /> },
  { id: 2, label: "Jurisdiction", icon: <MapPin className="w-4 h-4" /> },
  { id: 3, label: "Parties", icon: <Users className="w-4 h-4" /> },
  { id: 4, label: "Details", icon: <AlignLeft className="w-4 h-4" /> },
  { id: 5, label: "Outcome", icon: <Target className="w-4 h-4" /> },
];

interface FormData {
  letterType: string;
  subject: string;
  jurisdictionState: string;
  jurisdictionCity: string;
  tonePreference: "firm" | "moderate" | "aggressive";
  senderName: string;
  senderAddress: string;
  senderEmail: string;
  senderPhone: string;
  recipientName: string;
  recipientAddress: string;
  recipientEmail: string;
  incidentDate: string;
  description: string;
  additionalContext: string;
  amountOwed: string;
  desiredOutcome: string;
  deadlineDate: string;
}

const INITIAL: FormData = {
  letterType: "",
  subject: "",
  jurisdictionState: "",
  jurisdictionCity: "",
  tonePreference: "firm",
  senderName: "",
  senderAddress: "",
  senderEmail: "",
  senderPhone: "",
  recipientName: "",
  recipientAddress: "",
  recipientEmail: "",
  incidentDate: "",
  description: "",
  additionalContext: "",
  amountOwed: "",
  desiredOutcome: "",
  deadlineDate: "",
};

export default function SubmitLetter() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [, navigate] = useLocation();

  const submit = trpc.letters.submit.useMutation({
    onSuccess: (data) => {
      toast.success("Letter submitted successfully! AI pipeline has started.");
      navigate(`/letters/${data.letterId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const update = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canProceed = () => {
    if (step === 1) return !!form.letterType && form.subject.length >= 5;
    if (step === 2) return !!form.jurisdictionState;
    if (step === 3) return !!form.senderName && !!form.senderAddress && !!form.recipientName && !!form.recipientAddress;
    if (step === 4) return form.description.length >= 20;
    if (step === 5) return form.desiredOutcome.length >= 10;
    return true;
  };

  const handleSubmit = () => {
    const intakeJson = {
      schemaVersion: "1.0",
      letterType: form.letterType,
      sender: { name: form.senderName, address: form.senderAddress, email: form.senderEmail || undefined, phone: form.senderPhone || undefined },
      recipient: { name: form.recipientName, address: form.recipientAddress, email: form.recipientEmail || undefined },
      jurisdiction: { country: "US", state: form.jurisdictionState, city: form.jurisdictionCity || undefined },
      matter: { category: form.letterType, subject: form.subject, description: form.description, incidentDate: form.incidentDate || undefined },
      financials: form.amountOwed ? { amountOwed: parseFloat(form.amountOwed), currency: "USD" } : undefined,
      desiredOutcome: form.desiredOutcome,
      deadlineDate: form.deadlineDate || undefined,
      additionalContext: form.additionalContext || undefined,
      tonePreference: form.tonePreference,
    };
    submit.mutate({
      letterType: form.letterType as any,
      subject: form.subject,
      jurisdictionState: form.jurisdictionState,
      jurisdictionCity: form.jurisdictionCity || undefined,
      intakeJson,
    });
  };

  return (
    <AppLayout breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Submit Letter" }]}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Step Progress */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : step > s.id
                    ? "bg-green-100 text-green-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.id ? <CheckCircle className="w-3.5 h-3.5" /> : s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${step > s.id ? "bg-green-300" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {STEPS[step - 1].icon}
              {STEPS[step - 1].label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Letter Type */}
            {step === 1 && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Letter Type *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(LETTER_TYPE_CONFIG).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => update("letterType", key)}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${
                          form.letterType === key
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <p className="text-sm font-semibold text-foreground">{val.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{val.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="subject" className="text-sm font-medium mb-1.5 block">Brief Subject Line *</Label>
                  <Input
                    id="subject"
                    value={form.subject}
                    onChange={(e) => update("subject", e.target.value)}
                    placeholder="e.g., Demand for unpaid rent — 123 Main St"
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{form.subject.length}/500 characters</p>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Tone Preference</Label>
                  <Select value={form.tonePreference} onValueChange={(v) => update("tonePreference", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="firm">Firm (Professional & Direct)</SelectItem>
                      <SelectItem value="moderate">Moderate (Balanced)</SelectItem>
                      <SelectItem value="aggressive">Aggressive (Strong Legal Language)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Step 2: Jurisdiction */}
            {step === 2 && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">State / Jurisdiction *</Label>
                  <Select value={form.jurisdictionState} onValueChange={(v) => update("jurisdictionState", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state..." />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    This determines which laws and statutes apply to your letter.
                  </p>
                </div>
                <div>
                  <Label htmlFor="city" className="text-sm font-medium mb-1.5 block">City (Optional)</Label>
                  <Input
                    id="city"
                    value={form.jurisdictionCity}
                    onChange={(e) => update("jurisdictionCity", e.target.value)}
                    placeholder="e.g., Los Angeles"
                  />
                </div>
              </>
            )}

            {/* Step 3: Parties */}
            {step === 3 && (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Your Information (Sender)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="senderName" className="text-xs mb-1 block">Full Name *</Label>
                      <Input id="senderName" value={form.senderName} onChange={(e) => update("senderName", e.target.value)} placeholder="John Smith" />
                    </div>
                    <div>
                      <Label htmlFor="senderEmail" className="text-xs mb-1 block">Email</Label>
                      <Input id="senderEmail" type="email" value={form.senderEmail} onChange={(e) => update("senderEmail", e.target.value)} placeholder="john@example.com" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="senderAddress" className="text-xs mb-1 block">Address *</Label>
                    <Input id="senderAddress" value={form.senderAddress} onChange={(e) => update("senderAddress", e.target.value)} placeholder="123 Main St, City, State 12345" />
                  </div>
                  <div>
                    <Label htmlFor="senderPhone" className="text-xs mb-1 block">Phone</Label>
                    <Input id="senderPhone" value={form.senderPhone} onChange={(e) => update("senderPhone", e.target.value)} placeholder="(555) 000-0000" />
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Recipient Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="recipientName" className="text-xs mb-1 block">Full Name / Company *</Label>
                      <Input id="recipientName" value={form.recipientName} onChange={(e) => update("recipientName", e.target.value)} placeholder="Jane Doe / Acme Corp" />
                    </div>
                    <div>
                      <Label htmlFor="recipientEmail" className="text-xs mb-1 block">Email</Label>
                      <Input id="recipientEmail" type="email" value={form.recipientEmail} onChange={(e) => update("recipientEmail", e.target.value)} placeholder="recipient@example.com" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="recipientAddress" className="text-xs mb-1 block">Address *</Label>
                    <Input id="recipientAddress" value={form.recipientAddress} onChange={(e) => update("recipientAddress", e.target.value)} placeholder="456 Other St, City, State 67890" />
                  </div>
                </div>
              </>
            )}

            {/* Step 4: Details */}
            {step === 4 && (
              <>
                <div>
                  <Label htmlFor="description" className="text-sm font-medium mb-1.5 block">
                    Describe Your Situation *
                  </Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="Provide a detailed description of the issue, what happened, when it happened, and any relevant background information..."
                    rows={5}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{form.description.length} characters (minimum 20)</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="incidentDate" className="text-sm font-medium mb-1.5 block">Incident Date</Label>
                    <Input id="incidentDate" type="date" value={form.incidentDate} onChange={(e) => update("incidentDate", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="amountOwed" className="text-sm font-medium mb-1.5 block">Amount Owed (USD)</Label>
                    <Input id="amountOwed" type="number" value={form.amountOwed} onChange={(e) => update("amountOwed", e.target.value)} placeholder="0.00" min="0" step="0.01" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="additionalContext" className="text-sm font-medium mb-1.5 block">Additional Context</Label>
                  <Textarea
                    id="additionalContext"
                    value={form.additionalContext}
                    onChange={(e) => update("additionalContext", e.target.value)}
                    placeholder="Any other relevant information, prior communications, agreements, etc."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </>
            )}

            {/* Step 5: Outcome */}
            {step === 5 && (
              <>
                <div>
                  <Label htmlFor="desiredOutcome" className="text-sm font-medium mb-1.5 block">
                    What outcome do you want? *
                  </Label>
                  <Textarea
                    id="desiredOutcome"
                    value={form.desiredOutcome}
                    onChange={(e) => update("desiredOutcome", e.target.value)}
                    placeholder="e.g., I want the recipient to pay the outstanding balance of $2,500 within 14 days, or I will pursue legal action..."
                    rows={4}
                    className="resize-none"
                  />
                </div>
                <div>
                  <Label htmlFor="deadlineDate" className="text-sm font-medium mb-1.5 block">Response Deadline</Label>
                  <Input id="deadlineDate" type="date" value={form.deadlineDate} onChange={(e) => update("deadlineDate", e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Date by which you expect a response or action.</p>
                </div>

                {/* Summary */}
                <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Submission Summary</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="text-foreground font-medium">{LETTER_TYPE_CONFIG[form.letterType]?.label}</span>
                    <span className="text-muted-foreground">Jurisdiction:</span>
                    <span className="text-foreground font-medium">{form.jurisdictionState}{form.jurisdictionCity ? `, ${form.jurisdictionCity}` : ""}</span>
                    <span className="text-muted-foreground">Sender:</span>
                    <span className="text-foreground font-medium">{form.senderName}</span>
                    <span className="text-muted-foreground">Recipient:</span>
                    <span className="text-foreground font-medium">{form.recipientName}</span>
                    <span className="text-muted-foreground">Tone:</span>
                    <span className="text-foreground font-medium capitalize">{form.tonePreference}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="bg-background"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          {step < 5 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canProceed() || submit.isPending}>
              {submit.isPending ? "Submitting..." : "Submit Letter"}
              <CheckCircle className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
