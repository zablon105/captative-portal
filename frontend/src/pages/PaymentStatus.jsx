import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { errorMessage, getPaymentStatus } from "../services/api.js";
import { formatDateTime, formatPrice } from "../utils.js";

const POLL_MS = 3000;
const MAX_POLLS = 40; // ~2 minutes

export default function PaymentStatus() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let polls = 0;
    let timer;

    const check = async () => {
      try {
        const data = await getPaymentStatus(id);
        if (cancelled) return;
        setPayment(data);
        if (data.status !== "PENDING") return;
        polls += 1;
        if (polls >= MAX_POLLS) {
          setTimedOut(true);
          return;
        }
        timer = setTimeout(check, POLL_MS);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    };

    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  return (
    <main className="w-full max-w-[430px] min-h-screen bg-[#0d1222] shadow-2xl relative overflow-hidden flex flex-col justify-center items-center p-4">
      {/* Background Ambient Glows */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-80 -right-24 w-72 h-72 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="glass-card w-full rounded-2xl p-6 border border-white/10 text-center relative z-10">
        {error ? (
          <div>
            <div className="text-4xl mb-3">⚠️</div>
            <h1 className="text-lg font-bold text-white mb-2">Unable to Check Payment</h1>
            <p className="text-xs text-rose-300 mb-4">{error}</p>
            <Link
              to="/"
              className="inline-block w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
            >
              Back to Hotspot Portal
            </Link>
          </div>
        ) : !payment ? (
          <div className="py-6">
            <div className="spinner border-t-indigo-400 mb-3" />
            <p className="text-xs text-slate-300">Checking payment status...</p>
          </div>
        ) : payment.status === "PENDING" && !timedOut ? (
          <div className="py-4">
            <div className="spinner border-t-emerald-400 mb-4 mx-auto" />
            <h1 className="text-lg font-bold text-white mb-1">Waiting for M-Pesa Payment</h1>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Check your phone (<span className="text-emerald-400 font-mono">{payment.phone}</span>) and enter your M-Pesa PIN to complete payment of{" "}
              <span className="text-white font-bold">{formatPrice(payment.amount)}</span>.
            </p>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] text-slate-400">
              ⚡ Internet will activate automatically once PIN is verified.
            </div>
          </div>
        ) : payment.status === "PENDING" && timedOut ? (
          <div className="py-4">
            <div className="text-4xl mb-3">⏳</div>
            <h1 className="text-lg font-bold text-white mb-2">Awaiting Confirmation</h1>
            <p className="text-xs text-slate-400 mb-4">
              We haven't received confirmation from Safaricom yet. If you already entered your PIN, access will restore shortly.
            </p>
            <button
              type="button"
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition mb-2"
              onClick={() => window.location.reload()}
            >
              Check Again
            </button>
            <button
              type="button"
              className="w-full py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              onClick={() => navigate("/")}
            >
              Back to Portal
            </button>
          </div>
        ) : payment.status === "SUCCESS" ? (
          <div className="py-4">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
              ✓
            </div>
            <h1 className="text-xl font-extrabold text-white mb-1">You're Connected!</h1>
            <p className="text-xs text-emerald-300 font-semibold mb-2">
              {payment.package_name} Activated
            </p>
            {payment.mpesa_receipt && (
              <p className="text-[11px] font-mono text-slate-400 mb-2">
                Receipt: {payment.mpesa_receipt}
              </p>
            )}
            {payment.session && (
              <div className="my-4 p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-xs text-slate-300">
                Access valid until:{" "}
                <strong className="text-white">{formatDateTime(payment.session.expires_at)}</strong>
              </div>
            )}
            <button
              type="button"
              className="w-full py-3 bg-gradient-to-r from-[#00a651] to-[#059669] text-white font-extrabold text-xs rounded-xl shadow-lg glow-green"
              onClick={() => navigate("/")}
            >
              Start Browsing Now
            </button>
          </div>
        ) : (
          <div className="py-4">
            <div className="w-14 h-14 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
              ✕
            </div>
            <h1 className="text-lg font-bold text-white mb-1">Payment Unsuccessful</h1>
            <p className="text-xs text-slate-400 mb-4">
              {payment.result_desc || "The transaction was cancelled or declined."}
            </p>
            <button
              type="button"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg"
              onClick={() => navigate("/")}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
