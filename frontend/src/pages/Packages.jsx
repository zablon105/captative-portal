import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { errorMessage, getCurrentSession, getPackages } from "../services/api.js";
import { formatDateTime, formatDuration, formatPrice } from "../utils.js";

export default function Packages() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPackages(), getCurrentSession()])
      .then(([pkgs, sess]) => {
        setPackages(pkgs);
        setSession(sess.active ? sess : null);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const select = (pkg) => navigate("/payment", { state: { package: pkg } });

  return (
    <div>
      <h1>Choose a package</h1>
      <p className="muted">Pick how long you want to stay online. Pay with M-Pesa.</p>

      {session && (
        <div className="alert success">
          You're online with <strong>{session.package}</strong> until{" "}
          <strong>{formatDateTime(session.expires_at)}</strong>.
        </div>
      )}
      {error && <div className="alert error">{error}</div>}
      {loading && <p className="muted">Loading packages...</p>}
      {!loading && !error && packages.length === 0 && (
        <p className="muted">
          No packages available yet. Run <code>python manage.py seed_packages</code> in the backend.
        </p>
      )}

      <div className="grid">
        {packages.map((pkg) => (
          <div className="card package" key={pkg.id}>
            <h2>{pkg.name}</h2>
            <div className="price">{formatPrice(pkg.price)}</div>
            <div className="muted">{formatDuration(pkg.duration_minutes)} of access</div>
            {pkg.description && <p className="muted small">{pkg.description}</p>}
            <button className="btn" onClick={() => select(pkg)}>
              Buy now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
