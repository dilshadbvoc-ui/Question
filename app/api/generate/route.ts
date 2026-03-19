import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import * as XLSX from 'xlsx';
// @ts-ignore
import * as pdf from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export const maxDuration = 60; // 1 minute timeout for Vercel (if supported)

// Initialize Groq API
const groq = new Groq({
    apiKey: (process.env.GROQ_API_KEY || '').trim(),
});
const MODEL_NAME = 'llama3-70b-8192'; // Using super stable model

interface QuestionItem {
    type: 'MCQ' | 'SHORT' | 'LONG';
    question: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctAnswer?: string;
    marks: number;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const course = formData.get('course') as string;
        const specialisation = formData.get('specialisation') as string;
        const subject = formData.get('subject') as string;
        const format = formData.get('format') as string;
        const language = formData.get('language') as string;
        const difficulty = (formData.get('difficulty') as string) || 'medium';
        const mode = (formData.get('mode') as string) || 'paper';
        const syllabusFile = formData.get('syllabus') as File | null;
        
        console.log(`[Generate API] Mode: ${mode}, API Key present: ${!!process.env.GROQ_API_KEY}`);

        let syllabusText = '';
        if (syllabusFile) {
            const bytes = await syllabusFile.arrayBuffer();
            const buffer = Buffer.from(bytes);
            
            if (syllabusFile.name.endsWith('.pdf')) {
                const parsePdf = (pdf as any).default || pdf;
                const pdfData = await parsePdf(buffer);
                syllabusText = pdfData.text;
            } else if (syllabusFile.name.endsWith('.docx')) {
                const result = await mammoth.extractRawText({ buffer });
                syllabusText = result.value;
            } else if (syllabusFile.name.endsWith('.doc')) {
                // Basic attempt for .doc files (though usually requires antiword)
                // For now, let's just treat it as text if possible, or warn
                syllabusText = "Note: Legacy .doc file uploaded. Content extraction may be limited.";
            }
        }

