import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';
import { Key, AlertCircle, Image as ImageIcon, ShieldCheck } from 'lucide-react';

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
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isKeyMissing, setIsKeyMissing] = useState(false);
  const [imageExportStatus, setImageExportStatus] = useState<'copy' | 'download' | ''>('');
  const [copySuccess, setCopySuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkApiKey();
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

  const checkApiKey = async () => {
    if (!process.env.API_KEY && window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) setIsKeyMissing(true);
    }
  };

  const handleSelectPersonalKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsQuotaExceeded(false);
      setIsKeyMissing(false);
      setError('');
    }
  };

  const handleExportImage = async (action: 'copy' | 'download') => {
    if (!coverRef.current) return;
    try {
      setImageExportStatus(action);
      // @ts-ignore
      const canvas = await html2canvas(coverRef.current, {
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

    setLoading(true);
    setProgress(0);
    setError('');
    setIsQuotaExceeded(false);
    
    const progInt = setInterval(() => setProgress(p => p >= 90 ? p : p + 5), 200);

    try {
      // 1. 生成文案 (Gemini)
      const postData = await generatePostText(topic, style, length, coverMode === 'template');
      setGeneratedData(postData);
      setProgress(50);

      // 2. 处理封面
      if (coverMode === 'template' && postData.cover_summary) {
        setMemoData(prev => ({
          ...prev,
          title: postData.cover_summary!.main_title,
          highlight: postData.cover_summary!.highlight_text,
          body: postData.cover_summary!.body_preview,
        }));
      } else if (coverMode !== 'template') {
        setImageLoading(true);
        // 调用 Pollinations 免费生图
        const img = await generatePostImage(topic, style, postData.image_prompt);
        setGeneratedImage(img);
      }
      
      setProgress(100);
      setTimeout(() => setLoading(false), 500);
    } catch (err: any) {
      console.error(err);
      if (err.message === "API_KEY_MISSING") {
        setIsKeyMissing(true);
      } else if (err.message === "QUOTA_EXCEEDED") {
        setIsQuotaExceeded(true);
        setError("API 配额已耗尽，请稍后再试或更新 Key。");
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

      {isKeyMissing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-fadeIn border border-gray-100 text-center">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <ShieldCheck className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3">配置安全密钥</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              为了保障安全，文案生成需连接您的 Gemini API Key。图片生成已切换为<span className="text-green-600 font-bold">完全免费模式</span>，无需额外配置。
            </p>
            <button 
              onClick={handleSelectPersonalKey}
              className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95"
            >
              <Key size={20} />
              连接文案 API Key
            </button>
          </div>
        </div>
      )}

      {isQuotaExceeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] p-8 max-w-sm w-full shadow-2xl animate-fadeIn border border-gray-100 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">文案生成额度不足</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              Gemini 免费层级的请求频率有限。您可以稍后再试，或连接另一个有效的 API Key。
            </p>
            <button 
              onClick={handleSelectPersonalKey}
              className="w-full py-4 bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
            >
              <Key size={18} />
              更新 API Key
            </button>
            <button 
              onClick={() => setIsQuotaExceeded(false)}
              className="w-full mt-3 py-3 text-gray-400 text-sm font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;