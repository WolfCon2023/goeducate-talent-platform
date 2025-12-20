import { NotificationsCenter } from "@/components/NotificationsCenter";
import { RoleGuard } from "@/components/RoleGuard";

export default function NotificationsPage() {
  return (
    <RoleGuard allowed={["player", "coach", "evaluator", "admin"]}>
      <section className="section">
        <NotificationsCenter />
      </section>
    </RoleGuard>
  );
}


