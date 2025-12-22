import { LegalPageFrame } from "@/components/LegalPageFrame";

export default function LegalPrivacyPage() {
  return (
    <LegalPageFrame title="Privacy Policy">
      <div className="grid gap-3 text-sm text-white/80">
        <p>This Privacy Policy explains how GoEducate collects, uses, and shares information when you use the platform.</p>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-white">1. Information We Collect</summary>
          <div className="mt-2 grid gap-2">
            <p>We may collect account information, profile details, and usage data necessary to operate the Service.</p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">2. How We Use Information</summary>
          <div className="mt-2 grid gap-2">
            <p>We use information to provide the Service, improve features, maintain security, and communicate with you.</p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">3. Sharing</summary>
          <div className="mt-2 grid gap-2">
            <p>
              We may share information with service providers (e.g., hosting, email, payments) and when required by law.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">4. Contact</summary>
          <div className="mt-2 grid gap-2">
            <p>If you have questions about this policy, please use the Contact page.</p>
          </div>
        </details>
      </div>
    </LegalPageFrame>
  );
}


