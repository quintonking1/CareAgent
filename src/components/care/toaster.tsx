"use client";

import { Toaster as Sonner } from "sonner";

// Toasts for small confirmations ("Reminder sent to Dad"). Light only, to match the home.
export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="top-center"
      toastOptions={{ className: "font-care !rounded-2xl !border-line !text-ink !shadow-card" }}
    />
  );
}
