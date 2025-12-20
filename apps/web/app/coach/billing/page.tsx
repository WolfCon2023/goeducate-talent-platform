import { CoachGuard } from "../Guard";
import { CoachBilling } from "@/components/CoachBilling";

export default function CoachBillingPage() {
  return (
    <CoachGuard>
      <section className="section">
        <CoachBilling />
      </section>
    </CoachGuard>
  );
}


