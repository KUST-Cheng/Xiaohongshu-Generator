import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';
import { Sparkles, Key, AlertCircle, ExternalLink } from 'lucide-react';

// Declare aistudio globally for TypeScript by augmenting the existing AIStudio interface.
// This avoids clashing with existing declarations of 'aistudio' on the Window object.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}

const App: React.FC = () => {
  // State for content
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<StyleType>('emotional');
  const [length, setLength] = useState<LengthType>('medium');
  const [coverMode, setCoverMode] = useState<CoverMode>('auto');
  const [memoData, setMemoData] = useState<MemoData>({
    date: '', time: '', location: '', title: '', highlight: '', body: '', footer: ''
  });

  // State for references and generation results
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageRaw, setReferenceImageRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState<GeneratedPost | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  
  // API Key State
  const [hasCheckedKey, setHasCheckedKey] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Initial template setup
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

    // 2. Check for API Key (Mandatory for Gemini 3 Pro models)
    const initAuth = async () => {
      // First check if a key is already injected (Vercel env)
      if (process.env.API_KEY && process.env.API_KEY.length > 5) {
        setIsAuthorized(true);
        setHasCheckedKey(true);
        return;
      }

      // If not, check aistudio bridge
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setIsAuthorized(hasKey);
        } catch (e) {
          console.warn("Auth check failed", e);
        }
      }
      setHasCheckedKey(true);
    };
    
    initAuth();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success as per guidelines to mitigate race condition
      setIsAuthorized(true);
    }
  };

  const handleGenerate = async () => {
    if (!topic) {
      setError('请输入笔记话题');
      return;
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
      // 1. Generate Text content
      const postData = await generatePostText(topic, style, length, coverMode === 'template');
      setGeneratedData(postData);
      setProgress(60);

      // 2. Generate Cover (AI Image or Template sync)
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
      console.error("Workflow Error:", err);
      
      // Handle the specific error mentioned in guidelines
      if (err.message?.includes("Requested entity was not found")) {
        setError("API 密钥无效或未找到，请点击下方重新关联密钥。");
        setIsAuthorized(false); // Reset to show the key button
      } else if (err.message?.includes("quota")) {
        setError("API 调用配额已用完，请检查您的 Google Cloud 计费账号。");
      } else {
        setError(err.message || "生成失败，请重试");
      }
      setLoading(false);
    } finally {
      clearInterval(progInt);
      setImageLoading(false);
    }
  };

  if (!hasCheckedKey) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  // If not authorized, show the mandatory key selection view
  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-6">
        <div className="w-20 h-20 bg-red-500 rounded-3xl flex items-center justify-center text-white mb-8 shadow-2xl animate-bounce">
          <Sparkles size={40} />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-4 text-center">开启灵感之门</h1>
        <p className="text-gray-500 text-center max-w-sm mb-10 leading-relaxed font-medium">
          本应用基于 Gemini 3 Pro 高级模型构建。为了享受极致生成体验，请先关联您的 API 密钥。
        </p>
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button 
            onClick={handleOpenKeySelector}
            className="flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-black transition-all active:scale-95"
          >
            <Key size={20} />
            关联 API 密钥
          </button>
          
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center justify-center gap-2 text-xs text-blue-500 font-bold hover:underline py-2"
          >
            <ExternalLink size={14} />
            查看计费说明文档
          </a>
        </div>
        
        <div className="mt-12 p-4 bg-yellow-50 border border-yellow-100 rounded-xl max-w-sm flex gap-3 text-xs text-yellow-700 leading-normal">
          <AlertCircle size={20} className="shrink-0" />
          <p>如果您已经在 Vercel 设置了 API_KEY 但仍看到此页面，请点击上方按钮重新选择一个活跃的 Google Cloud 项目密钥。</p>
        </div>
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

// Simple loader helper for the auth state
const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
  <svg className={className} width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default App;