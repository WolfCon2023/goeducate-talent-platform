import { LegalPageFrame } from "@/components/LegalPageFrame";

export default function LegalTermsPage() {
  return (
    <LegalPageFrame title="Terms of Service">
      <div className="grid gap-3 text-sm text-white/80">
        <p>These Terms of Service govern your use of the GoEducate Talent platform.</p>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-white">1. Eligibility & Accounts</summary>
          <div className="mt-2 grid gap-2">
            <p>You must provide accurate information and keep your account credentials secure.</p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">2. Acceptable Use</summary>
          <div className="mt-2 grid gap-2">
            <p>Do not upload unlawful content, harass others, or attempt to bypass security or access controls.</p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">3. Payments & Subscriptions</summary>
          <div className="mt-2 grid gap-2">
            <p>Paid features (e.g., coach subscriptions or event registration) may be subject to separate terms and policies.</p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">4. Limitation of Liability</summary>
          <div className="mt-2 grid gap-2">
            <p>To the maximum extent permitted by law, GoEducate is not liable for indirect or consequential damages.</p>
          </div>
        </details>
      </div>
    </LegalPageFrame>
  );
}


