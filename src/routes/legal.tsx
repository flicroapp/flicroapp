import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal")({
  component: LegalPage,
});

function LegalPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-12 font-sans text-slate-800 selection:bg-blue-200">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-black mb-6">Open-Source Licenses</h1>
        <p className="text-sm text-slate-500 mb-8">
          Flicro is built using the following open-source software:
        </p>
        
        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">React</h3>
            <p>MIT License</p>
          </div>
          <div className="pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">@tanstack/react-router</h3>
            <p>MIT License</p>
          </div>
          <div className="pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">lucide-react</h3>
            <p>ISC License</p>
          </div>
          <div className="pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">firebase</h3>
            <p>Apache License 2.0</p>
          </div>
          <div className="pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Tailwind CSS</h3>
            <p>MIT License</p>
          </div>
        </div>
      </div>
    </div>
  );
}
