import { LegalPageFrame } from "@/components/LegalPageFrame";

export default function LegalEulaPage() {
  return (
    <LegalPageFrame title="End User License Agreement (EULA)">
      <div className="grid gap-3 text-sm text-white/80">
        <p>
          This End User License Agreement (&quot;EULA&quot;) governs your access to and use of the GoEducate Talent platform
          (&quot;Service&quot;).
        </p>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-white">1. License Grant</summary>
          <div className="mt-2 grid gap-2">
            <p>GoEducate grants you a limited, non-exclusive, non-transferable, revocable license to use the Service.</p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">2. Restrictions</summary>
          <div className="mt-2 grid gap-2">
            <p>You may not reverse engineer, resell, or misuse the Service, or attempt to gain unauthorized access.</p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">3. Termination</summary>
          <div className="mt-2 grid gap-2">
            <p>We may suspend or terminate access for violations of policies, legal requirements, or security reasons.</p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">4. Disclaimer</summary>
          <div className="mt-2 grid gap-2">
            <p>The Service is provided &quot;as is&quot; without warranties of any kind, to the maximum extent permitted by law.</p>
          </div>
        </details>
      </div>
    </LegalPageFrame>
  );
}


