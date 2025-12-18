import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';
import { Key, AlertCircle, Image as ImageIcon, ShieldAlert } from 'lucide-react';

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
    const aiStudio = (window as any).aistudio;
    if (aiStudio && typeof aiStudio.openSelectKey === 'function') {
      try {
        await aiStudio.openSelectKey();
        setIsAuthRequired(false);
        setIsQuotaExceeded(false);
        setError('');
        // 选择完后自动触发一次生成体验更佳
        if (topic) handleGenerate();
      } catch (e) {
        console.error("Open Key Dialog Error:", e);
      }
    }
  };

  const handleExportImage = async (action: 'copy' | 'download') => {
    const html2canvas = (window as any).html2canvas;
    if (!coverRef.current || !html2canvas) return;
    try {
      setImageExportStatus(action);
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
    setProgress(5);
    setError('');
    setIsQuotaExceeded(false);
    setIsAuthRequired(false);
    
    // 进度条平滑处理
    const speed = length === 'long' ? 120 : 250;
    const progInt = setInterval(() => setProgress(p => p >= 92 ? p : p + (p < 50 ? 5 : 2)), speed);

    try {
      // 1. 生成文案
      const postData = await generatePostText(topic, style, length, coverMode === 'template');
      setGeneratedData(postData);
      setProgress(60);

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
        const img = await generatePostImage(topic, style, coverMode === 'ref' ? referenceImageRaw! : undefined);
        setGeneratedImage(img);
      }
      
      setProgress(100);
      setTimeout(() => setLoading(false), 300);
    } catch (err: any) {
      console.error("Generate Error Flow:", err);
      if (err.message === "AUTH_FAILED" || err.message === "API_KEY_MISSING") {
        setIsAuthRequired(true);
      } else if (err.message === "QUOTA_EXCEEDED") {
        setIsQuotaExceeded(true);
        setError("当前 Key 配额已耗尽。");
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

      {/* 授权失效/密钥泄露弹窗 */}
      {isAuthRequired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full shadow-2xl text-center">
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <ShieldAlert className="w-10 h-10 text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-gray-900">API 密钥已失效</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              原有的 API 密钥可能因泄露被官方禁用或权限不足。为了继续生成爆款笔记，请连接您自己的 Google Gemini API 密钥。
            </p>
            <button 
              onClick={handleSelectPersonalKey}
              className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl"
            >
              <Key size={20} />
              重新连接 API 密钥
            </button>
            <p className="mt-6 text-xs text-gray-400">
              密钥将安全存储在您的浏览器会话中。
            </p>
          </div>
        </div>
      )}

      {/* 配额不足弹窗 */}
      {isQuotaExceeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">API 配额超限</h2>
            <p className="text-gray-500 mb-8 text-sm">当前免费层级的请求频率已达上限。建议稍后再试，或切换到“爆款模板”模式（不消耗生图额度）。</p>
            <div className="space-y-3">
              <button onClick={() => { setCoverMode('template'); setIsQuotaExceeded(false); }} className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl">切换到模板模式</button>
              <button onClick={handleSelectPersonalKey} className="w-full py-3 bg-red-500 text-white font-bold rounded-xl">更换 API 密钥</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;