
import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';
import { Key, ShieldAlert } from 'lucide-react';

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
  const [showAuthModal, setShowAuthModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    setMemoData({
      date: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      location: '创作灵感空间',
      title: '在这里生成你的\n第一篇爆款笔记',
      highlight: 'AI 赋能，灵感爆发',
      body: '好的内容需要好的排版。',
      footer: 'Xiaohongshu Generator'
    });
  }, []);

  const handleOpenKeySelector = async () => {
    const aistudio = (window as any).aistudio;
    // 增加兼容性判断
    if (aistudio && typeof aistudio.openSelectKey === 'function') {
      try {
        await aistudio.openSelectKey();
        setShowAuthModal(false);
        setError('');
        if (topic) handleGenerate();
      } catch (e) {
        console.error("Key selector error", e);
      }
    } else {
      // 如果无法打开官方弹窗，提示用户尝试刷新或检查网络
      setError("无法连接授权模块，请尝试刷新页面。");
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
    
    const progressSpeed = length === 'long' ? 150 : 300;
    const progInt = setInterval(() => {
      setProgress(p => (p >= 95 ? p : p + (p < 50 ? 5 : 1)));
    }, progressSpeed);

    try {
      // 默认尝试使用系统部署的 API_KEY 生成
      const postData = await generatePostText(topic, style, length, coverMode === 'template');
      setGeneratedData(postData);
      setProgress(60);

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
      console.error("Generate Flow Error:", err);
      // 只有在明确失败且原因是鉴权时才显示 Modal
      if (err.message === "AUTH_FAILED") {
        setShowAuthModal(true);
      } else {
        setError(err.message || '生成失败，请重试');
      }
      setLoading(false);
    } finally {
      clearInterval(progInt);
      setImageLoading(false);
    }
  };

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
          const t = `${generatedData.title}\n\n${generatedData.content}\n\n${generatedData.tags.join(' ')}`;
          navigator.clipboard.writeText(t);
        }}
        onCopyCover={() => {}} onDownloadCover={() => {}}
      />

      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full shadow-2xl text-center">
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <ShieldAlert className="w-10 h-10 text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-gray-900">需连接您的 API 密钥</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              内置的共享额度已耗尽或失效。请连接您自己的 Google Gemini API 密钥以继续生成。
            </p>
            <button 
              onClick={handleOpenKeySelector}
              className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl"
            >
              <Key size={20} />
              立即连接个人密钥
            </button>
            <div className="mt-6">
               <button onClick={() => setShowAuthModal(false)} className="text-sm text-gray-400">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
