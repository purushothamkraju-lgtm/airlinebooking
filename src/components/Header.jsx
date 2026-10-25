import { Link, useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";

export default function Header() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/");
  }

  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="brand">
          SkyBooker
        </Link>
        <nav>
          <Link to="/">Search flights</Link>
          <Link to="/my-bookings">My bookings</Link>
          {session ? (
            <>
              <span className="nav-user">{session.user.name}</span>
              <button onClick={handleSignOut}>Sign out</button>
            </>
          ) : (
            <Link to="/login">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
