import { AdminGuard } from "../Guard";
import { AdminKbClient } from "./AdminKbClient";

export default function AdminKbPage() {
  return (
    <AdminGuard>
      <AdminKbClient />
    </AdminGuard>
  );
}


