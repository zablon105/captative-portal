import React, { useEffect, useState } from "react";
import {
  activateVoucher,
  bindSmartTv,
  errorMessage,
  getCurrentSession,
  getPackages,
  getPaymentStatus,
  getUser,
  initiatePayment,
  login,
  setAuth,
  troubleshootNetwork,
  verifyMpesaSms,
} from "../services/api.js";
import { formatDateTime, formatDuration, formatPrice } from "../utils.js";

// Default fallback SwiftNet packages matching the template
const SWIFTNET_DEFAULT_PLANS = [
  {
    id: 1,
    name: "1 Hour Unlimited",
    price: 5,
    duration_minutes: 60,
    badge: "1 HOUR",
    category: "Casual",
    tagline: "1 Hr Unlimited Highspeed",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-400/20",
  },
  {
    id: 2,
    name: "3 Hours Unlimited",
    price: 10,
    duration_minutes: 180,
    badge: "3 HOURS",
    category: "Browsing",
    tagline: "3 Hrs Unlimited Fast WiFi",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-400/20",
  },
  {
    id: 3,
    name: "6 Hours Unlimited",
    price: 15,
    duration_minutes: 360,
    badge: "6 HOURS",
    category: "Socials",
    tagline: "6 Hrs Nonstop Streaming",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-400/20",
  },
  {
    id: 4,
    name: "12 Hours Unlimited",
    price: 20,
    duration_minutes: 720,
    badge: "12 HOURS",
    category: "Work & Play",
    tagline: "12 Hrs Half-Day Pass",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-400/20",
  },
  {
    id: 5,
    name: "24 Hours Unlimited",
    price: 35,
    duration_minutes: 1440,
    badge: "24 HRS",
    category: "Full Day",
    tagline: "24 Hrs Unlimited Daypass",
    isPopular: true,
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  },
  {
    id: 6,
    name: "7 Days Unlimited Superpass",
    price: 150,
    duration_minutes: 10080,
    badge: "7 DAYS",
    category: "Weekly",
    tagline: "7 Days Weekly Unlimited",
    isBestValue: true,
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-400/20",
  },
];

const MONTHLY_PLAN_DEFAULT = {
  id: 7,
  name: "30 Days Monthly Unlimited",
  price: 500,
  duration_minutes: 43200,
  tagline: "30 Days Unlimited High-Speed Connection",
};

