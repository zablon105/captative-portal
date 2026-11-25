import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { errorMessage, getUser, initiatePayment } from "../services/api.js";
import { formatDuration, formatPrice } from "../utils.js";

export default function Payment() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const pkg = state?.package;
  const [phone, setPhone] = useState(getUser()?.phone || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!pkg) return <Navigate to="/packages" replace />;

  const pay = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payment = await initiatePayment(pkg.id, phone);
      navigate(`/payment-status/${payment.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="card narrow">
      <h1>Confirm payment</h1>

      <div className="summary">
        <div>
          <strong>{pkg.name}</strong>
          <div className="muted small">{formatDuration(pkg.duration_minutes)} of access</div>
        </div>
        <div className="price small-price">{formatPrice(pkg.price)}</div>
      </div>

      <form onSubmit={pay}>
        <label>
          M-Pesa phone number
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0712345678"
            required
          />
        </label>
        <p className="muted small">
          You'll get an M-Pesa prompt on this number. Enter your PIN to complete payment.
        </p>

        {error && <div className="alert error">{error}</div>}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Sending prompt..." : `Pay ${formatPrice(pkg.price)}`}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate("/packages")}>
          Back to packages
        </button>
      </form>
    </div>
  );
}
