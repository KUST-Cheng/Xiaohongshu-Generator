
import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';
import { Sparkles, Key, AlertCircle, ExternalLink } from 'lucide-react';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}

const App: React.FC = () => {
  // 状态定义
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
  
  // 密钥授权状态 - 默认设为 true，因为服务层已提供内置 Key
  const [isAuthorized, setIsAuthorized] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 初始化模板数据
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
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
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
      console.error("Workflow Error:", err);
      
      // 如果出现密钥错误，引导用户
      if (err.message?.includes("API key not valid") || err.message?.includes("INVALID_ARGUMENT")) {
        setError("当前免费接口压力较大或密钥失效，请尝试点击下方“关联密钥”使用您自己的 Key。");
        setIsAuthorized(false); 
      } else if (err.message?.includes("quota") || err.message?.includes("429")) {
        setError("当前接口请求过于频繁，请稍后再试或切换到您的个人 Key。");
      } else {
        setError(err.message || "生成失败，请检查网络后重试");
      }
      setLoading(false);
    } finally {
      clearInterval(progInt);
      setImageLoading(false);
    }
  };

  // 如果被判定未授权（通常是报错后），显示授权引导
  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-6">
        <div className="w-20 h-20 bg-red-500 rounded-3xl flex items-center justify-center text-white mb-8 shadow-2xl animate-bounce">
          <Sparkles size={40} />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-4 text-center">API 密钥需要更新</h1>
        <p className="text-gray-500 text-center max-w-sm mb-10 leading-relaxed font-medium">
          内置免费密钥可能已失效或超出限额。您可以关联自己的 Google AI 密钥以继续享受无限次生成体验。
        </p>
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button 
            onClick={handleOpenKeySelector}
            className="flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-black transition-all active:scale-95"
          >
            <Key size={20} />
            关联个人 API 密钥
          </button>
          
          <button 
            onClick={() => setIsAuthorized(true)}
            className="text-sm text-gray-400 font-bold hover:text-red-500 transition-colors"
          >
            继续尝试使用内置密钥
          </button>
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

export default App;