        if (!process.env.GROQ_API_KEY) {
            console.warn('No GROQ_API_KEY found. Returning mock data.');
            
            if (mode === 'notes') {
                const mockNotes = [
                    { title: 'Mock Topic 1', content: 'This is mock content for topic 1. Please set GROQ_API_KEY for real results.' },
                    { title: 'Mock Topic 2', content: 'This is mock content for topic 2. **Bold text** should work.' }
                ];
                const mockBuffer = await generateDocxBuffer(subject, mockNotes);
                return new NextResponse(new Blob([new Uint8Array(mockBuffer)]), {
                    headers: {
                        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'Content-Disposition': `attachment; filename="${subject}_Mock_Notes.docx"`,
                    },
                });
            }

            const isBalanced = format === 'balanced' || format === 'adeeb_balanced' || format === 'adeeb_mahir_balanced';
            const count = (format === '80mcq' || format === 'adeeb' || format === 'adeeb-e-mahir') ? 80 : (isBalanced ? 55 : 100);
            const mockQuestions: QuestionItem[] = generateMockQuestions(count, format);
            const mockBuffer = generateExcelBuffer(mockQuestions);
            return new NextResponse(new Blob([mockBuffer as any]), {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${subject}_${format}_questions.xlsx"`,
                },
            });
        }

        console.log(`[Generate API] Step: Extracting topics...`);
        if (mode === 'notes') {
            const topics = await extractTopics(subject, course, specialisation, language, syllabusText);
            console.log(`[Generate API] Topics found: ${topics.length}`);
            
            // Generate all topics in parallel for Vercel performance
            const topicPromises = topics.map(topic => 
                generateNotesForTopic(topic, subject, course, specialisation, language, difficulty, syllabusText)
                .then(content => ({ title: topic, content }))
            );
            const combinedNotes = await Promise.all(topicPromises);

            console.log(`[Generate API] Generating DOCX buffer...`);
            const docBuffer = await generateDocxBuffer(subject, combinedNotes);
            
            const safeSubject = subject.replace(/[^a-z0-9]/gi, '_');
            console.log(`[Generate API] Success. Returning DOCX.`);
            return new Response(new Uint8Array(docBuffer), {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': `attachment; filename="${safeSubject}_Study_Notes.docx"`,
                },
            });
        }

        let allQuestions: QuestionItem[] = [];

        if (format === 'balanced' || format === 'adeeb_balanced' || format === 'adeeb_mahir_balanced') {
            // Balanced Format: 48 MCQ (1 mark) + 5 Short (4 marks) + 2 Long (6 marks)

            // 1. Generate 48 MCQs
            const mcqs = await generateBatch(48, 'MCQ', subject, course, specialisation, language, difficulty, syllabusText);
            allQuestions = [...allQuestions, ...mcqs];

            // 2. Generate 5 Short questions
            const shortQ = await generateBatch(5, 'SHORT', subject, course, specialisation, language, difficulty, syllabusText);
            allQuestions = [...allQuestions, ...shortQ];

            // 3. Generate 2 Long questions
            const longQ = await generateBatch(2, 'LONG', subject, course, specialisation, language, difficulty, syllabusText);
            allQuestions = [...allQuestions, ...longQ];

        } else if (format === '80mcq' || format === 'adeeb' || format === 'adeeb-e-mahir') {
            // 80 MCQ Format
            allQuestions = await generateBatch(80, 'MCQ', subject, course, specialisation, language, difficulty, syllabusText);
        } else {
            // Standard Format: 100 MCQs
            allQuestions = await generateBatch(100, 'MCQ', subject, course, specialisation, language, difficulty, syllabusText);
        }

        if (allQuestions.length === 0) {
            throw new Error('Failed to generate any questions.');
        }

        const buffer = generateExcelBuffer(allQuestions);

        return new NextResponse(new Blob([buffer as any]), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${subject}_${format}_questions.xlsx"`,
            },
        });

    } catch (error: any) {
        const errorDetails = error.message || 'Unknown error';
        console.error('FULL API ERROR:', error);
        return NextResponse.json({ 
            error: 'Failed to generate content.', 
            details: errorDetails,
            type: error.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}

async function generateBatch(
    count: number, 
    type: 'MCQ' | 'SHORT' | 'LONG', 
    subject: string, 
    course: string, 
    specialisation: string, 
    language: string,
    difficulty: string,
    syllabusText?: string
): Promise<QuestionItem[]> {
    let batchQuestions: QuestionItem[] = [];
    let attempts = 0;
    const maxAttempts = 10;
    const maxBatchSize = type === 'MCQ' ? 25 : 5;

    while (batchQuestions.length < count && attempts < maxAttempts) {
        attempts++;
        const needed = count - batchQuestions.length;
        const currentBatchSize = Math.min(needed, maxBatchSize);

        if (attempts > 1) await new Promise(resolve => setTimeout(resolve, 1000));

        const marks = type === 'MCQ' ? 1 : (type === 'SHORT' ? 4 : 6);
        const typeDesc = type === 'MCQ' ? 'Multiple Choice Questions (MCQs) with 4 options' :
            (type === 'SHORT' ? 'Short Answer Subjective Questions' : 'Long Descriptive Subjective Questions');

        // Map languages to specific script instructions
        const langMap: Record<string, string> = {
            'hindi': 'Hindi (Devanagari script)',
            'urdu': 'Urdu (Nastaliq script)',
            'malayalam': 'Malayalam script',
            'tamil': 'Tamil script',
            'kannada': 'Kannada script',
            'telugu': 'Telugu script',
            'arabic': 'Arabic script',
            'english': 'English'
        };

        const targetLang = langMap[language?.toLowerCase()] || language || 'English';
        const isNonEnglish = targetLang !== 'English';

        const prompt = `Act as an expert academic examiner for ${course} ${specialisation ? `(${specialisation})` : ''}.
        Generate ${currentBatchSize} unique, high-quality ${typeDesc} for the subject: "${subject}".
        
        DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
        
        ${syllabusText ? `SYLLABUS/CONTENT SOURCE:
        """
        ${syllabusText.substring(0, 10000)} 
        """
        IMPORTANT: Your questions MUST be strictly based on the syllabus/content provided above.` : ''}

        CRITICAL INSTRUCTIONS FOR LANGUAGE:
        1. OUTPUT LANGUAGE: You MUST write ALL questions and options in **${targetLang}**.
        2. SCRIPT ENFORCEMENT: ${isNonEnglish ? `Do NOT use English/Latin characters for the content. Use ONLY ${targetLang}.` : 'Use standard English.'}
        3. TRANSLATION: If the subject is technical, translate technical terms appropriately or transliterate them into ${targetLang} only if standard.
        
        Other Requirements:
        1. Academic Rigor: Questions must be challenging for the **${difficulty}** level and curriculum-aligned.
        2. Format: ${type === 'MCQ' ? 'Each question MUST have 4 options and a correct answer.' : 'Subjective questions only (no options needed).'}
        3. Marks: Each question is worth ${marks} marks.
        4. Variety: Cover different topics and cognitive levels (Recall, Application, Analysis) appropriate for **${difficulty}** difficulty.
        
        Output purely a JSON array of objects. Schema:
        ${type === 'MCQ' ? `
        [
          {
            "question": "Question text in ${targetLang}",
            "optionA": "Opt A in ${targetLang}", "optionB": "Opt B in ${targetLang}", "optionC": "Opt C in ${targetLang}", "optionD": "Opt D in ${targetLang}",
            "correctAnswer": "Correct option text in ${targetLang}",
            "type": "MCQ",
            "marks": 1
          }
        ]` : `
        [
          {
            "question": "Question text in ${targetLang}",
            "type": "${type}",
            "marks": ${marks}
          }
        ]`}
        `;

        console.log(`[Generate API] generateBatch: calling Groq for ${type}...`);
        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: MODEL_NAME,
                temperature: 0.7,
                response_format: { type: 'json_object' }
            });

            const text = chatCompletion.choices[0]?.message?.content || '';
            const parsed = JSON.parse(text);
            let questions: any[] = Array.isArray(parsed) ? parsed : (parsed.questions || Object.values(parsed).find(v => Array.isArray(v)) || []);

            const validated = questions.map(q => ({
                ...q,
                type: type,
                marks: marks
            })).filter(q => q.question);

            batchQuestions = [...batchQuestions, ...validated];
        } catch (e) {
            console.error(`Batch error (${type}):`, e);
        }
    }
    return batchQuestions.slice(0, count);
}

