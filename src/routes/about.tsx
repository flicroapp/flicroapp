import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Share2, Shield, Zap } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutMarketingPage,
});

function AboutMarketingPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-200">
      {/* Header */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/flicro-icon.svg" alt="Flicro Logo" className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight text-slate-900">Flicro</span>
          </div>
          <a href="/" className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 transition-colors">
            Open App
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight mb-6">
          Fast, Direct File Transfer.
        </h1>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Flicro is a seamless peer-to-peer file sharing application. Send photos, videos, and documents 
          directly between devices on the same Wi-Fi network without the cloud.
        </p>
        <a href="/" className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-transform hover:scale-105">
          Start Sharing <ArrowRight className="size-5" />
        </a>
      </section>

      {/* Features */}
      <section className="py-16 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Purpose of the Application</h2>
          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Zap className="size-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">Lightning Fast</h3>
              <p className="text-slate-600">Files are transferred directly over your local Wi-Fi network, bypassing slow internet uploads and downloads.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="size-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">Private & Secure</h3>
              <p className="text-slate-600">We do not store your files on our servers. The transfer happens securely point-to-point via WebRTC.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Share2 className="size-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">No Login Required</h3>
              <p className="text-slate-600">While you can sign in to save preferences, core file sharing works instantly without any account or login wall.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center text-slate-500">
        <div className="flex justify-center gap-6 mb-4">
          <a href="/privacy" className="hover:text-slate-900 transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-slate-900 transition-colors">Terms of Service</a>
          <a href="/legal" className="hover:text-slate-900 transition-colors">Licenses</a>
        </div>
        <p>© 2026 Flicro. All rights reserved.</p>
      </footer>
    </div>
  );
}
