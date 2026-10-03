import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-12 font-sans text-slate-800 selection:bg-blue-200">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-black mb-6">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last Updated: October 4, 2026</p>
        
        <div className="space-y-6 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Introduction</h2>
            <p>
              Welcome to Flicro. We respect your privacy and are committed to protecting your personal data. 
              This privacy policy will inform you as to how we look after your personal data when you visit our 
              application and tell you about your privacy rights and how the law protects you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Data We Collect</h2>
            <p>
              Flicro operates primarily as a peer-to-peer (P2P) file sharing application. 
              <strong> We do not store your files on our servers.</strong> All files transferred using Flicro go 
              directly between devices using encrypted WebRTC connections.
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li><strong>Account Data:</strong> If you choose to sign in using Google, we store your basic profile information (email, name, profile picture) solely for identification purposes within the app.</li>
              <li><strong>Usage Data:</strong> We may collect anonymous analytics (such as connection success rates) to improve network reliability.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. How We Use Your Data</h2>
            <p>
              The minimal data we collect is used exclusively to provide and improve the Flicro service. 
              We do not sell, rent, or trade your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Security</h2>
            <p>
              We have put in place appropriate security measures to prevent your personal data from being accidentally lost, 
              used, or accessed in an unauthorized way. File transfers are encrypted end-to-end.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Contact Us</h2>
            <p>
              If you have any questions about this privacy policy or our privacy practices, please contact us at: <br/>
              <strong>flicroapp@gmail.com</strong>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
