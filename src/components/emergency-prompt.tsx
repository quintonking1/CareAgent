import { Phone, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";

// Urgent alerts route here, never to booking.
export function EmergencyPrompt({ parentName, parentPhone }: { parentName: string; parentPhone: string }) {
  const first = parentName.split(" ")[0];
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">Check on {first} now.</p>
      <p className="mt-1 text-muted-foreground">If {first} is hurt, unresponsive, or you can&apos;t reach them, call 911.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button asChild variant="destructive" className="rounded-full">
          <a href="tel:911"><Siren /> Call 911</a>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <a href={`tel:${parentPhone}`}><Phone /> Call {first}</a>
        </Button>
      </div>
    </div>
  );
}
