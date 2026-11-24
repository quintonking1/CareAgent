import { readJson, statePath, writeJson } from "./store";

// Fake Walgreens Rx API, used by the phone-first home ("/").
//
// What the real API does: refill an EXISTING Walgreens prescription by Rx number. It returns a
// landingUrl; checkout finishes in a WebView, and the callback reports back, cancel, done or error.
// What it can't do: return price, refills left or order status (faked below and marked demoOnly),
// or create / transfer a new prescription. Doctors e-prescribe straight to the pharmacy.

export type WebViewCallback = "back" | "cancel" | "done" | "error";

export interface RefillRequest {
  rxNumber: string;
  fulfillment: "pickup" | "delivery";
  supplyDays?: 30 | 90;
}

export interface RefillResponse {
  landingUrl: string;
}

// Not available from the real API. Demo values only.
export interface RxDemoDetails {
  demoOnly: true;
  rxNumber: string;
  drug: string;
  prescriber: string;
  store: string;
  refillsLeft: number;
  copay: Record<30 | 90, string>;
  pickupReady: string;
  deliveryArrives: string;
}

export interface RefillRecord extends RefillRequest {
  landingUrl: string;
  callback: WebViewCallback;
  submittedAt: string;
}

export class WalgreensError extends Error {}

const RX: Record<string, RxDemoDetails> = {
  "4471": {
    demoOnly: true, rxNumber: "4471", drug: "Lisinopril 10 mg", prescriber: "Dr. Anita Patel",
    store: "Walgreens Folsom Blvd", refillsLeft: 2, copay: { 30: "$4.00", 90: "$10.00" },
    pickupReady: "Wed", deliveryArrives: "Thu",
  },
};

const refillsFile = () => statePath("walgreens_refills.json");

export function rxDetails(rxNumber: string): RxDemoDetails {
  const rx = RX[rxNumber];
  if (!rx) throw new WalgreensError(`no Walgreens prescription ending ${rxNumber}`);
  return rx;
}

// Starts a refill. The real API only hands back a landingUrl for the checkout WebView.
export function requestRefill(req: RefillRequest): RefillResponse {
  const rx = rxDetails(req.rxNumber);
  if (rx.refillsLeft < 1) throw new WalgreensError("no refills left; the prescriber has to send a new one");
  return { landingUrl: `https://fake.walgreens.example/rx/refill?rx=${rx.rxNumber}&f=${req.fulfillment}` };
}

// The WebView reports how checkout ended. We fake an instant "done".
export function completeCheckout(req: RefillRequest, callback: WebViewCallback = "done", at = new Date()): RefillRecord {
  const { landingUrl } = requestRefill(req);
  const record: RefillRecord = { ...req, landingUrl, callback, submittedAt: at.toISOString() };
  writeJson(refillsFile(), [...readJson<RefillRecord[]>(refillsFile(), []), record]);
  return record;
}
