
import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<StyleType>('emotional');
  const [length, setLength] = useState<LengthType>('medium');
  const [coverMode, setCoverMode] = useState<CoverMode>('auto');
  const [memoData, setMemoData] = useState<MemoData>({
    date: '', time: '', location: '', title: '', highlight: '', body: '', footer: ''
  });

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageRaw, setReferenceImageRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState<GeneratedPost | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  // Initialize and check for existing API key selection for Gemini 3 Pro models
  useEffect(() => {
    const now = new Date();
    setMemoData({
      date: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      location: '灵感研究所',
      title: '在这里生成你的\n第一篇爆款笔记',
      highlight: 'AI 赋能，灵感爆发',
      body: '好的内容需要好的排版。\n\n尝试在左侧输入一个话题，让我们开始创作吧！',
      footer: 'RedNote Generator'
    });

    const checkKey = async () => {
      const win = window as any;
      if (win.aistudio && typeof win.aistudio.hasSelectedApiKey === 'function') {
        const has = await win.aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      } else {
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    const win = window as any;
    if (win.aistudio && typeof win.aistudio.openSelectKey === 'function') {
      await win.aistudio.openSelectKey();
      // Assume success after triggering the selection dialog
      setHasApiKey(true);
    }
  };

  const handleGenerate = async () => {
    if (!topic) {
      setError('请输入笔记话题');
      return;
    }

    // Ensure API key is selected when using gemini-3-pro-image-preview
    const win = window as any;
    if (win.aistudio && typeof win.aistudio.hasSelectedApiKey === 'function') {
      const has = await win.aistudio.hasSelectedApiKey();
      if (!has) {
        await win.aistudio.openSelectKey();
        setHasApiKey(true);
      }
    }

    setLoading(true);
    setProgress(5);
    setError('');
    setGeneratedData(null);
    setGeneratedImage(null);
    
    const progInt = setInterval(() => {
      setProgress(p => (p >= 95 ? p : p + (p < 50 ? 2 : 0.4)));
    }, 200);

    try {
      // 1. 生成文案
      const postData = await generatePostText(topic, style, length, coverMode === 'template');
      setGeneratedData(postData);
      setProgress(60);

      // 2. 生成封面
      if (coverMode === 'template' && postData.cover_summary) {
        setMemoData(prev => ({
          ...prev,
          title: postData.cover_summary!.main_title,
          highlight: postData.cover_summary!.highlight_text,
          body: postData.cover_summary!.body_preview,
        }));
      } else if (coverMode !== 'template') {
        setImageLoading(true);
        const img = await generatePostImage(topic, style, coverMode === 'ref' ? referenceImageRaw! : undefined);
        setGeneratedImage(img);
      }
      
      setProgress(100);
      setTimeout(() => setLoading(false), 500);
    } catch (err: any) {
      console.error("Generation error:", err);
      // Handle the specific error for project/key billing issues
      if (err.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("所选 API Key 校验失败（可能由于项目未启用计费），请重新选择。");
      } else if (err.message === "API_KEY_MISSING") {
        setError("API密钥缺失。请在 Vercel 环境变量中设置 API_KEY。");
      } else {
        setError(err.message || "服务暂时不可用，请稍后重试");
      }
      setLoading(false);
    } finally {
      clearInterval(progInt);
      setImageLoading(false);
    }
  };

  // Mandatory splash screen for key selection before accessing the app functionalities
  if (hasApiKey === false) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-8 text-center">
        <div className="w-16 h-16 bg-[#ff2442] rounded-2xl flex items-center justify-center text-white font-black text-2xl mb-6 shadow-2xl">小</div>
        <h1 className="text-2xl font-black mb-4 tracking-tight">开启爆款创作之旅</h1>
        <p className="text-gray-500 mb-8 max-w-sm text-sm leading-relaxed font-medium">
          本应用使用 Gemini 3 Pro 旗舰模型。在使用前，您需要关联一个已启用计费的 API Key 项目。
        </p>
        <button 
          onClick={handleSelectKey}
          className="px-10 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95"
        >
          关联 API Key 项目
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          rel="noreferrer"
          className="mt-8 text-xs text-blue-500 hover:underline font-medium"
        >
          了解计费与配额配置
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-white text-gray-800 overflow-hidden font-sans relative">
      <ControlPanel 
        topic={topic} setTopic={setTopic}
        style={style} setStyle={setStyle}
        length={length} setLength={setLength}
        coverMode={coverMode} setCoverMode={setCoverMode}
        memoData={memoData} setMemoData={setMemoData}
        referenceImage={referenceImage} 
        onImageUpload={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const r = new FileReader();
          r.onloadend = () => {
            setReferenceImage(r.result as string);
            setReferenceImageRaw((r.result as string).split(',')[1]);
          };
          r.readAsDataURL(file);
        }} 
        onClearImage={() => { setReferenceImage(null); setReferenceImageRaw(null); }}
        loading={loading} progress={progress} onGenerate={handleGenerate} error={error}
        fileInputRef={fileInputRef}
      />
      
      <PreviewPanel 
        loading={loading} imageLoading={imageLoading}
        generatedData={generatedData} generatedImage={generatedImage}
        coverMode={coverMode} memoData={memoData} coverRef={coverRef}
        imageExportSuccess={''} copySuccess={false}
        onCopyText={() => {
          if (!generatedData) return;
          const t = `${generatedData.title}\n\n${generatedData.content}\n\n${generatedData.tags.map(t=>t.startsWith('#')?t:`#${t}`).join(' ')}`;
          navigator.clipboard.writeText(t);
        }}
        onCopyCover={() => {}} onDownloadCover={() => {}}
      />
    </div>
  );
};

export default App;
