import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { errorMessage, getToken, login, register, setAuth } from "../services/api.js";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ phone: "", password: "", name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (getToken()) return <Navigate to="/packages" replace />;

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data =
        mode === "login"
          ? await login(form.phone, form.password)
          : await register(form.phone, form.password, form.name);
      setAuth(data);
      navigate("/packages");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card narrow">
      <h1>{mode === "login" ? "Welcome back" : "Create account"}</h1>
      <p className="muted">
        {mode === "login"
          ? "Log in with your phone number to buy internet access."
          : "Register with your phone number to get started."}
      </p>

      <form onSubmit={onSubmit}>
        {mode === "register" && (
          <label>
            Name (optional)
            <input name="name" value={form.name} onChange={onChange} placeholder="Jane Doe" />
          </label>
        )}
        <label>
          Phone number
          <input
            name="phone"
            type="tel"
            value={form.phone}
            onChange={onChange}
            placeholder="0712345678"
            required
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            placeholder="At least 6 characters"
            required
          />
        </label>

        {error && <div className="alert error">{error}</div>}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>

      <p className="switch">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <button
          type="button"
          className="link"
          onClick={() => {
            setError("");
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login" ? "Create an account" : "Log in"}
        </button>
      </p>
    </div>
  );
}
