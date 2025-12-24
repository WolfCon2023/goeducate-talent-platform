import Link from "next/link";

import { PublicEvaluatorProfile } from "@/components/profiles/PublicEvaluatorProfile";

export default async function EvaluatorPublicProfilePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return (
    <div className="grid gap-6">
      <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
        ← Back
      </Link>
      <PublicEvaluatorProfile userId={id} />
    </div>
  );
}


