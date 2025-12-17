import React, { useState, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
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
  const [progress, setProgress] = useState(0); // Progress 0-100
  const [imageLoading, setImageLoading] = useState(false);
  
  const [generatedData, setGeneratedData] = useState<GeneratedPost | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [imageExportSuccess, setImageExportSuccess] = useState('');

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Effects ---
  useEffect(() => {
    // Initialize Memo Data with current time
    const now = new Date();
    setMemoData(prev => ({
        ...prev,
        date: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        location: '中国 · 灵感空间',
        title: '在这里生成你的\n爆款笔记封面',
        highlight: '自动提取金句 / 痛点',
        body: '正文内容会自动填充在这里...',
        footer: '生活感悟 | 职场思考'
    }));
  }, []);

  // --- Handlers ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        setError("图片大小不能超过 5MB");
        return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setReferenceImage(result);
      setReferenceImageRaw(result.split(',')[1]);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
      setReferenceImage(null);
      setReferenceImageRaw(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!topic) {
        setError('请输入笔记话题');
        return;
    }
    if (coverMode === 'ref' && !referenceImageRaw) {
        setError('请上传参考图或切换生成方式');
        return;
    }

    setLoading(true);
    setProgress(0);
    setError('');
    setGeneratedData(null);
    if (coverMode !== 'template') setGeneratedImage(null);

    // Simulation Timer
    progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
            // Cap at 90% until done
            if (prev >= 90) return prev;
            // Increment randomly
            return prev + Math.random() * 3;
        });
    }, 200);

    try {
        // 1. Generate Text
        const postData = await generatePostText(topic, style, length, coverMode === 'template');
        setGeneratedData(postData);
        
        // Bump progress to at least 50% after text is done
        setProgress(prev => Math.max(prev, 50));

        // 2. Handle Cover Logic
        if (coverMode === 'template') {
            // Update template data with AI suggestion
            if (postData.cover_summary) {
                setMemoData(prev => ({
                    ...prev,
                    title: postData.cover_summary!.main_title,
                    highlight: postData.cover_summary!.highlight_text,
                    body: postData.cover_summary!.body_preview,
                    footer: style === 'educational' ? '干货分享 | 认知升级' : '生活感悟 | 碎碎念'
                }));
            }
        } else {
            // Generate Image
            setImageLoading(true);
            const imageUrl = await generatePostImage(topic, style, coverMode === 'ref' ? referenceImageRaw! : undefined);
            setGeneratedImage(imageUrl);
        }
        
        // Complete
        setProgress(100);

        // Small delay to show 100% before resetting loading state
        await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err: any) {
        setError(err.message || '生成失败，请重试');
    } finally {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setLoading(false);
        setImageLoading(false);
    }
  };

  // --- Export Handlers ---
  const handleCopyText = () => {
      if (!generatedData) return;
      const text = `${generatedData.title}\n\n${generatedData.content}\n\n${generatedData.tags.join(' ')}`;
      navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownloadCover = async () => {
      if (!coverRef.current || !(window as any).html2canvas) return;
      try {
          const canvas = await (window as any).html2canvas(coverRef.current, {
              useCORS: true,
              scale: 2, // High res
              backgroundColor: "#FBF8F1"
          });
          const link = document.createElement('a');
          link.download = `rednote_cover_${Date.now()}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          setImageExportSuccess('download');
          setTimeout(() => setImageExportSuccess(''), 2000);
      } catch (e) {
          console.error("Export failed", e);
      }
  };

  const handleCopyCover = async () => {
      if (!coverRef.current || !(window as any).html2canvas) return;
      try {
          const canvas = await (window as any).html2canvas(coverRef.current, {
              useCORS: true,
              scale: 2,
              backgroundColor: "#FBF8F1"
          });
          canvas.toBlob(async (blob: Blob | null) => {
              if (blob) {
                  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                  setImageExportSuccess('copy');
                  setTimeout(() => setImageExportSuccess(''), 2000);
              }
          });
      } catch (e) {
          console.error("Copy failed", e);
          setError("复制图片失败，请尝试下载");
      }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden">
        <ControlPanel 
            topic={topic} setTopic={setTopic}
            style={style} setStyle={setStyle}
            length={length} setLength={setLength}
            coverMode={coverMode} setCoverMode={setCoverMode}
            memoData={memoData} setMemoData={setMemoData}
            referenceImage={referenceImage} onImageUpload={handleImageUpload} onClearImage={handleClearImage}
            loading={loading} progress={progress} onGenerate={handleGenerate} error={error}
            fileInputRef={fileInputRef}
        />
        <PreviewPanel 
            loading={loading}
            imageLoading={imageLoading}
            generatedData={generatedData}
            generatedImage={generatedImage}
            coverMode={coverMode}
            memoData={memoData}
            coverRef={coverRef}
            imageExportSuccess={imageExportSuccess}
            copySuccess={copySuccess}
            onCopyText={handleCopyText}
            onCopyCover={handleCopyCover}
            onDownloadCover={handleDownloadCover}
        />
    </div>
  );
};

export default App;