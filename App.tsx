
import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';
import { ShieldAlert, Key, RefreshCcw } from 'lucide-react';

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<StyleType>('emotional');
  const [length, setLength] = useState<LengthType>('medium');
  const [coverMode, setCoverMode] = useState<CoverMode>('auto');
  const [memoData, setMemoData] = useState<MemoData>({
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    location: '中国 · 灵感创作',
    title: '',
    highlight: '',
    body: '',
    footer: '生活感悟 | 商业思考',
    titleColor: '#000000'
  });

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedData, setGeneratedData] = useState<GeneratedPost | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [imageExportSuccess, setImageExportSuccess] = useState('');
  
  // 授权错误状态
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authErrorType, setAuthErrorType] = useState<'missing' | 'invalid'>('missing');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  const onImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setReferenceImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const onClearImage = () => {
    setReferenceImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      try {
        await window.aistudio.openSelectKey();
        setShowAuthModal(false);
        setError('');
      } catch (e) {
        console.error("Open key selector failed", e);
      }
    }
  };

  const handleGenerate = async () => {
    if (!topic) {
      setError('请输入笔记话题');
      return;
    }
    
    setLoading(true);
    setError('');
    setProgress(10);
    setGeneratedData(null);
    setGeneratedImage(null);

    try {
      // 第一步：生成文案
      setProgress(30);
      const textData = await generatePostText(topic, style, length, coverMode === 'template');
      setGeneratedData(textData);
      setProgress(60);

      // 如果是模板模式，更新备忘录数据
      if (coverMode === 'template' && textData.cover_summary) {
        setMemoData(prev => ({
          ...prev,
          title: textData.cover_summary?.main_title || textData.title,
          highlight: textData.cover_summary?.highlight_text || '',
          body: textData.cover_summary?.body_preview || textData.content.substring(0, 150) + '...',
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
      }

      // 第二步：生成封面
      if (coverMode !== 'template') {
        setImageLoading(true);
        const img = await generatePostImage(topic, style, textData.image_prompt);
        setGeneratedImage(img);
        setImageLoading(false);
      }

      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 500);

    } catch (err: any) {
      console.error("HandleGenerate Error:", err);
      if (err.message === 'API_KEY_NOT_CONFIGURED') {
        setAuthErrorType('missing');
        setShowAuthModal(true);
      } else if (err.message === 'AUTH_FAILED') {
        setAuthErrorType('invalid');
        setShowAuthModal(true);
      } else if (err.message === 'QUOTA_EXCEEDED') {
        setError('生成请求太频繁，请稍后再试');
      } else {
        setError(err.message || '生成过程遇到未知错误，请重试');
      }
      setLoading(false);
      setImageLoading(false);
      setProgress(0);
    }
  };

  const onCopyText = () => {
    if (!generatedData) return;
    const tagStr = generatedData.tags.map(t => `#${t.replace('#','')}`).join(' ');
    const fullText = `${generatedData.title}\n\n${generatedData.content}\n\n${tagStr}`;
    navigator.clipboard.writeText(fullText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const onCopyCover = () => {
    setImageExportSuccess('copy');
    setTimeout(() => setImageExportSuccess(''), 2000);
  };

  const onDownloadCover = () => {
    setImageExportSuccess('download');
    setTimeout(() => setImageExportSuccess(''), 2000);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 overflow-hidden font-sans relative">
      <ControlPanel
        topic={topic} setTopic={setTopic}
        style={style} setStyle={setStyle}
        length={length} setLength={setLength}
        coverMode={coverMode} setCoverMode={setCoverMode}
        memoData={memoData} setMemoData={setMemoData}
        referenceImage={referenceImage}
        onImageUpload={onImageUpload}
        onClearImage={onClearImage}
        loading={loading}
        progress={progress}
        onGenerate={handleGenerate}
        error={error}
        fileInputRef={fileInputRef}
      />
      <PreviewPanel
        loading={loading}
        imageLoading={imageLoading}
        generatedData={generatedData}
        generatedImage={generatedImage || referenceImage}
        coverMode={coverMode}
        memoData={memoData}
        coverRef={coverRef}
        imageExportSuccess={imageExportSuccess}
        copySuccess={copySuccess}
        onCopyText={onCopyText}
        onCopyCover={onCopyCover}
        onDownloadCover={onDownloadCover}
      />

      {/* 授权引导弹窗 */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full shadow-2xl text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 mx-auto ${authErrorType === 'invalid' ? 'bg-orange-50' : 'bg-blue-50'}`}>
              {authErrorType === 'invalid' ? <RefreshCcw className="w-10 h-10 text-orange-500" /> : <Key className="w-10 h-10 text-blue-500" />}
            </div>
            <h2 className="text-2xl font-bold mb-3 text-gray-900">
              {authErrorType === 'invalid' ? 'API 授权已过期' : '连接 AI 文案引擎'}
            </h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              {authErrorType === 'invalid' 
                ? '您选择的 API Key 无法访问模型。这可能是因为项目未开启 Gemini API 或结算账户异常。请点击下方按钮重新连接。' 
                : '爆款文案生成需要连接您的 Gemini API 密钥。点击下方按钮即可快速完成授权。'}
            </p>
            <button 
              onClick={handleOpenKeySelector}
              className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg"
            >
              <Key size={20} />
              立即连接密钥
            </button>
            <div className="mt-6">
               <button onClick={() => setShowAuthModal(false)} className="text-sm text-gray-400 hover:text-gray-600">稍后再说</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
