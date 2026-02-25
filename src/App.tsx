/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  FileText, 
  Trash2, 
  Sparkles, 
  Printer, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Newspaper,
  Download,
  FileSpreadsheet,
  Link as LinkIcon,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import { processCurrentAffairs, NewsItem } from './services/gemini.ts';
import { useEffect } from 'react';

const API_BASE = 'https://editorial-ai.onrender.com';

interface UploadedFile {
  id: string;
  name: string;
  data: string;
  mimeType: string;
}

export default function App() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isUpdatingSheet, setIsUpdatingSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkGoogleStatus();
    
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsGoogleConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkGoogleStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/status`, { credentials: 'include' });
      const data = await res.json();
      setIsGoogleConnected(data.connected);
    } catch (err) {
      console.error("Failed to check Google status", err);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/google/url`, { credentials: 'include' });
      const { url } = await res.json();
      window.open(url, 'google_oauth', 'width=600,height=700');
    } catch (err) {
      setError("Failed to start Google connection");
    }
  };

  const handleUpdateSheet = async () => {
    if (!result) return;
    
    setIsUpdatingSheet(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sheets/update`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: result })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update sheet");
      }
      
      confetti({
        particleCount: 100,
        spread: 50,
        origin: { y: 0.8 },
        colors: ['#10b981', '#34d399', '#6ee7b7']
      });
      alert("Successfully updated Google Sheet!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdatingSheet(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    Array.from(selectedFiles).forEach(file => {
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are supported.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFiles(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            data: base64,
            mimeType: file.type
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
    setError(null);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      const output = await processCurrentAffairs(files);
      setResult(output && output.length > 0 ? output : null);
      if (output && output.length > 0) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#5A5A40', '#A8A196', '#1a1a1a']
        });
      } else {
        setError('No exam-relevant content found in the uploaded documents.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while processing the files.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    if (!result) return;

    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const fileName = `Daily_Digest_${new Date().toISOString().split('T')[0]}.html`;

    const contentHtml = result.map(item => `
        <div class="news-item">
            <h2>${item.title} – ${item.subTitle}</h2>
            <div class="meta" style="text-align: left; margin-bottom: 16px;">Date: ${item.date}</div>
            <p><strong>${item.headline}</strong></p>
            <ul>
                ${item.content.map(point => `<li>${point}</li>`).join('')}
            </ul>
            <div class="static-gk">
                <strong>Static GK:</strong>
                ${item.staticGk.length > 0 
                    ? `<ul>${item.staticGk.map(gk => `<li>${gk}</li>`).join('')}</ul>` 
                    : 'Not applicable'}
            </div>
        </div>
        <hr style="border: 0; border-top: 1px dashed #e7e5e4; margin: 40px 0;">
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Digest - ${dateStr}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Inter:wght@100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: "Inter", sans-serif;
            background-color: #f5f5f0;
            color: #1c1917;
            margin: 0;
            padding: 40px 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 60px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
            min-height: 297mm;
        }
        header {
            border-bottom: 4px solid #1c1917;
            padding-bottom: 32px;
            margin-bottom: 48px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }
        h1 {
            font-family: "Cormorant Garamond", serif;
            font-size: 48px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.05em;
            margin: 0;
            line-height: 0.9;
        }
        .subtitle {
            font-family: "Cormorant Garamond", serif;
            font-style: italic;
            font-size: 18px;
            color: #57534e;
            margin-top: 8px;
        }
        .meta {
            text-align: right;
            font-family: "JetBrains Mono", monospace;
            font-size: 12px;
            color: #a8a29e;
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }
        .content {
            font-family: "Inter", sans-serif;
        }
        .content h2 {
            font-family: "Cormorant Garamond", serif;
            font-weight: bold;
            color: #1c1917;
            margin-bottom: 16px;
            margin-top: 32px;
            border-bottom: 1px solid #f5f5f4;
            padding-bottom: 8px;
        }
        .content p {
            margin-bottom: 16px;
            color: #292524;
        }
        .content ul {
            list-style: none;
            padding-left: 0;
            margin-bottom: 24px;
        }
        .content li {
            position: relative;
            padding-left: 24px;
            margin-bottom: 8px;
            color: #44403c;
        }
        .content li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: #a8a29e;
            font-weight: bold;
        }
        .static-gk {
            background: #f9f8f6;
            padding: 16px;
            border-radius: 8px;
            margin-top: 16px;
        }
        footer {
            margin-top: 80px;
            padding-top: 32px;
            border-top: 1px solid #e7e5e4;
            text-align: center;
            font-family: "Cormorant Garamond", serif;
            font-style: italic;
            color: #a8a29e;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; padding: 0; width: 100%; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>The Daily Digest</h1>
                <div class="subtitle">Curated Current Affairs for Competitive Excellence</div>
            </div>
            <div class="meta">
                Edition: ${dateStr}
            </div>
        </header>
        <div class="content">
            ${contentHtml}
        </div>
        <footer>
            End of Daily Digest. Success follows consistency.
        </footer>
    </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcel = () => {
    if (!result) return;

    const data = result.map(item => ({
      'Section': item.title,
      'Sub-Section': item.subTitle,
      'Date': item.date,
      'Headline': item.headline,
      'Content': item.content.join('\n'),
      'Static GK': item.staticGk.length > 0 ? item.staticGk.join('\n') : 'Not applicable'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Current Affairs");

    // Adjust column widths
    const wscols = [
      { wch: 30 }, // Section
      { wch: 30 }, // Sub-Section
      { wch: 20 }, // Date
      { wch: 40 }, // Headline
      { wch: 60 }, // Content
      { wch: 40 }, // Static GK
    ];
    worksheet['!cols'] = wscols;

    const fileName = `Daily_Digest_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar - Controls */}
      <aside className="w-full md:w-96 bg-stone-100 border-r border-stone-200 p-6 flex flex-col no-print">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-stone-900 p-2 rounded-lg">
            <Newspaper className="w-6 h-6 text-stone-50" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold tracking-tight">Editorial AI</h1>
            <p className="text-xs text-stone-500 uppercase tracking-widest font-medium">Current Affairs Formatter</p>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {/* Google Sheets Section */}
          <section className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                Google Sheets Sync
              </label>
              <div className={`w-2 h-2 rounded-full ${isGoogleConnected ? 'bg-emerald-500' : 'bg-stone-300'}`}></div>
            </div>
            
            {!isGoogleConnected ? (
              <button
                onClick={handleConnectGoogle}
                className="w-full py-2 px-4 bg-stone-900 text-stone-50 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all"
              >
                <LinkIcon className="w-4 h-4" />
                Connect Google Account
              </button>
            ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold uppercase tracking-widest">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </div>
            )}
          </section>

          {/* Upload Section */}
          <section>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
              Source Documents
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-stone-400 hover:bg-stone-200/50 transition-all group"
            >
              <FileUp className="w-8 h-8 mx-auto mb-3 text-stone-400 group-hover:text-stone-600 transition-colors" />
              <p className="text-sm font-medium text-stone-600">Click to upload PDFs</p>
              <p className="text-xs text-stone-400 mt-1">Daily Current Affairs Files</p>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf"
                multiple
                className="hidden"
              />
            </div>
          </section>

          {/* File List */}
          <AnimatePresence>
            {files.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    Queue ({files.length})
                  </label>
                  <button 
                    onClick={() => setFiles([])}
                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2">
                  {files.map(file => (
                    <motion.div 
                      key={file.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-sm group"
                    >
                      <FileText className="w-4 h-4 text-stone-400" />
                      <span className="text-sm text-stone-700 truncate flex-1 font-medium">{file.name}</span>
                      <button 
                        onClick={() => removeFile(file.id)}
                        className="text-stone-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </AnimatePresence>

          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 space-y-3">
          <button
            onClick={handleProcess}
            disabled={files.length === 0 || isProcessing}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              isProcessing 
                ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                : 'bg-stone-900 text-stone-50 hover:bg-stone-800 shadow-lg shadow-stone-900/20 active:scale-[0.98]'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Editorial
              </>
            )}
          </button>

          {result && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handlePrint}
                  className="py-4 rounded-xl font-bold border-2 border-stone-900 text-stone-900 flex items-center justify-center gap-2 hover:bg-stone-900 hover:text-stone-50 transition-all active:scale-[0.98]"
                >
                  <Printer className="w-5 h-5" />
                  Print
                </button>
                <button
                  onClick={handleDownloadHtml}
                  className="py-4 rounded-xl font-bold bg-stone-200 text-stone-900 flex items-center justify-center gap-2 hover:bg-stone-300 transition-all active:scale-[0.98]"
                >
                  <Download className="w-5 h-5" />
                  HTML
                </button>
              </div>
              <button
                onClick={handleDownloadExcel}
                className="w-full py-4 rounded-xl font-bold bg-emerald-600 text-white flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-[0.98] shadow-lg shadow-emerald-900/20"
              >
                <FileSpreadsheet className="w-5 h-5" />
                Download Excel
              </button>

              {isGoogleConnected && (
                <button
                  onClick={handleUpdateSheet}
                  disabled={isUpdatingSheet}
                  className="w-full py-4 rounded-xl font-bold bg-stone-900 text-stone-50 flex items-center justify-center gap-2 hover:bg-stone-800 transition-all active:scale-[0.98] shadow-lg shadow-stone-900/20 disabled:opacity-50"
                >
                  {isUpdatingSheet ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                  Update Google Sheet
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content - Preview */}
      <main className="flex-1 bg-stone-200/50 p-4 md:p-12 overflow-y-auto">
        <AnimatePresence mode="wait">
          {!result && !isProcessing ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto no-print"
            >
              <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-6 border border-stone-200">
                <Newspaper className="w-10 h-10 text-stone-300" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-stone-800 mb-3">Ready to Format</h2>
              <p className="text-stone-500 leading-relaxed">
                Upload your current affairs PDFs in the sidebar and click generate to create a clean, exam-ready editorial layout.
              </p>
            </motion.div>
          ) : isProcessing ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center no-print"
            >
              <div className="relative">
                <div className="w-24 h-24 border-4 border-stone-200 border-t-stone-900 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-stone-900 animate-pulse" />
                </div>
              </div>
              <p className="mt-8 font-serif text-xl font-medium text-stone-700">Curating your editorial...</p>
              <p className="text-sm text-stone-400 mt-2">Extracting news, removing ads, and formatting layout</p>
            </motion.div>
          ) : (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="editorial-container"
            >
              {/* Editorial Header */}
              <header className="border-b-4 border-stone-900 pb-8 mb-12 flex justify-between items-end">
                <div>
                  <h2 className="font-serif text-5xl font-black uppercase tracking-tighter text-stone-900">
                    The Daily Digest
                  </h2>
                  <p className="font-serif italic text-lg text-stone-600 mt-2">
                    Curated Current Affairs for Competitive Excellence
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold uppercase tracking-widest text-stone-400">
                    Edition: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  <div className="flex items-center gap-2 justify-end mt-1 text-emerald-600 font-bold text-xs uppercase tracking-widest">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified Exam-Ready
                  </div>
                </div>
              </header>

              {/* Content */}
              <div className="space-y-12">
                {result.map((item, index) => (
                  <div key={index} className="news-block">
                    <div className="flex flex-col mb-4">
                      <div className="flex items-center gap-4 mb-1">
                        <h3 className="font-serif text-2xl font-bold text-stone-900 m-0 border-0 pb-0">
                          {item.title}
                        </h3>
                        <div className="h-px flex-1 bg-stone-100"></div>
                        <span className="font-mono text-xs text-stone-400 font-bold uppercase tracking-widest">
                          {item.date}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                        {item.subTitle}
                      </div>
                    </div>
                    
                    <p className="text-lg font-bold text-stone-950 mb-6 leading-tight">
                      {item.headline}
                    </p>

                    <ul className="list-none pl-0 mb-8 space-y-3">
                      {item.content.map((point, pIndex) => (
                        <li key={pIndex} className="relative pl-6 text-stone-800 leading-relaxed">
                          <span className="absolute left-0 text-stone-400 font-bold">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>

                    <div className="bg-stone-50 p-6 rounded-xl border border-stone-100">
                      <h4 className="font-serif italic text-stone-500 mb-3 text-sm font-bold uppercase tracking-wider">
                        Static GK Context
                      </h4>
                      {item.staticGk.length > 0 ? (
                        <ul className="list-none pl-0 space-y-2">
                          {item.staticGk.map((gk, gIndex) => (
                            <li key={gIndex} className="relative pl-6 text-sm text-stone-600">
                              <span className="absolute left-0 text-stone-300 font-bold">›</span>
                              {gk}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-stone-400 italic">Not applicable for this topic</p>
                      )}
                    </div>

                    {index < result.length - 1 && (
                      <div className="mt-12 flex justify-center">
                        <div className="w-24 h-px bg-stone-100 border-t border-dashed border-stone-200"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <footer className="mt-20 pt-8 border-t border-stone-200 text-center">
                <p className="font-serif italic text-stone-400">
                  End of Daily Digest. Success follows consistency.
                </p>
                <div className="mt-4 flex justify-center gap-8">
                  <div className="h-px w-12 bg-stone-200"></div>
                  <div className="h-px w-12 bg-stone-200"></div>
                  <div className="h-px w-12 bg-stone-200"></div>
                </div>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
