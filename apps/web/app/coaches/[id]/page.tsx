import Link from "next/link";

import { PublicCoachProfile } from "@/components/profiles/PublicCoachProfile";

export default async function CoachPublicProfilePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return (
    <div className="grid gap-6">
      <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
        ← Back
      </Link>
      <PublicCoachProfile userId={id} />
    </div>
  );
}


