
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
  const [isAuthorized, setIsAuthorized] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

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
      setProgress(p => (p >= 95 ? p : p + (p < 40 ? 3 : 0.5)));
    }, 250);

    try {
      const postData = await generatePostText(topic, style, length, coverMode === 'template');
      setGeneratedData(postData);
      setProgress(75);

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
      if (err.message?.includes("API key not valid") || err.message?.includes("INVALID_ARGUMENT")) {
        setError("内置免费额度暂不可用，请点击关联您的个人密钥。");
        setIsAuthorized(false); 
      } else {
        setError(err.message || "生成失败，请重试。建议尝试较短的篇幅或话题。");
      }
      setLoading(false);
    } finally {
      clearInterval(progInt);
      setImageLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white p-6">
        <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center text-white mb-6 shadow-xl animate-bounce">
          <Sparkles size={32} />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">更新密钥</h1>
        <p className="text-gray-500 text-center max-w-sm mb-8 text-sm">
          免费配额有限，为了保证长文本的稳定输出，建议使用您个人的 Google AI API 密钥。
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={handleOpenKeySelector} className="flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-black transition-all">
            <Key size={18} /> 关联 API 密钥
          </button>
          <button onClick={() => setIsAuthorized(true)} className="text-xs text-gray-400 font-bold hover:text-red-500 py-2 transition-colors">
            尝试继续使用免费密钥
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-white text-gray-800 font-sans relative">
      <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-gray-100 h-auto lg:h-screen lg:sticky lg:top-0 overflow-y-auto scrollbar-hide">
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
      </div>
      
      <div className="flex-1 min-h-[600px] lg:h-screen overflow-hidden bg-gray-50">
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
    </div>
  );
};

export default App;
