import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ArrowRight,
  Shield,
  FileText,
  Play,
  Settings2,
  Zap,
  Copy,
  Share2,
  History,
  HelpCircle,
  Menu,
  X,
  Scale,
} from "lucide-react";

const LOGO_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310419663031738932/OabHhALgbskSzGQq.png";
const HERO_IMG =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310419663031738932/LHeNWpKDzWRwhFwy.png";
const ATTORNEY_IMG =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310419663031738932/wTAWxOiXDYjhSjRZ.png";
const SECURITY_IMG =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310419663031738932/AEuSMSBHmAViYbED.png";

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (user.role === "admin") navigate("/admin");
      else if (user.role === "employee") navigate("/review");
      else navigate("/dashboard");
    }
  }, [loading, isAuthenticated, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const goToLogin = () => {
    navigate("/login");
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={LOGO_URL}
              alt="Talk to My Lawyer"
              className="w-10 h-10 object-contain"
            />
            <span className="font-bold text-slate-900 text-base hidden sm:block">
              Talk-To-My-Lawyer
            </span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => scrollTo("features")}
              className="text-slate-600 hover:text-slate-900 text-sm font-medium hidden sm:block"
            >
              Features
            </button>
            <button
              onClick={() => scrollTo("pricing")}
              className="text-slate-600 hover:text-slate-900 text-sm font-medium hidden sm:block"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollTo("faq")}
              className="text-slate-600 hover:text-slate-900 text-sm font-medium hidden sm:block"
            >
              FAQ
            </button>
            <button
              onClick={goToLogin}
              className="text-slate-600 hover:text-slate-900 text-sm font-medium hidden sm:block"
            >
              Sign In
            </button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 h-9 text-sm font-semibold hidden sm:flex items-center gap-2"
              onClick={goToLogin}
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-2 text-slate-600 hover:text-slate-900"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-3">
            <button
              onClick={() => { scrollTo("features"); setMobileMenuOpen(false); }}
              className="block w-full text-left text-slate-700 text-sm font-medium py-2 hover:text-blue-600"
            >
              Features
            </button>
            <button
              onClick={() => { scrollTo("pricing"); setMobileMenuOpen(false); }}
              className="block w-full text-left text-slate-700 text-sm font-medium py-2 hover:text-blue-600"
            >
              Pricing
            </button>
            <button
              onClick={() => { scrollTo("faq"); setMobileMenuOpen(false); }}
              className="block w-full text-left text-slate-700 text-sm font-medium py-2 hover:text-blue-600"
            >
              FAQ
            </button>
            <div className="pt-2 flex flex-col gap-2">
              <Button variant="outline" className="w-full" onClick={goToLogin}>
                Sign In
              </Button>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={goToLogin}>
                Get Started
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section
        className="pt-16 min-h-[90vh] flex items-center"
        style={{
          background:
            "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 40%, #dbeafe 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-20 text-center w-full">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/70 border border-blue-200 rounded-full px-4 py-1.5 mb-8 text-sm text-blue-700 font-medium shadow-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse"></span>
            Your First Letter Is Free — No Credit Card Required
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 mb-4 leading-tight tracking-tight">
            Professional{" "}
            <span className="text-blue-600">Legal Letters</span>
            <br />
            drafted and approved by attorneys
          </h1>

          {/* Letter type pills */}
          <div className="flex flex-wrap justify-center gap-2.5 mb-8 mt-6">
            {[
              "Breach of Contract",
              "Demand for Payment",
              "Cease and Desist",
              "Pre-Litigation Settlement",
              "Debt Collection",
            ].map((name) => (
              <button
                key={name}
                onClick={goToLogin}
                className="bg-white/80 border border-slate-200 text-slate-700 text-sm font-medium px-4 py-1.5 rounded-full shadow-sm hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                {name}
              </button>
            ))}
            <span className="bg-white/80 border border-slate-200 text-slate-700 text-sm font-medium px-4 py-1.5 rounded-full shadow-sm cursor-default">
              And more
            </span>
          </div>

          <p className="text-slate-700 text-lg mb-10 font-medium max-w-2xl mx-auto">
            Describe your legal situation. Our attorneys research applicable laws, draft a professional letter, and review every word before delivery.{" "}
            <span className="text-blue-600 font-bold">Try your first letter free.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 text-base font-semibold rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2"
              onClick={goToLogin}
            >
              <Play className="w-4 h-4" fill="white" /> Start Your Free Letter
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-white px-8 h-12 text-base font-semibold rounded-xl flex items-center gap-2 bg-white/60"
              onClick={() => scrollTo("faq")}
            >
              <HelpCircle className="w-4 h-4" /> View FAQs{" "}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Hero illustration */}
          <div className="mt-12 mb-8 flex justify-center">
            <div className="relative max-w-2xl w-full">
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-50/80 to-transparent rounded-3xl" />
              <img
                src={HERO_IMG}
                alt="Professional legal letter service with licensed attorney review"
                className="w-full h-auto rounded-3xl shadow-2xl shadow-blue-200/50 border border-white/50"
                loading="eager"
              />
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-8 text-sm text-slate-600">
            {[
              { icon: CheckCircle2, label: "First letter free" },
              { icon: CheckCircle2, label: "24–48 hour attorney turnaround" },
              { icon: CheckCircle2, label: "Downloadable PDF" },
              { icon: CheckCircle2, label: "Licensed attorney sign-off" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <item.icon className="w-4 h-4 text-green-500" />
                <span className="font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="features" className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-3">
              Three Steps to a Professional Legal Letter
            </h2>
            <p className="text-slate-500 text-lg">
              From intake to attorney-approved PDF in as little as 24 hours
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: FileText,
                title: "Describe Your Situation",
                desc: "Complete a guided intake form with the facts of your case — parties involved, key dates, desired outcome, and supporting details. No legal expertise required.",
              },
              {
                step: "02",
                icon: Shield,
                title: "Attorneys Research & Draft",
                desc: "Our legal team researches applicable statutes and case law for your jurisdiction, then drafts a tailored legal letter grounded in real legal authority.",
              },
              {
                step: "03",
                icon: CheckCircle2,
                title: "Attorney Reviews & Approves",
                desc: "A licensed attorney reads every draft, makes edits where needed, and signs off before delivery. No letter reaches you without human legal oversight.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-slate-50 rounded-2xl p-8 border border-slate-200 shadow-sm relative group hover:shadow-md transition-shadow"
              >
                <div className="absolute -top-4 -left-4 w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-sm font-bold">
                    {item.step}
                  </span>
                </div>
                <item.icon className="w-10 h-10 text-blue-600 mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-500 leading-relaxed text-sm">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-3">
              Built for Real Legal Situations
            </h2>
            <p className="text-slate-500 text-lg">
              Every feature exists to get you a stronger letter, faster
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 border border-slate-200 rounded-xl bg-white hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">
                7 Letter Types
              </h3>
              <p className="text-sm text-slate-600">
                Demand letters, cease and desist notices, contract breach, eviction, employment disputes, consumer complaints, and general legal correspondence.
              </p>
            </div>

            <div className="p-6 border border-slate-200 rounded-xl bg-white hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">
                Jurisdiction-Aware Research
              </h3>
              <p className="text-sm text-slate-600">
                Our attorneys identify statutes, regulations, and case law specific to your state and situation — cited directly in your letter.
              </p>
            </div>

            <div className="p-6 border border-slate-200 rounded-xl bg-white hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <Copy className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">
                Real-Time Status Tracking
              </h3>
              <p className="text-sm text-slate-600">
                Follow your letter from submission through attorney drafting, review, and final approval with live status updates and email notifications.
              </p>
            </div>

            <div className="p-6 border border-slate-200 rounded-xl bg-white hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Share2 className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">
                Attorney Review Center
              </h3>
              <p className="text-sm text-slate-600">
                Licensed attorneys work in a dedicated Review Center — editing language, verifying citations, and ensuring professional quality.
              </p>
            </div>

            <div className="p-6 border border-slate-200 rounded-xl bg-white hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <History className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">
                Full Audit Trail
              </h3>
              <p className="text-sm text-slate-600">
                Every action is logged — from intake to attorney drafting, edits, and final approval. Complete transparency at every step.
              </p>
            </div>

            <div className="p-6 border border-slate-200 rounded-xl bg-white hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">
                Encrypted & Confidential
              </h3>
              <p className="text-sm text-slate-600">
                Your case details are encrypted in transit and at rest. Attorneys are bound by professional confidentiality obligations. Your data is never shared.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="py-24 px-4"
        style={{
          background: "linear-gradient(135deg, #eef2ff 0%, #dbeafe 100%)",
        }}
      >
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-600 text-lg mb-3">
            Your first letter is free. After that, choose the plan that fits.
          </p>
          <p className="text-blue-600 text-sm mb-12 font-semibold">
            Have an affiliate code? Apply it at checkout for 20% off.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                plan: "Pay Per Letter",
                price: "$200",
                period: "one-time",
                features: ["Single attorney-reviewed letter", "Legal research included", "Downloadable PDF", "Full audit trail"],
                sub: "Best for a one-time legal need",
                highlight: false,
              },
              {
                plan: "Monthly",
                price: "$79",
                period: "/month",
                features: ["4 letters per month", "Priority attorney review", "Downloadable PDFs", "Cancel anytime"],
                sub: "Best for ongoing legal matters",
                highlight: true,
              },
              {
                plan: "Annual",
                price: "$599",
                period: "/year",
                features: ["48 letters per year", "Priority attorney review", "Downloadable PDFs", "Save $349 vs monthly"],
                sub: "Best value for frequent users",
                highlight: false,
              },
            ].map((tier) => (
              <div
                key={tier.plan}
                className={`rounded-2xl p-6 border text-left ${
                  tier.highlight
                    ? "border-blue-500 bg-blue-600 text-white shadow-xl shadow-blue-200 relative"
                    : "border-slate-200 bg-white shadow-sm"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 text-xs font-bold px-3 py-1 rounded-full tracking-wide">
                    MOST POPULAR
                  </div>
                )}
                <h3
                  className={`font-bold text-lg mb-1 ${
                    tier.highlight ? "text-white" : "text-slate-900"
                  }`}
                >
                  {tier.plan}
                </h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span
                    className={`text-3xl font-bold ${
                      tier.highlight ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {tier.price}
                  </span>
                  <span
                    className={`text-sm ${
                      tier.highlight ? "text-blue-200" : "text-slate-400"
                    }`}
                  >
                    {tier.period}
                  </span>
                </div>
                <ul className="space-y-2 mb-4">
                  {tier.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${
                      tier.highlight ? "text-blue-100" : "text-slate-600"
                    }`}>
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        tier.highlight ? "text-blue-200" : "text-green-500"
                      }`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <p
                  className={`text-xs ${
                    tier.highlight ? "text-blue-200" : "text-slate-400"
                  }`}
                >
                  {tier.sub}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 space-y-3">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-10 h-12 text-lg shadow-lg rounded-xl"
              onClick={goToLogin}
            >
              Start Your Free Letter <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <p className="text-slate-500 text-sm">No credit card required for your first letter</p>
          </div>
        </div>
      </section>
      {/* FAQ Section */}
      <section id="faq" className="py-24 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
              <HelpCircle className="w-4 h-4" />
              FAQ
            </div>
            <h2 className="text-4xl font-bold text-slate-900 mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-500 text-lg">
              Everything you need to know about our legal letter service
            </p>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {[
              {
                q: "What is Talk to My Lawyer?",
                a: "Talk to My Lawyer is a professional legal letter service with mandatory attorney review. You describe your legal situation through a guided intake form, our attorneys research applicable laws for your jurisdiction and draft a professional letter, and then a licensed attorney reviews, edits, and approves the final document before you receive it.",
              },
              {
                q: "Is my first letter really free?",
                a: "Yes. Your first letter is drafted and submitted for attorney review at no cost. You can read the full draft, and once the attorney approves it, you can download the final PDF. No credit card is required for your first letter.",
              },
              {
                q: "How much does it cost after the first letter?",
                a: "After your free letter, you can pay $200 per letter on a one-time basis, or subscribe to our Monthly plan ($79/month for 4 letters) or Annual plan ($599/year for 48 letters). Affiliate discount codes can reduce the price by 20% on any plan.",
              },
              {
                q: "How long does it take to receive my letter?",
                a: "The research and drafting stage typically completes within 2\u20135 minutes. Attorney review is the primary variable \u2014 most reviews are completed within 24\u201348 hours during business days. You receive email notifications at each stage so you always know where your letter stands.",
              },
              {
                q: "Are these letters legally valid?",
                a: "Yes. Every letter is reviewed and approved by a licensed attorney before delivery. These are professionally drafted legal correspondence you can use in real-world situations \u2014 to assert your rights, demand payment, or put another party on notice. A legal letter is not a court filing, but it is a recognized and effective first step in resolving disputes.",
              },
              {
                q: "What types of legal letters can I request?",
                a: "We currently support seven letter types: Demand Letters, Cease and Desist Notices, Contract Breach Letters, Eviction Notices, Employment Dispute Letters, Consumer Complaint Letters, and General Legal Correspondence. Additional types are added regularly based on user demand.",
              },
              {
                q: "Who reviews my letter?",
                a: "Every letter is reviewed by a licensed attorney in our Review Center. Attorneys read the draft, verify legal citations, make edits where needed, and either approve the letter, reject it, or request additional information from you. No letter is delivered without explicit attorney sign-off.",
              },
              {
                q: "Can I see the draft before the attorney finalizes it?",
                a: "Yes. For your first free letter, you see the full draft and can send it for attorney review at no cost. For subsequent letters without a subscription, you see a blurred preview and can either pay $200 to unlock it or subscribe to a monthly or annual plan.",
              },
              {
                q: "Is my information confidential?",
                a: "Absolutely. All case details are encrypted in transit and at rest using industry-standard protocols. Attorneys who review your letters are bound by professional confidentiality obligations. We never share your information with third parties.",
              },
            ].map((item, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="border border-slate-200 rounded-xl px-5 data-[state=open]:border-blue-200 data-[state=open]:bg-blue-50/30 transition-colors"
              >
                <AccordionTrigger className="text-left text-sm font-semibold text-slate-900 hover:no-underline py-4">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="text-center mt-10">
            <Button asChild variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Link href="/faq">
                View All FAQs <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      {/* Trust & Security Visual */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
                <Shield className="w-4 h-4" />
                Enterprise-Grade Security
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">
                Your confidential information, protected at every layer
              </h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                All case details are encrypted in transit and at rest using industry-standard TLS and AES-256 protocols. Attorneys who review your letters are bound by professional confidentiality obligations. We never share your data with third parties, and you retain full ownership of every document.
              </p>
              <div className="space-y-3">
                {[
                  "End-to-end encryption for all submissions",
                  "Role-based access control — only assigned attorneys see your case",
                  "Full audit trail of every action taken on your letter",
                  "SOC 2 compliant infrastructure",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <img
                src={SECURITY_IMG}
                alt="Enterprise-grade security and encryption"
                className="w-full max-w-md h-auto rounded-2xl shadow-xl"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Attorney Review Visual */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center order-2 md:order-1">
              <img
                src={ATTORNEY_IMG}
                alt="Licensed attorney reviewing legal letter in the Review Center"
                className="w-full max-w-md h-auto rounded-2xl shadow-xl"
                loading="lazy"
              />
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
                <Scale className="w-4 h-4" />
                Human Legal Oversight
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">
                Every letter reviewed by a licensed attorney
              </h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                Our attorneys draft every letter, and a licensed reviewer has the final word. Our Review Center gives attorneys a dedicated workspace to read your draft, verify legal citations, edit language for precision, and approve or request changes — ensuring every letter meets professional standards.
              </p>
              <div className="space-y-3">
                {[
                  "Inline editing with version history",
                  "Legal citation verification",
                  "Approve, reject, or request changes workflow",
                  "Complete audit trail for compliance",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={LOGO_URL}
              alt="Talk to My Lawyer"
              className="w-10 h-10 object-contain"
            />
            <span className="text-white font-semibold">
              Talk to My Lawyer
            </span>
          </div>
          <div className="flex items-center gap-6 text-slate-400 text-sm">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
            <button onClick={goToLogin} className="hover:text-white transition-colors">Sign In</button>
          </div>
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} Talk to My Lawyer.
          </p>
        </div>
      </footer>
    </div>
  );
}