function generateExcelBuffer(questions: QuestionItem[]): Buffer {
    // Map to Excel component rows
    const rows = questions.map((q, index) => {
        let fullAnswer = q.correctAnswer || 'N/A';

        if (q.type === 'MCQ' && q.correctAnswer) {
            // Normalize to handle "Option A", "A", "option a" etc.
            const normalized = q.correctAnswer.toLowerCase().replace(/option\s*/, '').trim();

            if (normalized === 'a') fullAnswer = q.optionA || '';
            else if (normalized === 'b') fullAnswer = q.optionB || '';
            else if (normalized === 'c') fullAnswer = q.optionC || '';
            else if (normalized === 'd') fullAnswer = q.optionD || '';
        }

        return {
            'S.No': index + 1,
            'Type': q.type,
            'Marks': q.marks,
            'Question': q.question,
            'Option A': q.optionA || '-',
            'Option B': q.optionB || '-',
            'Option C': q.optionC || '-',
            'Option D': q.optionD || '-',
            'Correct Answer': fullAnswer
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto-width for better visibility
    const colWidth = [
        { wch: 5 }, { wch: 10 }, { wch: 8 }, { wch: 60 },
        { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 30 }
    ];
    worksheet['!cols'] = colWidth;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function generateMockQuestions(count: number, format: string): QuestionItem[] {
    if (format === 'balanced') {
        const items: QuestionItem[] = [];
        // 48 MCQs
        for (let i = 0; i < 48; i++) {
            items.push({
                type: 'MCQ',
                question: `Mock MCQ #${i + 1}`,
                optionA: "Opt A", optionB: "Opt B", optionC: "Opt C", optionD: "Opt D",
                correctAnswer: "Opt A",
                marks: 1
            });
        }
        // 5 Short
        for (let i = 0; i < 5; i++) {
            items.push({
                type: 'SHORT',
                question: `Mock Short Question #${i + 1}`,
                marks: 4
            });
        }
        // 2 Long
        for (let i = 0; i < 2; i++) {
            items.push({
                type: 'LONG',
                question: `Mock Long Question #${i + 1}`,
                marks: 6
            });
        }
        return items;
    }

    return Array.from({ length: count }).map((_, i) => ({
        type: 'MCQ',
        question: `This is a mock question #${i + 1}`,
        optionA: "Mock Option A",
        optionB: "Mock Option B",
        optionC: "Mock Option C",
        optionD: "Mock Option D",
        correctAnswer: "Option A",
        marks: 1
    }));
}

async function extractTopics(subject: string, course: string, specialisation: string, language: string, syllabusText?: string): Promise<string[]> {
    const prompt = `Analyze the subject "${subject}" for ${course}${specialisation ? ` (${specialisation})` : ''}.
    ${syllabusText ? `Based on this syllabus:
    """
    ${syllabusText.substring(0, 5000)}
    """` : ''}
    
    Identify the 2-3 most important and distinct topics or chapters that should be included in a comprehensive study guide.
    Return a JSON object with a key "topics", which is an array of strings.
    Example: { "topics": ["Introduction to Logic", "First-Order Logic"] }
    `;

    console.log(`[Generate API] extractTopics: calling Groq...`);
    const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: MODEL_NAME,
        temperature: 0.3,
        response_format: { type: "json_object" }
    });

    try {
        const content = chatCompletion.choices[0]?.message?.content || '{"topics": []}';
        const parsed = JSON.parse(content);
        const topics = Array.isArray(parsed) ? parsed : (parsed.topics || []);
        return topics.length > 0 ? topics : [subject];
    } catch {
        return [subject]; // Fallback to subject as single topic
    }
}

async function generateNotesForTopic(topic: string, subject: string, course: string, specialisation: string, language: string, difficulty: string, syllabusText?: string): Promise<string> {
    const prompt = `Act as an expert professor for ${course} ${specialisation ? `(${specialisation})` : ''}.
    Your task is to create EXTREMELY IN-DEPTH AND DETAILED study notes for ONE specific topic: "${topic}" of the subject "${subject}".
    
    DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
    
    ${syllabusText ? `Full Syllabus Context for reference:
    """
    ${syllabusText.substring(0, 10000)}
    """` : ''}

    REQUIREMENTS:
    1. EXTREME DETAIL: Provide at least 20-30 paragraphs for this single topic if possible. Go deep into theories, practical applications, and examples.
    2. Structure: Use sub-headings (###) to organize the topic deeply.
    3. Formatting: Use Markdown-like syntax (# for Headings, ## for Subheadings, ** for Bold).
    4. Language: Write entirely in ${language}.
    
    Focus ONLY on "${topic}". The response should be purely the notes content.
    `;

    const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: MODEL_NAME,
        temperature: 0.7,
    });

    return chatCompletion.choices[0]?.message?.content || 'Failed to generate notes for this topic.';
}

