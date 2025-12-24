import Link from "next/link";

import { PublicPlayerProfile } from "@/components/profiles/PublicPlayerProfile";

export default async function PlayerPublicProfilePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return (
    <div className="grid gap-6">
      <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
        ← Back
      </Link>
      <PublicPlayerProfile userId={id} />
    </div>
  );
}


