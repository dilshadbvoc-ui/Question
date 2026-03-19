import QuestionForm from '@/components/QuestionForm';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">

        <div className="space-y-6 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Generate Question Papers <span className="text-blue-600">Instantly</span>
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed font-light">
            Just provide the subject details, and our AI will create a comprehensive
            100-question MCQ test paper in Excel format, complete with answer keys.
          </p>

          <div className="flex flex-wrap gap-4 justify-center md:justify-start pt-4 text-sm font-medium text-slate-500">
            <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
              ⚡️ Fast Generation
            </span>
            <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
              📊 Excel Export
            </span>
            <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
              🤖 AI Powered
            </span>
          </div>
        </div>

        <div className="flex justify-center">
          <QuestionForm />
        </div>

      </div>
    </main>
  );
}
