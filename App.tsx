
import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';
import { Sparkles, ShieldCheck, Key, RefreshCw, Rocket } from 'lucide-react';

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
  
  // API 授权状态：Gemini 3 Pro 系列模型必须引导用户选择 Key
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkApiKeyStatus();
    
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

  const checkApiKeyStatus = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
      const hasKey = await aistudio.hasSelectedApiKey();
      setIsAuthorized(hasKey);
    } else {
      // 如果不在 AI Studio 环境，回退到检查环境变量
      setIsAuthorized(!!process.env.API_KEY);
    }
  };

  const handleAuthorize = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.openSelectKey === 'function') {
      await aistudio.openSelectKey();
      // 遵循规范：触发后立即假定成功并进入应用
      setIsAuthorized(true);
      setError('');
    } else {
      setError("当前环境不支持密钥选择，请确保在受支持的容器中运行。");
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
      setProgress(p => {
        if (p >= 95) return p;
        return p + (p < 50 ? 2 : 0.4);
      });
    }, 200);

    try {
      // 1. 文案生成 (Gemini 3 Pro Preview)
      const postData = await generatePostText(topic, style, length, coverMode === 'template');
      setGeneratedData(postData);
      setProgress(60);

      // 2. 封面生成 (Gemini 3 Pro Image Preview)
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
      console.error("Generate Workflow Error:", err.message);
      
      const errorMessages: Record<string, string> = {
        "QUOTA_EXCEEDED": "Gemini API 免费配额已耗尽，请稍后再试或检查您的 Google Cloud 计费账号。",
        "AUTH_INVALID": "API 密钥无效。请尝试重新连接服务或检查密钥权限。",
        "AUTH_NEED_RESET": "授权已过期。请点击下方按钮重新连接服务。",
        "PERMISSION_DENIED": "权限被拒。当前密钥可能未开启 Gemini 3 Pro 模型的使用权限。",
        "AI_EMPTY_RESPONSE": "模型响应内容为空，可能是话题触发了安全过滤，请尝试更换描述。",
        "AUTH_MISSING": "未检测到 API 密钥，请先完成环境连接。"
      };

      if (["AUTH_NEED_RESET", "AUTH_INVALID", "AUTH_MISSING"].includes(err.message)) {
        setIsAuthorized(false);
      }

      setError(errorMessages[err.message] || `生成失败: ${err.message}`);
      setLoading(false);
    } finally {
      clearInterval(progInt);
      setImageLoading(false);
    }
  };

  // 1. 授权引导页
  if (isAuthorized === false) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#fcfcfc] p-6 animate-fadeIn">
        <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl border border-gray-100 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-inner">
            <Sparkles className="w-10 h-10 text-[#ff2442]" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">小红书爆款实验室</h1>
          <p className="text-gray-500 text-sm mb-10 leading-relaxed px-4">
            为了确保生成高质量的高清封面与深度思考文案，请先点击下方按钮连接您的创作服务。
          </p>
          
          <div className="space-y-4">
            <button 
              onClick={handleAuthorize}
              className="w-full py-5 bg-[#ff2442] hover:bg-[#e61d3a] text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg shadow-red-200/50"
            >
              <Rocket size={22} />
              立即连接服务
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 text-gray-400 text-xs flex items-center justify-center gap-2 hover:text-gray-600 transition-colors"
            >
              <RefreshCw size={14} />
              刷新连接状态
            </button>
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 text-[10px] text-gray-300 uppercase tracking-widest font-bold">
            <ShieldCheck size={12} />
            <span>Secure Content Generation</span>
          </div>
          {error && <p className="mt-6 p-4 bg-red-50 text-red-500 text-xs font-medium rounded-xl border border-red-100">{error}</p>}
        </div>
      </div>
    );
  }

  // 2. 初始化加载
  if (isAuthorized === null) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
          <span className="text-xs text-gray-400 font-medium">创作环境初始化...</span>
        </div>
      </div>
    );
  }

  // 3. 应用主体
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
    </div>
  );
};

export default App;
