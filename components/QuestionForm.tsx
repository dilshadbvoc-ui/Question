'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Download, FileSpreadsheet, Upload, FileType, BookOpen, FileText } from 'lucide-react';
import LoadingAnimation from './LoadingAnimation';
import clsx from 'clsx';

export default function QuestionForm() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [isDone, setIsDone] = useState(false);

    const [formData, setFormData] = useState({
        course: '',
        specialisation: '',
        subject: '',
        format: 'standard', // 'standard' (100 MCQ) or 'balanced' (48 MCQ + 5 Short + 2 Long)
        language: 'english',
        difficulty: 'medium',
        mode: 'paper', // 'paper' or 'notes'
    });
    const [syllabusFile, setSyllabusFile] = useState<File | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus('Initializing AI...');
        setIsDone(false);

        try {
            const data = new FormData();
            data.append('course', formData.course);
            data.append('specialisation', formData.specialisation);
            data.append('subject', formData.subject);
            data.append('format', formData.format);
            data.append('language', formData.language);
            data.append('difficulty', formData.difficulty);
            data.append('mode', formData.mode);
            if (syllabusFile) {
                data.append('syllabus', syllabusFile);
            }

            await generateQuestions(data);
        } catch (error) {
            console.error('Error generating questions:', error);
            setStatus('Connection failed. Is the server running?');
            setLoading(false);
        }
    };

    const generateQuestions = async (data: FormData) => {
        // This will be replaced by the actual fetch call to our API
        // For now, let's simulate the progress
        const steps = [
            'Analyzing subject matter...',
            syllabusFile ? 'Reading syllabus content...' : 'Searching for relevant topics...',
            'Drafting content...',
            'Reviewing quality...',
            formData.mode === 'paper' ? 'Formatting Excel file...' : 'Structuring Word document...'
        ];

        for (const step of steps) {
            setStatus(step);
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        try {
            // Simulate API call
            const response = await fetch('/api/generate', {
                method: 'POST',
                body: data, // Send FormData directly
            });

            if (!response.ok) {
                throw new Error('Failed to generate');
            }

            // Handle file download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const subject = data.get('subject') as string;
            const format = data.get('format') as string;
            const language = data.get('language') as string;
            const extension = formData.mode === 'paper' ? 'xlsx' : 'docx';
            a.download = `${subject}_${formData.mode === 'paper' ? (format + '_') : ''}${language}_${formData.mode === 'paper' ? 'Paper' : 'Study_Notes'}.${extension}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setLoading(false);
            setIsDone(true);
        } catch (error) {
            throw error; // Re-throw to be caught by handleSubmit
        }
    };

    return (
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Question Generator</h2>
                <p className="text-blue-100 text-sm">Create examination papers instantly with AI</p>
            </div>

            <div className="p-8">
                {!loading && !isDone && (
                    <motion.form
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                        onSubmit={handleSubmit}
                    >
                        <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, mode: 'paper' })}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all",
                                    formData.mode === 'paper' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                <FileText className="w-4 h-4" />
                                Question Paper
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, mode: 'notes' })}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all",
                                    formData.mode === 'notes' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                <BookOpen className="w-4 h-4" />
                                Study Notes
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="course" className="block text-sm font-medium text-gray-700 mb-1">
                                    Course
                                </label>
                                <input
                                    type="text"
                                    id="course"
                                    name="course"
                                    required
                                    placeholder="e.g. B.Tech"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-800 placeholder-gray-400 bg-gray-50 hover:bg-white"
                                    value={formData.course}
                                    onChange={handleChange}
                                />
                            </div>



                            {!['adeeb', 'adeeb-e-mahir', 'adeeb_balanced', 'adeeb_mahir_balanced'].includes(formData.format) && (
                                <div>
                                    <label htmlFor="specialisation" className="block text-sm font-medium text-gray-700 mb-1">
                                        Specialisation
                                    </label>
                                    <input
                                        type="text"
                                        id="specialisation"
                                        name="specialisation"
                                        required
                                        placeholder="e.g. Computer Science"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-800 placeholder-gray-400 bg-gray-50 hover:bg-white"
                                        value={formData.specialisation}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}

                            <div>
                                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                                    Subject
                                </label>
                                <input
                                    type="text"
                                    id="subject"
                                    name="subject"
                                    required
                                    placeholder="e.g. Data Structures"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-800 placeholder-gray-400 bg-gray-50 hover:bg-white"
                                    value={formData.subject}
                                    onChange={handleChange}
                                />
                            </div>

                            <div>
                                <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                                    Language
                                </label>
                                <select
                                    id="language"
                                    name="language"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-800 bg-gray-50 hover:bg-white"
                                    value={formData.language}
                                    onChange={handleChange}
                                >
                                    <option value="english">English</option>
                                    <option value="hindi">Hindi (हिंदी)</option>
                                    <option value="urdu">Urdu (اردو)</option>
                                    <option value="malayalam">Malayalam (മലയാളം)</option>
                                    <option value="tamil">Tamil (தமிழ்)</option>
                                    <option value="arabic">Arabic (العربية)</option>
                                    <option value="kannada">Kannada (ಕನ್ನಡ)</option>
                                    <option value="telugu">Telugu (తెలుగు)</option>
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">
                                        Difficulty Level
                                    </label>
                                    <select
                                        id="difficulty"
                                        name="difficulty"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-800 bg-gray-50 hover:bg-white"
                                        value={formData.difficulty}
                                        onChange={handleChange}
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="format" className="block text-sm font-medium text-gray-700 mb-1">
                                        Format
                                    </label>
                                    <select
                                        id="format"
                                        name="format"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-800 bg-gray-50 hover:bg-white"
                                        value={formData.format}
                                        onChange={handleChange}
                                    >
                                        <option value="standard">Standard (100 MCQs)</option>
                                        <option value="balanced">Balanced</option>
                                        <option value="80mcq">80 MCQ Model</option>
                                        <option value="adeeb">Adeeb - 80 MCQs</option>
                                        <option value="adeeb_balanced">Adeeb - Balanced</option>
                                        <option value="adeeb-e-mahir">Mahir - 80 MCQs</option>
                                        <option value="adeeb_mahir_balanced">Mahir - Balanced</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Upload Syllabus (Optional - PDF/DOCX)
                                </label>
                                <div className={clsx(
                                    "relative border-2 border-dashed rounded-xl p-4 transition-all flex flex-col items-center justify-center gap-2",
                                    syllabusFile ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50"
                                )}>
                                    <input
                                        type="file"
                                        accept=".pdf,.docx,.doc"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                                    />
                                    {syllabusFile ? (
                                        <>
                                            <FileType className="w-8 h-8 text-green-500" />
                                            <span className="text-sm font-medium text-green-700 truncate max-w-full px-2">
                                                {syllabusFile.name}
                                            </span>
                                            <button 
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSyllabusFile(null); }}
                                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                                            >
                                                Remove file
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-gray-400" />
                                            <span className="text-sm text-gray-500 text-center">
                                                Click to upload or drag & drop
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                        >
                            {formData.mode === 'paper' ? <FileSpreadsheet className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                            {formData.mode === 'paper' ? 'Generate Question Paper' : 'Generate Study Notes'}
                        </button>
                    </motion.form>
                )}

                {loading && (
                    <div className="py-8">
                        <LoadingAnimation status={status} />
                    </div>
                )}

                {isDone && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center space-y-6"
                    >
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Download className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800 mb-1">Ready!</h3>
                            <p className="text-gray-500">
                                Your {formData.mode === 'paper' ? 'Excel file' : 'Study Notes'} has been downloaded.
                            </p>
                        </div>

                        <button
                            onClick={() => setIsDone(false)}
                            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                        >
                            Generate Another
                        </button>
                    </motion.div>
                )}
            </div>
        </div >
    );
}
