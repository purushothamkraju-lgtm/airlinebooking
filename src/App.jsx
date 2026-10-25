import { Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import RequireAuth from "./components/RequireAuth";
import Home from "./pages/Home";
import FlightDetail from "./pages/FlightDetail";
import BookingForm from "./pages/BookingForm";
import BookingConfirmation from "./pages/BookingConfirmation";
import MyBookings from "./pages/MyBookings";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/flight/:id" element={<FlightDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/book/:id"
            element={
              <RequireAuth>
                <BookingForm />
              </RequireAuth>
            }
          />
          <Route
            path="/booking-confirmation/:bookingId"
            element={
              <RequireAuth>
                <BookingConfirmation />
              </RequireAuth>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <RequireAuth>
                <MyBookings />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

function NotFound() {
  return (
    <div className="container">
      <p className="empty-state">Page not found.</p>
    </div>
  );
}
