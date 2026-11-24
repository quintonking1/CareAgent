import { Suspense } from "react";
import { hasModelKey } from "@/agent/llm";
import { CareApp } from "@/components/care/care-app";

// The phone-first home. The UI leads; the agent works behind it and answers "Ask about this".
export default function HomePage() {
  return (
    <Suspense>
      <CareApp online={hasModelKey()} />
    </Suspense>
  );
}
