import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuth, getToken, getUser } from "../services/api.js";

export default function Navbar() {
  useLocation(); // re-render on navigation so login state stays fresh
  const navigate = useNavigate();
  const loggedIn = !!getToken();
  const user = getUser();

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <Link to="/packages" className="brand">
        📶 WiFi Hotspot
      </Link>
      {loggedIn && (
        <div className="nav-right">
          <span className="muted">{user?.phone}</span>
          <button className="btn btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