export default function Portal() {
  // Navigation tabs: 'tab-packages' | 'tab-voucher' | 'tab-reconnect'
  const [activeTab, setActiveTab] = useState("tab-packages");

  // Plans & active plan state
  const [plans, setPlans] = useState(SWIFTNET_DEFAULT_PLANS);
  const [monthlyPlan, setMonthlyPlan] = useState(MONTHLY_PLAN_DEFAULT);
  const [selectedPlan, setSelectedPlan] = useState(SWIFTNET_DEFAULT_PLANS[4]); // Default to 24 hrs
  const [phone, setPhone] = useState(getUser()?.phone || "0729238654");

  // Session state
  const [activeSession, setActiveSession] = useState(null);
  const [clientMac, setClientMac] = useState("56:0D:67:07:8E:B3");

  // Payment states
  const [isSubmittingStk, setIsSubmittingStk] = useState(false);
  const [paymentPolling, setPaymentPolling] = useState(null);
  const [manualDrawerOpen, setManualDrawerOpen] = useState(false);
  const [manualSmsText, setManualSmsText] = useState("");

  // Voucher tab state
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherPhone, setVoucherPhone] = useState("");
  const [isVoucherSubmitting, setIsVoucherSubmitting] = useState(false);

  // Reconnect tab state
  const [loginForm, setLoginForm] = useState({ identifier: "254729238654", password: "" });
  const [reconnectQuery, setReconnectQuery] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Modals state
  const [smartTvOpen, setSmartTvOpen] = useState(false);
  const [smartTvForm, setSmartTvForm] = useState({ mac: "", code: "" });
  const [faqOpen, setFaqOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({ visible: false, message: "", type: "emerald" });

  const showToast = (message, type = "emerald") => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4500);
  };

  const dismissToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
  };

  // Fetch packages and current session on mount
  useEffect(() => {
    // 1. Check router redirection query parameters (?mac=...&ip=...)
    const urlParams = new URLSearchParams(window.location.search);
    const macFromUrl = urlParams.get("mac");
    if (macFromUrl) {
      setClientMac(macFromUrl);
      localStorage.setItem("client_mac", macFromUrl);
    } else {
      const storedMac = localStorage.getItem("client_mac");
      if (storedMac) {
        setClientMac(storedMac);
      } else {
        const generated = "56:0D:67:07:8E:B3";
        localStorage.setItem("client_mac", generated);
        setClientMac(generated);
      }
    }

    // Load backend packages
    getPackages()
      .then((backendPkgs) => {
        if (backendPkgs && backendPkgs.length > 0) {
          // Merge backend packages with display metadata
          const merged = SWIFTNET_DEFAULT_PLANS.map((templatePlan) => {
            const found = backendPkgs.find(
              (p) =>
                p.name.toLowerCase().includes(templatePlan.name.split(" ")[0].toLowerCase()) ||
                Number(p.price) === Number(templatePlan.price)
            );
            return found ? { ...templatePlan, id: found.id, price: Number(found.price) } : templatePlan;
          });
          setPlans(merged);

          // Find monthly plan
          const backendMonthly = backendPkgs.find(
            (p) => p.name.toLowerCase().includes("monthly") || Number(p.price) >= 500
          );
          if (backendMonthly) {
            setMonthlyPlan({
              ...MONTHLY_PLAN_DEFAULT,
              id: backendMonthly.id,
              price: Number(backendMonthly.price),
            });
          }

          // Keep selected plan mapped
          const defaultPlan = merged.find((p) => p.isPopular) || merged[0];
          setSelectedPlan(defaultPlan);
        }
      })
      .catch((err) => {
        console.warn("Could not load backend packages, using SwiftNet defaults:", err);
      });

    // Check active session
    getCurrentSession()
      .then((sess) => {
        if (sess && sess.active) {
          setActiveSession(sess);
        }
      })
      .catch(() => {});
  }, []);

  // Handle plan card selection
  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    showToast(`Selected ${plan.name} (Ksh ${plan.price})`, "indigo");
  };

  // Handle STK Push Payment submit
  const handleMpesaSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      showToast("Please enter your Safaricom M-Pesa phone number.", "indigo");
      return;
    }

    setIsSubmittingStk(true);
    try {
      const paymentData = await initiatePayment(selectedPlan.id, phone.trim());

      // If backend returned token, save auth
      if (paymentData.token && paymentData.user) {
        setAuth({ token: paymentData.token, user: paymentData.user });
      }

      if (paymentData.status === "SUCCESS") {
        // Simulation mode or immediate success
        setIsSubmittingStk(false);
        showToast(`Payment of Ksh ${selectedPlan.price} confirmed! Internet activated.`, "emerald");
        setActiveSession({
          active: true,
          package: paymentData.package_name || selectedPlan.name,
          expires_at: paymentData.session?.expires_at,
          started_at: paymentData.session?.started_at,
        });
      } else {
        // Live polling mode
        showToast(`📲 STK Push sent to ${phone}! Enter PIN on phone to activate.`, "emerald");
        setPaymentPolling({
          id: paymentData.id,
          phone: paymentData.phone,
          amount: paymentData.amount,
          package_name: paymentData.package_name || selectedPlan.name,
          status: "PENDING",
        });

        // Start poll loop
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts += 1;
          try {
            const statusData = await getPaymentStatus(paymentData.id);
            if (statusData.status === "SUCCESS") {
              clearInterval(interval);
              setIsSubmittingStk(false);
              setPaymentPolling(null);
              showToast(`Payment Confirmed! Receipt: ${statusData.mpesa_receipt}`, "emerald");
              setActiveSession({
                active: true,
                package: statusData.package_name,
                expires_at: statusData.session?.expires_at,
              });
            } else if (statusData.status === "FAILED") {
              clearInterval(interval);
              setIsSubmittingStk(false);
              setPaymentPolling(null);
              showToast(`Payment failed: ${statusData.result_desc || "Cancelled"}`, "indigo");
            } else if (attempts >= 25) {
              clearInterval(interval);
              setIsSubmittingStk(false);
              setPaymentPolling(null);
              showToast("Prompt timed out. If you entered PIN, click Reconnect to verify.", "indigo");
            }
          } catch {
            // keep polling until max
          }
        }, 3000);
      }
    } catch (err) {
      setIsSubmittingStk(false);
      showToast(errorMessage(err), "indigo");
    }
  };

  // Handle manual SMS verification
  const handleManualSmsSubmit = async () => {
    if (!manualSmsText.trim()) {
      showToast("Please paste the M-Pesa confirmation SMS or code.", "indigo");
      return;
    }
    showToast("Verifying M-Pesa transaction with Safaricom...", "indigo");
    try {
      const res = await verifyMpesaSms(manualSmsText, selectedPlan.id, phone);
      if (res.token && res.user) {
        setAuth({ token: res.token, user: res.user });
      }
      showToast(res.message || "Payment verified! Connecting to Internet...", "emerald");
      setActiveSession({
        active: true,
        package: res.package_name || selectedPlan.name,
        expires_at: res.session?.expires_at,
      });
      setManualDrawerOpen(false);
      setManualSmsText("");
    } catch (err) {
      showToast(errorMessage(err), "indigo");
    }
  };

  // Handle Voucher Activation submit
  const handleVoucherSubmit = async (e) => {
    e.preventDefault();
    if (!voucherCode.trim()) {
      showToast("Please enter your voucher code.", "indigo");
      return;
    }
    setIsVoucherSubmitting(true);
    showToast("Validating Voucher Code...", "indigo");
    try {
      const res = await activateVoucher(voucherCode.trim(), voucherPhone.trim());
      if (res.token) {
        setAuth({ token: res.token, user: { phone: voucherPhone || "Voucher User" } });
      }
      showToast(res.message || "Voucher Activated! Enjoy SwiftNet WiFi.", "emerald");
      if (res.session) {
        setActiveSession({
          active: true,
          package: res.session.package,
          expires_at: res.session.expires_at,
        });
      }
      setVoucherCode("");
    } catch (err) {
      showToast(errorMessage(err), "indigo");
    } finally {
      setIsVoucherSubmitting(false);
    }
  };

  // Handle Reconnect Account Login
  const handleAccountLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    showToast("Authenticating Credentials...", "indigo");
    try {
      const res = await login(loginForm.identifier.trim(), loginForm.password);
      setAuth(res);
      showToast("Session Restored! You are now connected.", "emerald");
      const sess = await getCurrentSession();
      if (sess && sess.active) setActiveSession(sess);
    } catch (err) {
      showToast(errorMessage(err), "indigo");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Quick Reconnect by Phone or Voucher
  const handleQuickReconnect = async () => {
    if (!reconnectQuery.trim()) {
      showToast("Please enter your phone number or voucher code", "indigo");
      return;
    }
    showToast(`Searching active sessions for: ${reconnectQuery}...`, "indigo");
    try {
      const res = await quickReconnect(reconnectQuery.trim());
      if (res.token) {
        setAuth({ token: res.token, user: { phone: reconnectQuery } });
      }
      showToast(res.message || "Previous active session found & reactivated!", "emerald");
      if (res.session) {
        setActiveSession({
          active: true,
          package: res.session.package,
          expires_at: res.session.expires_at,
        });
      }
    } catch (err) {
      showToast(errorMessage(err), "indigo");
    }
  };

  // Handle Network Troubleshoot / Cache Flush
  const handleTroubleshoot = async () => {
    showToast("Flushing captive cache & renewing DHCP lease...", "indigo");
    try {
      const res = await troubleshootNetwork(clientMac);
      setTimeout(() => {
        showToast(res.message || "Network reset completed! Re-associating MAC...", "emerald");
      }, 1200);
    } catch {
      setTimeout(() => {
        showToast("Network reset completed! Re-associating MAC...", "emerald");
      }, 1200);
    }
  };

  // Handle Smart TV Binding submit
  const handleSmartTvSubmit = async () => {
    if (!smartTvForm.mac.trim()) {
      showToast("Please enter your Smart TV MAC address", "indigo");
      return;
    }
    try {
      const res = await bindSmartTv(smartTvForm.mac.trim(), smartTvForm.code.trim());
      setSmartTvOpen(false);
      showToast(res.message || "Smart TV MAC authorised! You can now stream.", "emerald");
    } catch (err) {
      showToast(errorMessage(err), "indigo");
    }
  };

  return (
    <main className="w-full min-h-screen bg-[#0b0f19] text-[#f1f5f9] flex flex-col items-center relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-96 -right-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Responsive Wrapper */}
      <div className="w-full max-w-md md:max-w-3xl lg:max-w-6xl px-3 sm:px-6 lg:px-8 py-3 md:py-6 flex flex-col flex-1 relative z-10">
        
        {/* BEGIN: TopNavigationBar */}
        <header className="sticky top-2 z-30 bg-[#0d1222]/90 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 shadow-xl mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            {/* Logo & Network Status */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 p-[2px] shadow-lg shadow-indigo-500/30 flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-[#0d1222] rounded-[10px] flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-sky-400"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                    <line x1="12" x2="12.01" y1="20" y2="20" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-black text-sm sm:text-base tracking-tight text-white uppercase">SwiftNet</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-500/30 text-indigo-300 rounded border border-indigo-400/30">
                    FIBER 5G
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium">SwiftNet_Guest_Hotspot</p>
                </div>
              </div>
            </div>

            {/* Diagnostic Bar & WhatsApp Support */}
            <div className="flex items-center justify-between sm:justify-end space-x-2">
              <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/5 text-[11px] text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                <span className="font-mono text-slate-300">MAC: {clientMac}</span>
                <span className="text-white/20 hidden sm:inline">|</span>
                <button
                  type="button"
                  className="text-indigo-400 font-medium hover:text-indigo-300 transition flex items-center space-x-1"
                  onClick={() => setActiveTab("tab-reconnect")}
                >
                  <span>Already paid?</span>
                  <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>

              <a
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#00a651]/15 text-[#22c55e] hover:bg-[#00a651]/25 border border-[#00a651]/40 rounded-xl text-xs font-semibold transition shrink-0"
                href="https://wa.me/254729238654?text=Hello%20SwiftNet%20Support,%20I%20need%20help%20with%20WiFi"
                rel="noopener noreferrer"
                target="_blank"
                title="WhatsApp Customer Care"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.44 0-2.85-.38-4.08-1.11l-.29-.17-3.04.8 1.05-2.96-.19-.3a8.25 8.25 0 0 1-1.26-4.49c0-4.54 3.69-8.24 8.23-8.24m4.51 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.12-.14.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.02 2.6c.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1 1.48-.07 1.48-.99 1.69-1.38.21-.39.21-.73.15-.81-.06-.08-.23-.13-.48-.25Z" />
                </svg>
                <span className="hidden sm:inline">WhatsApp</span>
                <span>Support</span>
              </a>
            </div>
          </div>
        </header>
        {/* END: TopNavigationBar */}

        {/* Active Session Alert (if user has active session) */}
        {activeSession && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <p className="text-xs sm:text-sm font-bold text-white">Active Connection: {activeSession.package}</p>
                {activeSession.expires_at && (
                  <p className="text-[11px] sm:text-xs text-emerald-300">
                    Valid until {formatDateTime(activeSession.expires_at)}
                  </p>
                )}
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] sm:text-xs font-extrabold rounded-lg border border-emerald-500/30">
              CONNECTED
            </span>
          </div>
        )}

        {/* BEGIN: HeroHeadline */}
        <section className="text-center py-2 sm:py-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Ultra-Fast Fiber Hotspot • Instant Lipa na M-Pesa</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Connect to High-Speed Internet
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-xl mx-auto leading-relaxed">
            Choose a flexible package, pay via automated M-Pesa STK push, and get online immediately.
          </p>

          {/* Quick Feature Badges (Desktop) */}
          <div className="hidden sm:flex items-center justify-center gap-3 mt-3.5 text-xs text-slate-300">
            <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center space-x-1.5">
              <span>⚡ Up to 25 Mbps Fiber</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center space-x-1.5">
              <span>🔒 WPA3 Enterprise Encrypted</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center space-x-1.5">
              <span>⏱️ Instant PIN Activation</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center space-x-1.5">
              <span>💬 24/7 Hotline Support</span>
            </span>
          </div>
        </section>
        {/* END: HeroHeadline */}

        {/* BEGIN: SegmentedNavigationTabs */}
        <nav className="my-4 flex justify-center">
          <div className="glass-subtle p-1 rounded-xl flex space-x-1 bg-slate-900/60 border border-white/10 w-full max-w-md sm:max-w-lg shadow-md">
            <button
              type="button"
              className={`flex-1 py-2 text-xs sm:text-sm rounded-lg transition-all ${
                activeTab === "tab-packages"
                  ? "text-white bg-indigo-600 shadow-md font-bold"
                  : "text-slate-400 font-medium hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("tab-packages")}
            >
              Hotspot Plans
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-xs sm:text-sm rounded-lg transition-all ${
                activeTab === "tab-voucher"
                  ? "text-white bg-indigo-600 shadow-md font-bold"
                  : "text-slate-400 font-medium hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("tab-voucher")}
            >
              Voucher Code
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-xs sm:text-sm rounded-lg transition-all ${
                activeTab === "tab-reconnect"
                  ? "text-white bg-indigo-600 shadow-md font-bold"
                  : "text-slate-400 font-medium hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("tab-reconnect")}
            >
              Reconnect / Paid
            </button>
          </div>
        </nav>
        {/* END: SegmentedNavigationTabs */}

        {/* BEGIN: MainContentTabsArea */}
        <div className="flex-1 flex flex-col mb-6">
          
          {/* ================= SECTION 1: PACKAGES & MPESA TAB ================= */}
          {activeTab === "tab-packages" && (
            <div className="flex flex-col gap-5">
              
              {/* Smart TV Quick Action Banner (Spans full width) */}
              <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-slate-900/80 gap-3 shadow-lg">
                <div className="flex items-center space-x-3.5">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-400/20 shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect height="15" rx="2" ry="2" width="20" x="2" y="7" />
                      <polyline points="17 2 12 7 7 2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-white">Smart TV / Android Box Setup</p>
                    <p className="text-[11px] sm:text-xs text-slate-400">Authorize your TV's WiFi MAC directly without opening a browser</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md shrink-0 w-full sm:w-auto"
                  onClick={() => setSmartTvOpen(true)}
                >
                  Connect TV
                </button>
              </div>

              {/* Responsive 2-Column Desktop Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
                
                {/* LEFT COLUMN: Packages Catalog (7 cols on lg, 8 cols on xl) */}
                <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
                  {/* Section Title & Speed Indicator */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center space-x-1.5">
                        <span>Select Your Hotspot Plan</span>
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-400">Unlimited data quota on all plans</p>
                    </div>
                    <span className="text-[11px] sm:text-xs font-semibold text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2.5 py-1 rounded-full">
                      ⚡ Up to 25 Mbps
                    </span>
                  </div>

                  {/* Hotspot Packages Grid: 2 cols on mobile, 3 cols on tablet/desktop */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-3.5">
                    {plans.map((plan) => {
                      const isSelected = selectedPlan.id === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => handleSelectPlan(plan)}
                          className={`relative rounded-2xl p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.98] flex flex-col justify-between ${
                            isSelected
                              ? "ring-2 ring-emerald-500 bg-gradient-to-b from-indigo-900/60 to-slate-900 border border-emerald-500/40 shadow-xl"
                              : "glass-card border border-white/10 hover:border-indigo-400/50 hover:bg-white/[0.06]"
                          }`}
                        >
                          {plan.isPopular && (
                            <span className="absolute -top-2.5 right-3 bg-emerald-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                              Most Popular
                            </span>
                          )}
                          {plan.isBestValue && (
                            <span className="absolute -top-2.5 right-3 bg-indigo-500 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Best Value
                            </span>
                          )}
                          
                          <div>
                            <div className="flex justify-between items-start">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${plan.badgeColor}`}>
                                {plan.badge}
                              </span>
                              <span className={`text-[10px] ${isSelected ? "text-emerald-300 font-medium" : "text-slate-400"}`}>
                                {plan.category}
                              </span>
                            </div>

                            <div className="my-2.5">
                              <span className="text-xs text-slate-400 font-medium">Ksh</span>
                              <span className="text-2xl sm:text-3xl font-black text-white ml-0.5">{plan.price}</span>
                            </div>

                            <p className={`text-[11px] font-medium mb-3 leading-snug ${isSelected ? "text-emerald-200" : "text-slate-300"}`}>
                              {plan.tagline}
                            </p>
                          </div>

                          <button
                            type="button"
                            className={`w-full py-1.5 text-xs rounded-lg transition font-bold ${
                              isSelected
                                ? "bg-emerald-500 text-slate-950 font-extrabold shadow"
                                : "bg-white/5 hover:bg-indigo-600 hover:text-white text-indigo-300 border border-indigo-400/30"
                            }`}
                          >
                            {isSelected ? "Selected ✓" : "Select"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Monthly Option Full Width Banner */}
                  <div
                    onClick={() => handleSelectPlan(monthlyPlan)}
                    className={`rounded-2xl p-4 border flex items-center justify-between cursor-pointer transition shadow-lg ${
                      selectedPlan.id === monthlyPlan.id
                        ? "ring-2 ring-emerald-500 bg-gradient-to-b from-indigo-900/60 to-slate-900 border-emerald-500/40"
                        : "glass-card border-white/10 hover:border-indigo-400"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 flex items-center justify-center font-black text-sm border border-amber-500/30 shrink-0">
                        30D
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="text-xs sm:text-sm font-bold text-white">Monthly Home / Office Pass</p>
                          <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-bold">
                            VIP SPEED
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-400">{monthlyPlan.tagline}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-400 font-medium">Ksh</span>
                      <span className="text-lg sm:text-xl font-black text-white ml-0.5">{monthlyPlan.price}</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Sticky Checkout Card (5 cols on lg, 4 cols on xl) */}
                <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-4">
                  
                  {/* Lipa Na M-Pesa STK Push Checkout Box */}
                  <div className="glass-card rounded-2xl p-5 border border-emerald-500/30 relative overflow-hidden shadow-2xl">
                    <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#00a651] flex items-center justify-center font-black text-white text-sm shadow-md">
                          M
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-wider">
                            Lipa Na M-PESA STK Push
                          </p>
                          <p className="text-[10px] text-slate-400">Instant activation prompt on your phone</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-extrabold border border-emerald-500/30">
                        Ksh {selectedPlan.price}
                      </span>
                    </div>

                    {/* Order summary pill */}
                    <div className="mt-3.5 p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Selected Plan</p>
                        <p className="font-bold text-white text-xs">{selectedPlan.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Validity</p>
                        <p className="font-mono text-emerald-400 text-xs font-bold">
                          {formatDuration(selectedPlan.duration_minutes)}
                        </p>
                      </div>
                    </div>

                    <form className="mt-4 space-y-3.5" onSubmit={handleMpesaSubmit}>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1.5" htmlFor="mpesa-number">
                          Enter Safaricom M-Pesa Phone Number:
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <span className="text-xs font-bold text-emerald-400">🇰🇪 +254</span>
                          </div>
                          <input
                            className="w-full pl-20 pr-4 py-3 bg-black/50 text-white rounded-xl border border-white/15 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-medium tracking-wide"
                            id="mpesa-number"
                            name="phone"
                            placeholder="712345678 or 0712345678"
                            required
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Live Polling Status Banner if STK sent */}
                      {paymentPolling && (
                        <div className="p-3.5 rounded-xl bg-indigo-950/80 border border-indigo-400/40 flex items-center space-x-3">
                          <div className="spinner border-t-emerald-400 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-white">Awaiting PIN on {paymentPolling.phone}...</p>
                            <p className="text-[10px] text-indigo-300">
                              Enter your M-Pesa PIN on your phone to complete Ksh {paymentPolling.amount} payment.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* STK Push Primary Button */}
                      <button
                        className="w-full py-3.5 bg-gradient-to-r from-[#00a651] to-[#059669] hover:from-[#008f46] hover:to-[#047857] text-white font-extrabold text-sm rounded-xl shadow-lg glow-green transition active:scale-[0.98] flex items-center justify-center space-x-2 disabled:opacity-60"
                        id="stk-btn"
                        type="submit"
                        disabled={isSubmittingStk}
                      >
                        {isSubmittingStk ? (
                          <>
                            <div className="spinner border-t-white mr-2" />
                            <span>Requesting STK push to {phone}...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.5"
                              />
                            </svg>
                            <span>Pay Ksh {selectedPlan.price} via M-Pesa STK</span>
                          </>
                        )}
                      </button>
                      <p className="text-[10px] text-center text-slate-400">
                        A popup will prompt for your <span className="text-emerald-300 font-semibold">M-Pesa PIN</span>. Internet activates immediately!
                      </p>
                    </form>

                    {/* Alternative Manual SMS Message Section Toggle */}
                    <div className="mt-3.5 pt-3.5 border-t border-white/5 flex items-center justify-between">
                      <p className="text-[11px] text-slate-400">Paid manually via Paybill?</p>
                      <button
                        className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold underline"
                        onClick={() => setManualDrawerOpen(!manualDrawerOpen)}
                        type="button"
                      >
                        {manualDrawerOpen ? "Hide SMS box" : "Paste M-Pesa Message"}
                      </button>
                    </div>

                    {/* Collapsible manual Mpesa input drawer */}
                    {manualDrawerOpen && (
                      <div className="mt-3 pt-2">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Paste Complete M-Pesa SMS or Code (e.g. SL98D5K7...):
                        </label>
                        <textarea
                          className="w-full p-2.5 bg-black/40 text-white rounded-xl border border-white/15 focus:border-indigo-500 text-xs font-mono"
                          placeholder="e.g. QK238DJ91 Confirmed. Ksh 35 paid to SwiftNet Hotspots..."
                          rows={2}
                          value={manualSmsText}
                          onChange={(e) => setManualSmsText(e.target.value)}
                        />
                        <button
                          className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
                          onClick={handleManualSmsSubmit}
                          type="button"
                        >
                          Verify SMS &amp; Activate Access
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Desktop Quick Paybill Helper Box */}
                  <div className="glass-subtle rounded-2xl p-3.5 border border-white/5 text-xs">
                    <p className="font-bold text-white mb-1.5 flex items-center justify-between">
                      <span>Manual Paybill Guide</span>
                      <span className="text-emerald-400 font-mono">400200</span>
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Paybill: <strong className="text-white">400200</strong> · Account: <strong className="text-emerald-400">SWIFT-WIFI</strong> · Enter matching amount (e.g. Ksh 35).
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}
          {/* ================= END SECTION 1: PACKAGES ================= */}

          {/* ================= SECTION 2: VOUCHER TAB ================= */}
          {activeTab === "tab-voucher" && (
            <div className="flex flex-col gap-4 max-w-xl mx-auto w-full py-4">
              <div className="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl">
                <div className="flex items-center space-x-3.5 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-400/20">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white">Have a Scratch Voucher?</h2>
                    <p className="text-xs text-slate-400">Activate printed voucher card code</p>
                  </div>
                </div>

                <form className="mt-5 space-y-4" onSubmit={handleVoucherSubmit}>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Voucher Code</label>
                    <input
                      className="w-full px-4 py-3 bg-black/50 uppercase tracking-widest font-mono text-white rounded-xl border border-white/15 focus:border-indigo-500 text-sm sm:text-base"
                      placeholder="e.g. SN-8924-XXXX"
                      required
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Phone Number (Optional for SMS receipt)
                    </label>
                    <input
                      className="w-full px-4 py-3 bg-black/50 text-white rounded-xl border border-white/15 focus:border-indigo-500 text-sm sm:text-base"
                      placeholder="07XX XXX XXX"
                      type="tel"
                      value={voucherPhone}
                      onChange={(e) => setVoucherPhone(e.target.value)}
                    />
                  </div>
                  <button
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-lg transition active:scale-[0.98] disabled:opacity-60"
                    type="submit"
                    disabled={isVoucherSubmitting}
                  >
                    {isVoucherSubmitting ? "Activating..." : "Activate Voucher Now"}
                  </button>
                </form>
              </div>

              <div className="glass-subtle rounded-xl p-4 border border-white/5 text-center">
                <p className="text-xs sm:text-sm text-slate-400">
                  Buy printed scratch vouchers from nearby agent shops, kiosks, and retail centers.
                </p>
              </div>
            </div>
          )}
          {/* ================= END SECTION 2: VOUCHER ================= */}

          {/* ================= SECTION 3: RECONNECT / ACCOUNT TAB ================= */}
          {activeTab === "tab-reconnect" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto w-full py-4">
              
              {/* Already paid login card */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 shadow-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-2.5">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-400/20">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-white">Active Package Login</h2>
                      <p className="text-[11px] sm:text-xs text-slate-400">Login with your credentials or MAC</p>
                    </div>
                  </div>

                  <form className="mt-4 space-y-3.5" onSubmit={handleAccountLogin}>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Username / Phone Number / MAC
                      </label>
                      <input
                        className="w-full px-3.5 py-2.5 bg-black/40 text-white rounded-xl border border-white/15 focus:border-indigo-500 text-sm font-mono"
                        required
                        type="text"
                        value={loginForm.identifier}
                        onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        PIN / Password
                      </label>
                      <input
                        className="w-full px-3.5 py-2.5 bg-black/40 text-white rounded-xl border border-white/15 focus:border-indigo-500 text-sm font-mono"
                        placeholder="Enter account PIN or password"
                        required
                        type="password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      />
                    </div>
                    <button
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition disabled:opacity-60"
                      type="submit"
                      disabled={isLoggingIn}
                    >
                      {isLoggingIn ? "Logging In..." : "Log In & Restore WiFi"}
                    </button>
                  </form>
                </div>
              </div>

              {/* Lost Voucher / Force Reconnection Diagnostics Card */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 shadow-2xl flex flex-col justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white mb-1">Lost Connection or Switched Device?</h3>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    Lookup your active session using your M-Pesa phone number or voucher code to reactivate your device MAC.
                  </p>
                  <div className="flex space-x-2 mb-4">
                    <input
                      className="flex-1 px-3.5 py-2.5 bg-black/40 text-white rounded-xl border border-white/15 text-xs sm:text-sm"
                      id="reconnect-query"
                      placeholder="e.g. 0729238654 or Voucher Code"
                      type="text"
                      value={reconnectQuery}
                      onChange={(e) => setReconnectQuery(e.target.value)}
                    />
                    <button
                      className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-xl transition shrink-0"
                      onClick={handleQuickReconnect}
                      type="button"
                    >
                      Reconnect
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-white">DNS or Portal Cache issue?</p>
                    <p className="text-[11px] text-slate-400">Flush browser socket &amp; renew DHCP lease</p>
                  </div>
                  <button
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shrink-0"
                    onClick={handleTroubleshoot}
                    type="button"
                  >
                    <span>🛠️ Force Reconnect</span>
                  </button>
                </div>
              </div>

            </div>
          )}
          {/* ================= END SECTION 3: RECONNECT ================= */}

        </div>
        {/* END: MainContentTabsArea */}

        {/* BEGIN: QuickPaymentInstructions (Paybill section) */}
        <section className="p-4 sm:p-5 rounded-2xl border border-white/5 bg-black/30 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-1">
            <span className="text-xs sm:text-sm font-bold text-slate-300 uppercase tracking-wider">
              How to Pay Manually (Paybill)
            </span>
            <span className="text-xs text-indigo-400 font-semibold font-mono">Business Number: 400200</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
            <div className="glass-subtle p-3 rounded-xl border border-white/5">
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium">1. Enter Business / Paybill</p>
              <p className="text-sm sm:text-base font-extrabold text-white font-mono mt-0.5">400200</p>
            </div>
            <div className="glass-subtle p-3 rounded-xl border border-white/5">
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium">2. Account Number</p>
              <p className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono mt-0.5">SWIFT-WIFI</p>
            </div>
            <div className="glass-subtle p-3 rounded-xl border border-white/5">
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium">3. Exact Amount (Ksh)</p>
              <p className="text-sm sm:text-base font-extrabold text-white mt-0.5">5, 10, 15, 20, 35, 150</p>
            </div>
          </div>
        </section>
        {/* END: QuickPaymentInstructions */}

        {/* BEGIN: Footer */}
        <footer className="mt-auto py-5 border-t border-white/10 text-center">
          <div className="flex items-center justify-center space-x-4 mb-2.5 text-xs sm:text-sm font-medium text-slate-400">
            <button
              type="button"
              className="hover:text-white transition"
              onClick={() => setActiveTab("tab-packages")}
            >
              Rates
            </button>
            <span>•</span>
            <button
              type="button"
              className="hover:text-white transition"
              onClick={() => setFaqOpen(true)}
            >
              FAQ
            </button>
            <span>•</span>
            <button
              type="button"
              className="hover:text-white transition"
              onClick={() => setTermsOpen(true)}
            >
              Terms
            </button>
            <span>•</span>
            <a className="text-emerald-400 hover:underline" href="tel:0729238654">
              0729238654
            </a>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400">
            © 2026 SwiftNet Fiber Hotspots Kenya Ltd. Highspeed Captive Gateway.
          </p>
          <div className="mt-2 inline-flex items-center space-x-1.5 text-[11px] sm:text-xs text-slate-400">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                clipRule="evenodd"
                d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
                fillRule="evenodd"
              />
            </svg>
            <span>WPA3 Encrypted Enterprise Captive Network</span>
          </div>
        </footer>
        {/* END: Footer */}

      </div>

      {/* BEGIN: FloatingSupportDialer */}
      <a
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-indigo-600/50 border border-white/20 transition active:scale-95"
        href="tel:0729238654"
        title="Call Customer Care Hotline"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </a>
      {/* END: FloatingSupportDialer */}

      {/* BEGIN: InteractiveModalSmartTV */}
      {smartTvOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm rounded-2xl p-5 border border-indigo-500/40 relative">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
              onClick={() => setSmartTvOpen(false)}
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
            <div className="flex items-center space-x-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect height="15" rx="2" ry="2" width="20" x="2" y="7" />
                  <polyline points="17 2 12 7 7 2" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white">Connect Smart TV / Android TV</h3>
            </div>
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Smart TVs don't open captive login pages easily. Enter your TV's WiFi MAC Address here to authorise it directly.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Smart TV WiFi MAC Address
                </label>
                <input
                  className="w-full px-3 py-2 bg-black/50 text-white uppercase font-mono rounded-xl border border-white/20 text-xs"
                  placeholder="e.g. AA:BB:CC:11:22:33"
                  type="text"
                  value={smartTvForm.mac}
                  onChange={(e) => setSmartTvForm({ ...smartTvForm, mac: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  M-Pesa Confirmation Code or Phone
                </label>
                <input
                  className="w-full px-3 py-2 bg-black/50 text-white font-mono rounded-xl border border-white/20 text-xs"
                  placeholder="e.g. QK987213..."
                  type="text"
                  value={smartTvForm.code}
                  onChange={(e) => setSmartTvForm({ ...smartTvForm, code: e.target.value })}
                />
              </div>
              <button
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
                onClick={handleSmartTvSubmit}
                type="button"
              >
                Bind &amp; Connect Smart TV
              </button>
            </div>
          </div>
        </div>
      )}
      {/* END: InteractiveModalSmartTV */}

      {/* BEGIN: FAQ Modal */}
      {faqOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm rounded-2xl p-5 border border-indigo-500/40 relative">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
              onClick={() => setFaqOpen(false)}
              type="button"
            >
              ✕
            </button>
            <h3 className="text-sm font-bold text-white mb-3">Frequently Asked Questions</h3>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div>
                <p className="font-bold text-white">1. How fast is the WiFi?</p>
                <p className="text-slate-400 text-[11px]">Up to 25 Mbps high-speed fiber connection.</p>
              </div>
              <div>
                <p className="font-bold text-white">2. Can I use multiple devices?</p>
                <p className="text-slate-400 text-[11px]">Each voucher / plan binds to 1 device MAC at a time.</p>
              </div>
              <div>
                <p className="font-bold text-white">3. How do I get support?</p>
                <p className="text-slate-400 text-[11px]">Call or WhatsApp 0729238654 anytime.</p>
              </div>
            </div>
            <button
              type="button"
              className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl"
              onClick={() => setFaqOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* BEGIN: Terms Modal */}
      {termsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm rounded-2xl p-5 border border-indigo-500/40 relative">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
              onClick={() => setTermsOpen(false)}
              type="button"
            >
              ✕
            </button>
            <h3 className="text-sm font-bold text-white mb-2">Terms &amp; Conditions</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Unlimited downloads and streaming are permitted within the purchased duration. Illegal traffic, torrenting, spamming, and network abuse are strictly prohibited. SwiftNet reserves the right to terminate abusive connections.
            </p>
            <button
              type="button"
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl"
              onClick={() => setTermsOpen(false)}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* BEGIN: InteractiveToastNotification */}
      <div
        className={`fixed top-4 z-50 transition-all duration-300 transform px-4 w-full max-w-[400px] ${
          toast.visible ? "translate-y-0 opacity-100" : "-translate-y-20 opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`rounded-xl p-3 text-white text-xs font-semibold shadow-2xl flex items-center justify-between border ${
            toast.type === "emerald"
              ? "bg-emerald-600 border-emerald-400/40"
              : "bg-indigo-600 border-indigo-400/40"
          }`}
        >
          <span>{toast.message}</span>
          <button className="ml-2 text-white/80 hover:text-white text-sm" onClick={dismissToast} type="button">
            ✕
          </button>
        </div>
      </div>
      {/* END: InteractiveToastNotification */}
    </main>
  );
}
