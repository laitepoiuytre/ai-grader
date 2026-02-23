
import React, { useState, useCallback, useMemo } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { ImageUploader } from './components/ImageUploader';
import { AnswerFileUploader } from './components/AnswerFileUploader';
import { Loader } from './components/Loader';
// Added CloseIcon to imports
import { GithubIcon, SparklesIcon, DownloadIcon, MagicIcon, CheckIcon, ChartBarIcon, PresentationIcon, DocumentTextIcon, CloseIcon } from './components/icons';
import { gradeStudentAnswers, generateStandardAnswerFromImage, summarizeGradingResults } from './services/geminiService';
import { GradingResult, GeneratedStandardAnswer, TokenUsage } from './types';

declare var XLSX: any; 

const UsageStatsBar: React.FC<{ usage: TokenUsage }> = ({ usage }) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-brand-dark/95 backdrop-blur-md border-t border-brand-primary/20 p-2 md:px-8 shadow-[0_-4px_6_px_-1px_rgba(0,0,0,0.3)] z-50 flex flex-col md:flex-row justify-between items-center text-xs md:text-sm text-brand-subtext gap-2">
            <div className="flex gap-4 md:gap-8 items-center flex-wrap justify-center">
                <div className="flex items-center gap-2 bg-brand-primary/10 px-2 py-1 rounded border border-brand-primary/20">
                    <SparklesIcon className="w-3 h-3 text-brand-secondary" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Tokens: <span className="text-brand-text font-mono font-bold">{(usage.promptTokenCount + usage.candidatesTokenCount).toLocaleString()}</span></span>
                </div>
            </div>
            <div className="flex gap-4">
                 <a href="https://ai.google.dev/pricing" target="_blank" rel="noopener noreferrer" className="hover:text-brand-secondary transition-colors underline decoration-brand-secondary/50 text-[10px]">
                    Pricing Specs
                </a>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  // Step 1 states
  const [answerKeyImages, setAnswerKeyImages] = useState<File[]>([]);
  const [answerKeyImageUrls, setAnswerKeyImageUrls] = useState<string[]>([]);
  const [isGeneratingKey, setIsGeneratingKey] = useState<boolean>(false);

  // Step 2 states
  const [standardAnswerFile, setStandardAnswerFile] = useState<File | null>(null);
  const [parsedStandardAnswerJson, setParsedStandardAnswerJson] = useState<string | null>(null);
  const [studentImageFiles, setStudentImageFiles] = useState<File[]>([]);
  const [studentImageUrls, setStudentImageUrls] = useState<string[]>([]);
  const [gradingStatus, setGradingStatus] = useState<string | null>(null);
  const [gradingResult, setGradingResult] = useState<GradingResult[] | null>(null);

  // Step 3 states
  const [analysisFile, setAnalysisFile] = useState<File | null>(null);
  const [analysisData, setAnalysisData] = useState<any[] | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<TokenUsage>({ promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 });

  const updateUsage = (newUsage: TokenUsage | undefined) => {
    if (!newUsage) return;
    setUsageStats(prev => ({
        promptTokenCount: prev.promptTokenCount + (newUsage.promptTokenCount || 0),
        candidatesTokenCount: prev.candidatesTokenCount + (newUsage.candidatesTokenCount || 0),
        totalTokenCount: prev.totalTokenCount + (newUsage.totalTokenCount || 0)
    }));
  };

  // Step 1 Handlers
  const handleAnswerKeyImageUpload = useCallback((files: File[]) => {
      const uniqueNewFiles = files.filter(newFile => !answerKeyImages.some(existingFile => existingFile.name === newFile.name));
      if (uniqueNewFiles.length > 0) {
          setAnswerKeyImages(prev => [...prev, ...uniqueNewFiles]);
          const newUrls = uniqueNewFiles.map(file => URL.createObjectURL(file));
          setAnswerKeyImageUrls(prev => [...prev, ...newUrls]);
          setError(null);
      }
  }, [answerKeyImages]);

  const handleAnswerKeyImageRemove = useCallback((indexToRemove: number) => {
    setAnswerKeyImages(prev => prev.filter((_, index) => index !== indexToRemove));
    setAnswerKeyImageUrls(prev => {
        const urlToRemove = prev[indexToRemove];
        URL.revokeObjectURL(urlToRemove);
        return prev.filter((_, index) => index !== indexToRemove);
    });
  }, []);

  const handleGenerateAnswerKey = async () => {
      if (answerKeyImages.length === 0) return;
      setIsGeneratingKey(true);
      setError(null);
      try {
          const { text: jsonStr, usage } = await generateStandardAnswerFromImage(answerKeyImages);
          updateUsage(usage);
          const parsed = JSON.parse(jsonStr);
          const worksheet = XLSX.utils.json_to_sheet(parsed.answers);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Standard Answers');
          XLSX.writeFile(workbook, 'standard_answer_template.xlsx');
      } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to generate answer key.");
      } finally {
          setIsGeneratingKey(false);
      }
  };

  // Step 2 Handlers
  const handleAnswerFileUpload = useCallback((file: File) => {
    setStandardAnswerFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            setParsedStandardAnswerJson(JSON.stringify(json, null, 2));
        } catch (err) {
            setError("Could not parse the provided answer file.");
        }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleStudentImageUpload = useCallback((newFiles: File[]) => {
    const uniqueNewFiles = newFiles.filter(newFile => !studentImageFiles.some(existingFile => existingFile.name === newFile.name));
    if (uniqueNewFiles.length > 0) {
        setStudentImageFiles(prevFiles => [...prevFiles, ...uniqueNewFiles]);
        setStudentImageUrls(prevUrls => [...prevUrls, ...uniqueNewFiles.map(file => URL.createObjectURL(file))]);
        setGradingResult(null);
    }
  }, [studentImageFiles]);

  const handleStudentImageRemove = useCallback((indexToRemove: number) => {
    setStudentImageFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    setStudentImageUrls(prev => {
        const urlToRemove = prev[indexToRemove];
        if (urlToRemove) URL.revokeObjectURL(urlToRemove);
        return prev.filter((_, index) => index !== indexToRemove);
    });
  }, []);

  const expectedQuestions = useMemo(() => {
    if (!parsedStandardAnswerJson) return [];
    try {
      const data = JSON.parse(parsedStandardAnswerJson);
      return data.map((q: any) => q.question_number).sort((a: string, b: string) => 
        a.localeCompare(b, undefined, { numeric: true })
      );
    } catch (e) {
      return [];
    }
  }, [parsedStandardAnswerJson]);

  const handleDownloadResults = () => {
    if (!gradingResult || expectedQuestions.length === 0) return;
    const flatData = gradingResult.map(studentResult => {
      const row: any = {
        '学生文件名': studentResult.student_identifier,
        '总分': studentResult.total_score,
      };
      expectedQuestions.forEach(qNum => {
        const answer = studentResult.student_answers.find(a => a.question_number === qNum);
        row[`[${qNum}] 得分`] = answer ? answer.score : 0;
        row[`[${qNum}] 置信度`] = answer ? (answer.confidence_score * 100).toFixed(0) + '%' : 'N/A';
        row[`[${qNum}] 证据引用`] = answer ? answer.evidence_quote : '';
        row[`[${qNum}] 批改反馈`] = answer ? answer.feedback : '未找到回答';
        row[`[${qNum}] 非标解法`] = answer ? (answer.is_alternative_solution ? "是" : "否") : '否';
        row[`[${qNum}] 人工复核`] = answer ? (answer.needs_human_review ? "是" : "否") : '否';
      });
      return row;
    });
    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, `AI_Grading_Report_${new Date().getTime()}.xlsx`);
  };

  const handleStartGrading = async () => {
    if (!parsedStandardAnswerJson || studentImageFiles.length === 0) return;
    setGradingStatus("物理专家模型思考中...");
    setError(null);
    setGradingResult(null);
    try {
      const BATCH_SIZE = 5; 
      const CONCURRENCY = 10;
      let allResults: GradingResult[] = [];
      
      const chunks: File[][] = [];
      for (let i = 0; i < studentImageFiles.length; i += BATCH_SIZE) {
        chunks.push(studentImageFiles.slice(i, i + BATCH_SIZE));
      }

      let completedCount = 0;
      const totalChunks = chunks.length;

      // Process in batches of CONCURRENCY
      for (let i = 0; i < totalChunks; i += CONCURRENCY) {
        const currentBatch = chunks.slice(i, i + CONCURRENCY);
        
        const batchPromises = currentBatch.map(async (chunk) => {
          const { text: result, usage } = await gradeStudentAnswers(parsedStandardAnswerJson, chunk);
          updateUsage(usage);
          const parsedJson = JSON.parse(result);
          completedCount++;
          setGradingStatus(`并行批改中: 已完成 ${completedCount} / ${totalChunks} 批次...`);
          
          return parsedJson.results.map((studentResult: GradingResult) => ({
            ...studentResult,
            total_score: studentResult.student_answers.reduce((sum, a) => sum + (a.score || 0), 0)
          }));
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(chunkResults => {
          allResults = [...allResults, ...chunkResults];
        });
      }

      setGradingResult(allResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : '批改过程中发生错误。');
    } finally {
      setGradingStatus(null);
    }
  };

  // Step 3 Handlers
  const handleAnalysisFileUpload = (file: File) => {
    setAnalysisFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            setAnalysisData(json);
        } catch (err) {
            setError("无法读取分析文件。请确保是有效的 Excel 批改报告。");
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRunDeepAnalysis = async () => {
    const dataToUse = analysisData || gradingResult;
    if (!dataToUse) return;
    setIsAnalyzing(true);
    setAnalysisSummary(null);
    try {
        // We pass the data directly. summarizeGradingResults handles the description.
        const { text, usage } = await summarizeGradingResults(dataToUse as any);
        updateUsage(usage);
        setAnalysisSummary(text);
    } catch (err) {
        setError("无法生成学情分析：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleDownloadAnalysisWord = async () => {
    if (!analysisSummary) return;
    
    const lines = analysisSummary.split('\n');
    const children = lines.map(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('# ')) {
            return new Paragraph({ text: trimmedLine.replace('# ', ''), heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } });
        } else if (trimmedLine.startsWith('## ')) {
            return new Paragraph({ text: trimmedLine.replace('## ', ''), heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
        } else if (trimmedLine.startsWith('### ')) {
            return new Paragraph({ text: trimmedLine.replace('### ', ''), heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } });
        } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            return new Paragraph({ 
                children: [new TextRun(trimmedLine.substring(2))],
                bullet: { level: 0 },
                spacing: { after: 80 }
            });
        } else if (/^\d+\. /.test(trimmedLine)) {
            return new Paragraph({ 
                children: [new TextRun(trimmedLine.replace(/^\d+\. /, ''))],
                spacing: { after: 80 }
            });
        }
        return new Paragraph({ 
            children: [new TextRun(line)],
            spacing: { after: 120 }
        });
    });

    const doc = new Document({
        sections: [{
            properties: {},
            children: children,
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Class_Analysis_Report_${new Date().getTime()}.docx`);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col font-sans pb-24">
      <header className="bg-brand-dark/50 backdrop-blur-sm border-b border-brand-primary/20 p-4 shadow-lg sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <MagicIcon className="w-8 h-8 text-brand-secondary" />
            <h1 className="text-2xl font-bold tracking-tight italic">AI Physics Pro Grader</h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-brand-subtext font-mono">
            <GithubIcon className="w-6 h-6 opacity-30" />
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-8 w-full max-w-7xl space-y-12">
        {/* STEP 1 */}
        <section className="bg-brand-dark/30 rounded-xl border border-brand-primary/10 p-6 shadow-sm overflow-hidden">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-brand-secondary">
                <MagicIcon className="w-5 h-5" /> 第一步：数字化标准答案
            </h2>
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-grow min-h-[160px] max-h-[240px] flex flex-col">
                    <ImageUploader 
                        onImageUpload={handleAnswerKeyImageUpload} 
                        imageUrls={answerKeyImageUrls} 
                        onImageRemove={handleAnswerKeyImageRemove} 
                        disabled={isGeneratingKey} 
                    />
                </div>
                <div className="flex flex-col justify-end shrink-0">
                    <button 
                        onClick={handleGenerateAnswerKey} 
                        disabled={answerKeyImages.length === 0 || isGeneratingKey} 
                        className="md:w-64 h-14 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                    >
                        {isGeneratingKey ? <div className="flex items-center justify-center gap-2"><Loader /> 分析中...</div> : '生成结构化 Excel'}
                    </button>
                </div>
            </div>
        </section>

        {/* STEP 2 */}
        <section className="bg-brand-dark/30 rounded-xl border border-brand-primary/10 p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-400">
                <SparklesIcon className="w-5 h-5" /> 第二步：深度专家批改
            </h2>
            <div className="grid md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4 flex flex-col">
                    <div className="space-y-1">
                        <label className="text-xs text-brand-subtext ml-1 font-semibold uppercase tracking-wider">A. 上传标准答案 Excel</label>
                        <AnswerFileUploader onFileUpload={handleAnswerFileUpload} file={standardAnswerFile} onFileRemove={() => {setStandardAnswerFile(null); setParsedStandardAnswerJson(null);}} disabled={!!gradingStatus} />
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-xs text-brand-subtext ml-1 font-semibold uppercase tracking-wider">B. 上传学生答卷</label>
                        <div className="min-h-[200px] max-h-[300px] overflow-hidden rounded-lg">
                            <ImageUploader 
                                onImageUpload={handleStudentImageUpload} 
                                imageUrls={studentImageUrls} 
                                onImageRemove={handleStudentImageRemove} 
                                disabled={!!gradingStatus} 
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleStartGrading} 
                        disabled={!parsedStandardAnswerJson || studentImageFiles.length === 0 || !!gradingStatus} 
                        className="w-full h-16 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl text-lg"
                    >
                        {gradingStatus ? <div className="flex items-center justify-center gap-3"><Loader /> {gradingStatus}</div> : '执行物理逻辑批改'}
                    </button>
                </div>

                <div className="bg-brand-dark/50 rounded-xl border border-brand-primary/10 p-6 flex flex-col items-center justify-center min-h-[460px] relative">
                    {gradingResult ? (
                        <div className="text-center space-y-6 w-full animate-in fade-in zoom-in duration-300">
                            <CheckIcon className="w-24 h-24 text-green-400 mx-auto" />
                            <div>
                                <h3 className="text-2xl font-bold text-white">批改完成</h3>
                                <p className="text-brand-subtext mt-1">
                                    成功处理 <span className="text-brand-secondary font-bold font-mono">{gradingResult.length}</span> 份答卷
                                </p>
                            </div>
                            <button 
                                onClick={handleDownloadResults} 
                                className="w-full max-w-xs bg-green-600 hover:bg-green-500 px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 mx-auto transition-all shadow-lg"
                            >
                                <DownloadIcon className="w-6 h-6" /> 下载批改结果 Excel
                            </button>
                        </div>
                    ) : (
                        <div className="text-center space-y-4 opacity-50">
                            <SparklesIcon className="w-12 h-12 mx-auto text-brand-primary/50" />
                            <p className="text-brand-subtext">等待任务启动</p>
                        </div>
                    )}
                </div>
            </div>
        </section>

        {/* STEP 3 - NEW FEATURE */}
        <section className="bg-brand-dark/30 rounded-xl border border-brand-primary/10 p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">
                <ChartBarIcon className="w-5 h-5" /> 第三步：全班学情深度分析
            </h2>
            <div className="grid md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs text-brand-subtext ml-1 font-semibold uppercase tracking-wider">上传已有的批改结果 Excel (或直接分析上方结果)</label>
                        <AnswerFileUploader 
                            onFileUpload={handleAnalysisFileUpload} 
                            file={analysisFile} 
                            onFileRemove={() => {setAnalysisFile(null); setAnalysisData(null);}} 
                            disabled={isAnalyzing} 
                        />
                    </div>
                    <button 
                        onClick={handleRunDeepAnalysis} 
                        disabled={(!analysisData && !gradingResult) || isAnalyzing}
                        className="w-full h-16 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl text-lg flex items-center justify-center gap-3"
                    >
                        {isAnalyzing ? <><Loader /> 深度分析中...</> : <><PresentationIcon className="w-6 h-6" /> 生成全班学情总结</>}
                    </button>
                </div>

                <div className="bg-brand-dark/50 rounded-xl border border-brand-primary/10 p-6 flex flex-col items-center justify-center min-h-[200px] relative">
                    {!analysisSummary ? (
                         <div className="text-center space-y-2 opacity-50">
                            <ChartBarIcon className="w-10 h-10 mx-auto text-yellow-500/50" />
                            <p className="text-xs text-brand-subtext">上传批改报表后点击生成分析</p>
                         </div>
                    ) : (
                        <div className="w-full text-center py-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-500/20 rounded-full mb-4">
                                <DocumentTextIcon className="w-8 h-8 text-yellow-500" />
                            </div>
                            <h4 className="text-lg font-bold">分析报告已生成</h4>
                            <p className="text-xs text-brand-subtext mb-4">见下方详情面板</p>
                            <button 
                                onClick={() => document.getElementById('analysis-panel')?.scrollIntoView({ behavior: 'smooth' })}
                                className="text-yellow-500 text-sm hover:underline"
                            >
                                立即查看报告 ↓
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </section>

        {analysisSummary && (
            <section id="analysis-panel" className="bg-brand-dark/30 rounded-xl border border-brand-primary/20 p-6 shadow-xl animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-brand-primary/20 pb-4">
                    <div className="flex items-center gap-3">
                        <PresentationIcon className="w-8 h-8 text-brand-secondary" />
                        <h2 className="text-2xl font-bold">全班学情多维总结报告</h2>
                    </div>
                    <button 
                        onClick={handleDownloadAnalysisWord}
                        className="bg-brand-primary/40 hover:bg-brand-primary/60 px-4 py-2 rounded-lg text-xs flex items-center gap-2 border border-brand-primary/20 transition-all"
                    >
                        <DownloadIcon className="w-4 h-4" /> 保存报告 (.docx)
                    </button>
                </div>
                <div className="prose prose-invert max-w-none text-brand-text whitespace-pre-wrap font-sans leading-relaxed text-sm md:text-base">
                    {analysisSummary}
                </div>
            </section>
        )}

        {error && (
            <div className="p-4 bg-red-900/40 border border-red-500/50 rounded-lg text-sm text-red-100 flex items-center gap-3">
                <div className="bg-red-500 rounded-full p-1">
                    {/* Fixed: CloseIcon is now properly imported */}
                    <CloseIcon className="w-3 h-3 text-white" />
                </div>
                <span>{error}</span>
            </div>
        )}
      </main>
      <UsageStatsBar usage={usageStats} />
    </div>
  );
};

export default App;
