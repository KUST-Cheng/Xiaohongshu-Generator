import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';
import { Key, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<StyleType>('emotional');
  const [length, setLength] = useState<LengthType>('medium');
  const [coverMode, setCoverMode] = useState<CoverMode>('auto');
  const [memoData, setMemoData] = useState<MemoData>({
    date: '', time: '', location: '', title: '', highlight: '', body: '', footer: ''
  });

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState<GeneratedPost | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  
  const [isKeyError, setIsKeyError] = useState(false);
  const [keyErrorType, setKeyErrorType] = useState<'missing' | 'invalid'>('missing');
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
    const g = globalThis as any;
    if (g.aistudio && typeof g.aistudio.openSelectKey === 'function') {
      try {
        await g.aistudio.openSelectKey();
        setIsKeyError(false);
        setIsQuotaExceeded(false);
        setError('');
      } catch (e) {
        console.error("Key Selection Failed", e);
      }
    } else {
      alert("当前环境不支持弹出密钥选择器，请检查配置。");
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
    
    const progInt = setInterval(() => setProgress(p => p >= 90 ? p : p + 5), 300);

    try {
      const postData = await generatePostText(topic, style, length, coverMode === 'template');
      setGeneratedData(postData);
      setProgress(50);

      if (coverMode === 'template' && postData.cover_summary) {
        setMemoData(prev => ({
          ...prev,
          title: postData.cover_summary!.main_title,
          highlight: postData.cover_summary!.highlight_text,
          body: postData.cover_summary!.body_preview,
        }));
      } else if (coverMode !== 'template') {
        setImageLoading(true);
        const img = await generatePostImage(topic, style, postData.image_prompt);
        setGeneratedImage(img);
      }
      
      setProgress(100);
      setTimeout(() => setLoading(false), 500);
    } catch (err: any) {
      console.error("App Generation Error:", err);
      if (err.message === "API_KEY_MISSING") {
        setIsKeyError(true);
        setKeyErrorType('missing');
      } else if (err.message === "INVALID_API_KEY") {
        setIsKeyError(true);
        setKeyErrorType('invalid');
      } else if (err.message === "QUOTA_EXCEEDED") {
        setIsQuotaExceeded(true);
      } else {
        setError('生成遇到异常，可能是 API 访问受限');
      }
      setLoading(false);
    } finally {
      clearInterval(progInt);
      setImageLoading(false);
    }
  };

  const handleExportImage = async (action: 'copy' | 'download') => {
    if (!coverRef.current) return;
    const g = globalThis as any;
    const h2c = g.html2canvas;
    if (!h2c) return;

    try {
      setImageExportStatus(action);
      const canvas = await h2c(coverRef.current, { scale: 2, useCORS: true, backgroundColor: '#FBF8F1' });
      if (action === 'download') {
        const link = document.createElement('a');
        link.download = `rednote-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        canvas.toBlob((blob: any) => { 
          if (blob) navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); 
        });
      }
      setTimeout(() => setImageExportStatus(''), 2000);
    } catch (err) {
      setImageExportStatus('');
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
          if (file) {
            const r = new FileReader();
            r.onloadend = () => { setReferenceImage(r.result as string); };
            r.readAsDataURL(file);
          }
        }} 
        onClearImage={() => { setReferenceImage(null); }}
        loading={loading} progress={progress} onGenerate={handleGenerate} error={error}
        fileInputRef={fileInputRef}
      />
      <PreviewPanel 
        loading={loading} imageLoading={imageLoading}
        generatedData={generatedData} generatedImage={generatedImage}
        coverMode={coverMode} memoData={memoData} coverRef={coverRef}
        imageExportSuccess={imageExportStatus} copySuccess={copySuccess}
        onCopyText={() => {
          if (!generatedData) return;
          const t = `${generatedData.title}\n\n${generatedData.content}\n\n${generatedData.tags.join(' ')}`;
          navigator.clipboard.writeText(t).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); });
        }}
        onCopyCover={() => handleExportImage('copy')}
        onDownloadCover={() => handleExportImage('download')}
      />

      {isKeyError && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/90 backdrop-blur-md p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-fadeIn text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 mx-auto ${keyErrorType === 'invalid' ? 'bg-orange-50' : 'bg-blue-50'}`}>
              {keyErrorType === 'invalid' ? <RefreshCw className="w-10 h-10 text-orange-500" /> : <ShieldCheck className="w-10 h-10 text-blue-500" />}
            </div>
            <h2 className="text-2xl font-bold mb-3">{keyErrorType === 'invalid' ? '密钥授权失效' : '连接 AI 文案引擎'}</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              为了保障生成质量，爆款文案生成需要连接 Gemini API 密钥。即使您已配置环境变量，也可能由于前端安全限制需要在此手动连接一次。
            </p>
            <button 
              onClick={handleSelectPersonalKey}
              className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              <Key size={20} />
              立即连接密钥
            </button>
            <button onClick={() => setIsKeyError(false)} className="mt-4 text-xs text-gray-400 font-medium">跳过</button>
          </div>
        </div>
      )}

      {isQuotaExceeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">生成频率受限</h2>
            <p className="text-gray-500 mb-8 text-sm">由于使用免费额度，请求频率受限。请等待 60 秒后再尝试，或连接您的个人密钥。</p>
            <button onClick={() => setIsQuotaExceeded(false)} className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl">确定</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;