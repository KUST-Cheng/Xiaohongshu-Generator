import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';
import { Key, AlertCircle, Image as ImageIcon, ShieldCheck, RefreshCw } from 'lucide-react';

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
  
  // 错误状态管理
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isKeyError, setIsKeyError] = useState(false); // 密钥缺失或失效
  const [keyErrorType, setKeyErrorType] = useState<'missing' | 'invalid'>('missing');

  const [imageExportStatus, setImageExportStatus] = useState<'copy' | 'download' | ''>('');
  const [copySuccess, setCopySuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkApiKeyStatus();
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

  const checkApiKeyStatus = async () => {
    const envKey = process.env.API_KEY;
    const hasEnvKey = envKey && envKey !== "undefined" && envKey.trim() !== "" && envKey !== "YOUR_API_KEY";
    
    if (!hasEnvKey && window.aistudio) {
      const hasSelected = await window.aistudio.hasSelectedApiKey();
      if (!hasSelected) {
        setIsKeyError(true);
        setKeyErrorType('missing');
      }
    }
  };

  const handleSelectPersonalKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // 假设选择后即成功（规避 race condition）
        setIsKeyError(false);
        setIsQuotaExceeded(false);
        setError('');
      } catch (e) {
        console.error("Select key error:", e);
      }
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
    setIsKeyError(false);
    
    const progInt = setInterval(() => setProgress(p => p >= 90 ? p : p + 5), 300);

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
        // 调用免费生图 (Pollinations)
        const img = await generatePostImage(topic, style, postData.image_prompt);
        setGeneratedImage(img);
      }
      
      setProgress(100);
      setTimeout(() => setLoading(false), 500);
    } catch (err: any) {
      console.error("Generate Error Flow:", err);
      
      if (err.message === "API_KEY_MISSING") {
        setIsKeyError(true);
        setKeyErrorType('missing');
      } else if (err.message === "INVALID_API_KEY" || err.message === "API_KEY_NOT_FOUND") {
        setIsKeyError(true);
        setKeyErrorType('invalid');
      } else if (err.message === "QUOTA_EXCEEDED") {
        setIsQuotaExceeded(true);
      } else {
        setError(err.message || '系统繁忙，请重试');
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

      {/* 密钥错误/缺失引导 */}
      {isKeyError && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/90 backdrop-blur-md p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-fadeIn text-center border border-gray-100">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 mx-auto ${keyErrorType === 'invalid' ? 'bg-orange-50' : 'bg-blue-50'}`}>
              {keyErrorType === 'invalid' ? <RefreshCw className="w-10 h-10 text-orange-500" /> : <ShieldCheck className="w-10 h-10 text-blue-500" />}
            </div>
            <h2 className="text-2xl font-bold mb-3">
              {keyErrorType === 'invalid' ? 'API 密钥失效' : '需要连接密钥'}
            </h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              {keyErrorType === 'invalid' 
                ? '您当前使用的 Gemini 密钥似乎已过期或配置错误。请点击下方按钮重新安全连接。' 
                : '文案生成需要连接您的 Gemini API 密钥。图片生成已自动切换至免费引擎。'}
            </p>
            <button 
              onClick={handleSelectPersonalKey}
              className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95"
            >
              <Key size={20} />
              {keyErrorType === 'invalid' ? '重新连接密钥' : '安全连接密钥'}
            </button>
            <button 
              onClick={() => setIsKeyError(false)}
              className="mt-4 text-sm text-gray-400 font-medium hover:text-gray-600"
            >
              暂不生成
            </button>
          </div>
        </div>
      )}

      {/* 配额不足/频率过快 */}
      {isQuotaExceeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] p-8 max-w-sm w-full shadow-2xl animate-fadeIn text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">生成频率过快</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              Gemini 免费版有请求频率限制（每分钟通常仅限 2-15 次）。请稍等 30 秒后重试，或尝试连接另一个 API Key。
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => setIsQuotaExceeded(false)}
                className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl"
              >
                我知道了
              </button>
              <button 
                onClick={handleSelectPersonalKey}
                className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2"
              >
                <Key size={18} />
                更新 API Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;