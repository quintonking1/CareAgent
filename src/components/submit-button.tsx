"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Server actions here can run the agent for several seconds; show that it's working.
export function SubmitButton({ children, pendingText = "Agent working…", ...props }: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? <><Loader2 className="animate-spin" /> {pendingText}</> : children}
    </Button>
  );
}