async function generateDocxBuffer(subject: string, notes: { title: string; content: string }[]): Promise<Buffer> {
    const sections: any[] = [
        new Paragraph({
            text: `${subject} - Comprehensive Study Guide`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }),
    ];

    for (const section of notes) {
        sections.push(new Paragraph({
            text: section.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            pageBreakBefore: true,
        }));

        const lines = section.content.split('\n');
        for (const line of lines) {
            let processedLine = line.trim();
            if (!processedLine) continue;

            // Handle Headings
            if (processedLine.startsWith('### ')) {
                sections.push(new Paragraph({ text: processedLine.replace('### ', '').replace(/\*/g, ''), heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }));
                continue;
            } else if (processedLine.startsWith('## ')) {
                sections.push(new Paragraph({ text: processedLine.replace('## ', '').replace(/\*/g, ''), heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
                continue;
            } else if (processedLine.startsWith('# ')) {
                // Usually same as section title, but handle if not
                const text = processedLine.replace('# ', '').replace(/\*/g, '');
                if (text.toLowerCase() !== section.title.toLowerCase()) {
                    sections.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
                }
                continue;
            }

            // Handle Bullets/Lists
            let isBullet = false;
            if (processedLine.startsWith('* ') || processedLine.startsWith('- ')) {
                processedLine = processedLine.substring(2);
                isBullet = true;
            }

            // Split line into bold and normal segments
            // Regex to find **text**
            const parts = processedLine.split(/(\*\*.*?\*\*)/g);
            const textRuns: TextRun[] = [];

            for (const part of parts) {
                if (part.startsWith('**') && part.endsWith('**')) {
                    textRuns.push(new TextRun({
                        text: part.replace(/\*\*/g, ''),
                        bold: true,
                    }));
                } else {
                    // Strip any remaining single asterisks commonly used for lists/emphasis
                    textRuns.push(new TextRun(part.replace(/\*/g, '')));
                }
            }

            sections.push(new Paragraph({
                children: textRuns,
                bullet: isBullet ? { level: 0 } : undefined,
                spacing: { before: 100, after: 100 },
            }));
        }
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: sections,
        }],
    });

    const uint8Array = await Packer.toBuffer(doc);
    return Buffer.from(uint8Array);
}
