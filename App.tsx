import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';
import { Key, AlertCircle, Sparkles } from 'lucide-react';

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
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [imageExportStatus, setImageExportStatus] = useState<'copy' | 'download' | ''>('');
  const [copySuccess, setCopySuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    setMemoData(prev => ({
      ...prev,
      date: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      location: '灵感创作室',
      title: '在这里生成你的\n第一篇爆款笔记',
      highlight: 'AI 赋能，灵感爆发',
      body: '好的内容需要好的排版。',
      footer: 'Xiaohongshu Generator'
    }));
  }, []);

  const handleSelectPersonalKey = async () => {
    // Fix: Access aistudio via any to avoid TS error
    if ((window as any).aistudio && typeof (window as any).aistudio.openSelectKey === 'function') {
      try {
        await (window as any).aistudio.openSelectKey();
        // Fix: Assume the key selection was successful after triggering openSelectKey() as per guidelines
        setIsAuthRequired(false);
        setIsQuotaExceeded(false);
        setError('');
      } catch (e) {
        console.error("Open Key Dialog Error:", e);
      }
    }
  };

  const handleExportImage = async (action: 'copy' | 'download') => {
    // Fix: Access html2canvas via any to avoid TS error on window object
    if (!coverRef.current || !(window as any).html2canvas) return;
    try {
      setImageExportStatus(action);
      // Fix: Access html2canvas via any cast to handle dynamic script loading
      const canvas = await (window as any).html2canvas(coverRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FBF8F1'
      });

      if (action === 'download') {
        const link = document.createElement('a');
        link.download = `rednote-cover-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        canvas.toBlob((blob: Blob | null) => {
          if (blob) {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
          }
        });
      }
      setTimeout(() => setImageExportStatus(''), 2000);
    } catch (err) {
      console.error('Export error:', err);
      setImageExportStatus('');
    }
  };

  const handleGenerate = async () => {
    if (!topic) {
      setError('请输入笔记话题');
      return;
    }

    // Fix: Proactively check for API key selection before generation, required for Gemini models
    if ((window as any).aistudio && typeof (window as any).aistudio.hasSelectedApiKey === 'function') {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setIsAuthRequired(true);
        return;
      }
    }

    setLoading(true);
    setProgress(5);
    setError('');
    setIsQuotaExceeded(false);
    setIsAuthRequired(false);
    
    // 长文案进度条更缓慢，提供心理预期
    const speed = length === 'long' ? 100 : 300;
    const progInt = setInterval(() => setProgress(p => p >= 95 ? p : p + 2), speed);

    try {
      // 1. 生成爆款文案
      const postData = await generatePostText(topic, style, length, coverMode === 'template');
      setGeneratedData(postData);
      setProgress(60);

      // 2. 更新封面数据或生成 AI 封面
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
      setTimeout(() => setLoading(false), 300);
    } catch (err: any) {
      console.error("Generate Error Flow:", err);
      const msg = err.message || "";
      
      if (msg === "API_KEY_MISSING" || msg === "AUTH_FAILED") {
        setIsAuthRequired(true);
      } else if (msg === "QUOTA_EXCEEDED") {
        setIsQuotaExceeded(true);
        setError("API 配额已耗尽，请稍后再试或更换 Key。");
      } else {
        setError(msg || '生成失败，请检查网络或重试');
      }
      setLoading(false);
    } finally {
      clearInterval(progInt);
      setImageLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-white text-gray-800 overflow-hidden font-sans">
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
        imageExportSuccess={imageExportStatus} 
        copySuccess={copySuccess}
        onCopyText={() => {
          if (!generatedData) return;
          const t = `${generatedData.title}\n\n${generatedData.content}\n\n${generatedData.tags.join(' ')}`;
          navigator.clipboard.writeText(t).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
          });
        }}
        onCopyCover={() => handleExportImage('copy')}
        onDownloadCover={() => handleExportImage('download')}
      />

      {/* API 授权引导弹窗 */}
      {isAuthRequired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full shadow-2xl text-center border border-gray-100">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <Key className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3">连接 AI 创作引擎</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              为了提供高品质的文案生成体验，我们需要连接您的 Gemini API 密钥。点击下方按钮即可完成安全授权。
            </p>
            <button 
              onClick={handleSelectPersonalKey}
              className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl"
            >
              <Sparkles size={20} />
              立即连接授权
            </button>
            <div className="mt-6">
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-gray-600 underline">
                如何获取付费项目 API Key？
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 配额不足弹窗 */}
      {isQuotaExceeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] p-8 max-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">API 频率限制</h2>
            <p className="text-gray-500 mb-8 text-sm">当前密钥的免费额度已达上限。请稍候片刻再试，或更换已启用计费的项目密钥。</p>
            <div className="space-y-3">
              <button onClick={handleSelectPersonalKey} className="w-full py-3 bg-red-500 text-white font-bold rounded-xl">更换密钥</button>
              <button onClick={() => setIsQuotaExceeded(false)} className="w-full py-3 text-gray-400 font-medium">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;