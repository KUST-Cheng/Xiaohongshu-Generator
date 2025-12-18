
import React, { useState, useRef } from 'react';
import ControlPanel from './components/ControlPanel';
import PreviewPanel from './components/PreviewPanel';
import { StyleType, LengthType, CoverMode, MemoData, GeneratedPost } from './types';
import { generatePostText, generatePostImage } from './services/geminiService';

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<StyleType>('emotional');
  const [length, setLength] = useState<LengthType>('medium');
  const [coverMode, setCoverMode] = useState<CoverMode>('auto');
  const [memoData, setMemoData] = useState<MemoData>({
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    location: '中国 · 深度思考',
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

  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    setError('');
    setProgress(10);
    setGeneratedData(null);
    setGeneratedImage(null);

    try {
      // Step 1: Text Generation (Gemini 3 Flash)
      setProgress(20);
      const textData = await generatePostText(topic, style, length, coverMode === 'template');
      setGeneratedData(textData);
      setProgress(60);

      // If Template Mode is selected, populate MemoData from the generated summary
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

      // Step 2: Image Generation (Gemini 2.5 Flash Image)
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
      }, 800);

    } catch (err: any) {
      console.error(err);
      setError(err.message === 'API_KEY_MISSING' ? '未配置有效 API KEY' : (err.message || '生成出错，请重试'));
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
    // Future expansion: Integrate library for HTML-to-Canvas export here.
  };

  const onDownloadCover = () => {
    setImageExportSuccess('download');
    setTimeout(() => setImageExportSuccess(''), 2000);
    // Future expansion: Integrate library for HTML-to-Canvas export here.
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Configuration column */}
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
      {/* Preview and visualization column */}
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
    </div>
  );
};

export default App;
