import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Scale, FileText, Shield, Clock, CheckCircle, ArrowRight, Star, Zap, Users } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (user.role === "admin") navigate("/admin");
      else if (user.role === "employee") navigate("/review");
      else navigate("/dashboard");
    }
  }, [loading, isAuthenticated, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Scale className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-foreground text-sm leading-tight block">Talk to My</span>
              <span className="font-bold text-primary text-sm leading-tight block">Lawyer</span>
            </div>
          </div>
          <Button asChild size="sm"><a href={getLoginUrl()}>Sign In</a></Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Zap className="w-3.5 h-3.5" /> AI-Powered Legal Letters, Attorney Reviewed
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6">
              Professional Legal Letters <span className="text-primary">in Hours,</span> Not Days
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-2xl">
              Submit your legal matter, our AI researches applicable laws and drafts a professional letter, then a licensed attorney reviews and approves it.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="text-base px-8">
                <a href={getLoginUrl()}>Get Started Free <ArrowRight className="w-4 h-4 ml-2" /></a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 lg:py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">How It Works</h2>
            <p className="text-muted-foreground">From submission to final approved letter in 3 simple steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "01", icon: <FileText className="w-6 h-6 text-primary" />, title: "Submit Your Matter", desc: "Fill out our structured intake form with details about your legal situation, jurisdiction, and desired outcome." },
              { step: "02", icon: <Zap className="w-6 h-6 text-primary" />, title: "AI Research & Draft", desc: "Our AI researches applicable laws and statutes for your jurisdiction, then drafts a professional letter." },
              { step: "03", icon: <CheckCircle className="w-6 h-6 text-primary" />, title: "Attorney Review", desc: "A licensed attorney reviews, edits if needed, and approves your letter. You receive the final approved version." },
            ].map((item) => (
              <div key={item.step} className="bg-card rounded-2xl p-6 border border-border relative overflow-hidden">
                <div className="absolute top-4 right-4 text-4xl font-black text-muted/20">{item.step}</div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">{item.icon}</div>
                <h3 className="font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">Built for Security & Compliance</h2>
              <div className="space-y-4">
                {[
                  { icon: <Shield className="w-5 h-5 text-primary" />, title: "Strict Data Isolation", desc: "Subscribers never see internal AI drafts or attorney work product." },
                  { icon: <Clock className="w-5 h-5 text-primary" />, title: "Full Audit Trail", desc: "Every action is logged with timestamps for compliance." },
                  { icon: <Users className="w-5 h-5 text-primary" />, title: "Role-Based Access", desc: "Three distinct portals for Subscribers, Attorneys, and Administrators." },
                  { icon: <Star className="w-5 h-5 text-primary" />, title: "Attorney Reviewed", desc: "Every letter is reviewed and approved by a licensed attorney." },
                ].map((feat) => (
                  <div key={feat.title} className="flex gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">{feat.icon}</div>
                    <div><h4 className="font-semibold text-foreground mb-1">{feat.title}</h4><p className="text-sm text-muted-foreground">{feat.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
              {[
                { bg: "bg-blue-50", iconBg: "bg-blue-100", iconColor: "text-blue-600", label: "Submitted", badge: "New", badgeColor: "bg-blue-100 text-blue-700" },
                { bg: "bg-purple-50", iconBg: "bg-purple-100", iconColor: "text-purple-600", label: "AI Drafting", badge: "In Progress", badgeColor: "bg-purple-100 text-purple-700" },
                { bg: "bg-amber-50", iconBg: "bg-amber-100", iconColor: "text-amber-600", label: "Under Review", badge: "Review", badgeColor: "bg-amber-100 text-amber-700" },
                { bg: "bg-green-50", iconBg: "bg-green-100", iconColor: "text-green-600", label: "Approved", badge: "Done", badgeColor: "bg-green-100 text-green-700" },
              ].map((s) => (
                <div key={s.label} className={`flex items-center gap-3 p-3 ${s.bg} rounded-xl`}>
                  <div className={`w-8 h-8 ${s.iconBg} rounded-lg flex items-center justify-center`}>
                    <FileText className={`w-4 h-4 ${s.iconColor}`} />
                  </div>
                  <div><p className="text-xs text-muted-foreground">Status</p><p className="text-sm font-semibold text-foreground">{s.label}</p></div>
                  <div className="ml-auto"><span className={`text-xs ${s.badgeColor} px-2 py-0.5 rounded-full font-medium`}>{s.badge}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-primary rounded-3xl p-10 lg:p-14">
            <h2 className="text-3xl font-bold text-primary-foreground mb-4">Ready to Get Your Legal Letter?</h2>
            <p className="text-primary-foreground/80 mb-8 text-lg">Professional legal letters, attorney-approved and ready to send.</p>
            <Button asChild size="lg" variant="secondary" className="text-base px-10">
              <a href={getLoginUrl()}>Start Your Letter <ArrowRight className="w-4 h-4 ml-2" /></a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Talk to My Lawyer</span>
          </div>
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Talk to My Lawyer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
