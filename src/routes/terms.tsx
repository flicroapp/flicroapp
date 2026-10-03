import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-12 font-sans text-slate-800 selection:bg-blue-200">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-black mb-6">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-8">Last Updated: October 4, 2026</p>
        
        <div className="space-y-6 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using Flicro, you agree to be bound by these Terms of Service. 
              If you disagree with any part of the terms, then you may not access the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Description of Service</h2>
            <p>
              Flicro is a tool designed to facilitate direct peer-to-peer file transfers between your devices. 
              We provide the signaling infrastructure to connect devices, but the actual file data is transferred 
              directly between the sender and receiver without passing through or being stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. User Responsibilities</h2>
            <p>
              You are entirely responsible for the content you transmit through Flicro. You agree not to use the service to:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>Share illegal, copyrighted, or malicious material.</li>
              <li>Attempt to disrupt or compromise the integrity of the service.</li>
              <li>Engage in any activity that violates local or international laws.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Limitation of Liability</h2>
            <p>
              Flicro is provided "as is" without any warranties, expressed or implied. 
              We do not guarantee that the service will be uninterrupted or error-free. 
              In no event shall Flicro be liable for any data loss, damages, or issues arising from the use of the service.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Changes to Terms</h2>
            <p>
              We reserve the right to modify or replace these Terms at any time. We will try to provide at least 
              30 days notice prior to any new terms taking effect.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
