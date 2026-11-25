import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import PaymentStatus from "./pages/PaymentStatus.jsx";
import Portal from "./pages/Portal.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Portal />} />
      <Route path="/packages" element={<Portal />} />
      <Route path="/payment-status/:id" element={<PaymentStatus />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
