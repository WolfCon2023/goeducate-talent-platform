import { LegalPageFrame } from "@/components/LegalPageFrame";

export default function LegalEulaPage() {
  return (
    <LegalPageFrame title="End User License Agreement (EULA)">
      <div className="grid gap-4 text-sm text-white/80">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">Last updated</div>
          <div className="mt-1 text-sm text-white/80">12/22/2025</div>
          <p className="mt-3">
            This End User License Agreement (&quot;EULA&quot;) governs your access to and use of the GoEducate Talent platform
            and related software, websites, and services (the &quot;Service&quot;).
          </p>
          <p className="mt-2 text-xs text-white/70">
            Template notice: this is a general template intended to be reviewed by counsel and tailored to your organization,
            jurisdiction, and distribution model.
          </p>
        </div>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-white">1. License Grant</summary>
          <div className="mt-2 grid gap-2">
            <p>
              Subject to your compliance with this EULA and the Terms of Service, GoEducate grants you a limited, non-exclusive,
              non-transferable, revocable license to access and use the Service for your internal, lawful purposes.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">2. Ownership</summary>
          <div className="mt-2 grid gap-2">
            <p>
              The Service, including all intellectual property rights, is owned by GoEducate and/or its licensors. Except for
              the limited license above, no rights are granted to you.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">3. Restrictions</summary>
          <div className="mt-2 grid gap-2">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5">
              <li>Copy, modify, or create derivative works of the Service except as permitted by law;</li>
              <li>Reverse engineer, decompile, or attempt to extract source code;</li>
              <li>Sell, sublicense, rent, lease, or otherwise commercially exploit the Service;</li>
              <li>Bypass or disable security or access controls;</li>
              <li>Use the Service to violate law or third-party rights.</li>
            </ul>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">4. Updates & Changes</summary>
          <div className="mt-2 grid gap-2">
            <p>
              We may update the Service (including features, content, and availability) at any time. We may also change or
              discontinue parts of the Service.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">5. Third-Party Components</summary>
          <div className="mt-2 grid gap-2">
            <p>
              The Service may include or rely on third-party services or libraries. Your use of third-party services may be
              subject to their terms and policies.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">6. Termination</summary>
          <div className="mt-2 grid gap-2">
            <p>
              This license is effective until terminated. We may terminate or suspend your license and access if you violate
              this EULA, the Terms of Service, or applicable law, or if required for security reasons.
            </p>
            <p>Upon termination, you must stop using the Service and any rights granted to you will cease.</p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">7. Disclaimer</summary>
          <div className="mt-2 grid gap-2">
            <p>
              To the maximum extent permitted by law, the Service is provided &quot;as is&quot; and &quot;as available&quot;
              without warranties of any kind, whether express, implied, or statutory.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">8. Limitation of Liability</summary>
          <div className="mt-2 grid gap-2">
            <p>
              To the maximum extent permitted by law, GoEducate will not be liable for indirect, incidental, special,
              consequential, or punitive damages arising from or related to the Service.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">9. Governing Law</summary>
          <div className="mt-2 grid gap-2">
            <p>
              Governing law should be set based on your organization’s jurisdiction:
              <span className="font-semibold text-white"> [Insert State]</span>.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">10. Contact</summary>
          <div className="mt-2 grid gap-2">
            <p>
              Questions? Use the in-app Contact page or email <span className="font-semibold text-white">info@goeducateinc.org</span>.
            </p>
          </div>
        </details>
      </div>
    </LegalPageFrame>
  );
}


