import React, { useState } from 'react';
import { Loader2, Sparkles, Upload, X, Lightbulb } from 'lucide-react';
import { STYLES, LENGTHS, MORANDI_COLORS } from '../constants.ts';
import { StyleType, LengthType, CoverMode, MemoData } from '../types.ts';
import { generateRelatedTopics } from '../services/geminiService.ts';

interface Props {
  topic: string;
  setTopic: (v: string) => void;
  style: StyleType;
  setStyle: (v: StyleType) => void;
  length: LengthType;
  setLength: (v: LengthType) => void;
  coverMode: CoverMode;
  setCoverMode: (v: CoverMode) => void;
  memoData: MemoData;
  setMemoData: (v: MemoData) => void;
  referenceImage: string | null;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
  loading: boolean;
  progress: number;
  onGenerate: () => void;
  error: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const ControlPanel: React.FC<Props> = ({
  topic, setTopic, style, setStyle, length, setLength,
  coverMode, setCoverMode, memoData, setMemoData,
  referenceImage, onImageUpload, onClearImage,
  loading, progress, onGenerate, error, fileInputRef
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleGetSuggestions = async () => {
    if (!topic) return;
    setIsSuggesting(true);
    try {
        const results = await generateRelatedTopics(topic);
        setSuggestions(results);
    } catch (e) {
        console.error(e);
    } finally {
        setIsSuggesting(false);
    }
  };

  const getProgressText = () => {
      if (progress === 100) return "生成完成！";
      if (coverMode === 'template') return "正在生成爆款文案...";
      return progress < 50 ? "正在撰写爆款文案..." : "正在绘制高颜值封面...";
  };

  return (
    <div className="w-full lg:w-1/3 p-6 flex flex-col gap-6 bg-white border-r border-gray-200 overflow-y-auto z-10 shadow-lg scrollbar-hide h-screen">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">小</div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">爆款笔记生成器</h1>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">1. 笔记话题</label>
          <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="输入话题，例如：周末去哪儿玩"
                className="w-full pl-4 pr-20 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              />
              <button 
                onClick={handleGetSuggestions}
                disabled={isSuggesting || !topic}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 disabled:opacity-50"
              >
                 {isSuggesting ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
              </button>
          </div>
          
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 animate-fadeIn">
                {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setTopic(s); setSuggestions([]); }} className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded-full border border-red-100">{s}</button>
                ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">2. 内容风格</label>
          <div className="grid grid-cols-2 gap-3">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  style === s.id ? 'border-red-500 bg-red-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="font-semibold text-sm">{s.name}</div>
                <div className="text-[10px] text-gray-400">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
           <label className="block text-sm font-bold text-gray-800 mb-3">3. 封面生成方式</label>
           <div className="flex bg-gray-200 p-1 rounded-lg mb-4 text-xs font-bold">
              <button onClick={() => setCoverMode('auto')} className={`flex-1 py-2 rounded-md ${coverMode === 'auto' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>自动生成</button>
              <button onClick={() => setCoverMode('ref')} className={`flex-1 py-2 rounded-md ${coverMode === 'ref' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>参考图</button>
              <button onClick={() => setCoverMode('template')} className={`flex-1 py-2 rounded-md ${coverMode === 'template' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>爆款模板</button>
           </div>

           <div className="animate-fadeIn">
               {coverMode === 'ref' && (
                   <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer ${referenceImage ? 'border-red-500' : 'border-gray-300'}`}>
                       {referenceImage ? (
                           <div className="relative w-full h-24">
                              <img src={referenceImage} alt="ref" className="w-full h-full object-cover rounded-lg" />
                              <X className="absolute top-1 right-1 text-white bg-black/50 rounded-full p-1" size={20} onClick={(e) => { e.stopPropagation(); onClearImage(); }} />
                           </div>
                       ) : (
                           <><Upload size={20} className="mb-1 text-gray-400" /><span className="text-[10px] text-gray-500">上传参考图</span></>
                       )}
                       <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
                   </div>
               )}

               {coverMode === 'template' && (
                   <div className="space-y-2">
                      <div className="bg-white p-3 rounded-lg border border-gray-100 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="日期" value={memoData.date} onChange={(e) => setMemoData({...memoData, date: e.target.value})} className="bg-gray-50 border rounded p-1.5 text-[10px] w-full" />
                              <input type="text" placeholder="地点" value={memoData.location} onChange={(e) => setMemoData({...memoData, location: e.target.value})} className="bg-gray-50 border rounded p-1.5 text-[10px] w-full" />
                          </div>
                          <div className="flex gap-2 py-1">
                             {MORANDI_COLORS.map((c) => (
                                 <button key={c} onClick={() => setMemoData({ ...memoData, titleColor: c })} className={`w-5 h-5 rounded-full border ${ (memoData.titleColor || '#000000') === c ? 'border-black' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                             ))}
                          </div>
                          <textarea placeholder="主标题" value={memoData.title} onChange={(e) => setMemoData({...memoData, title: e.target.value})} className="bg-gray-50 border rounded p-2 text-xs w-full font-bold h-10" />
                          <textarea placeholder="副标题" value={memoData.highlight} onChange={(e) => setMemoData({...memoData, highlight: e.target.value})} className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs w-full h-10" />
                          <textarea placeholder="正文预览" value={memoData.body} onChange={(e) => setMemoData({...memoData, body: e.target.value})} className="bg-gray-50 border rounded p-2 text-[10px] w-full h-16" />
                      </div>
                   </div>
               )}
           </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">4. 篇幅长度</label>
          <div className="flex flex-col gap-2">
            {LENGTHS.map((l) => (
              <label key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer">
                <input type="radio" checked={length === l.id} onChange={() => setLength(l.id)} className="accent-red-500" />
                <span className="text-xs text-gray-700">{l.name}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg">{error}</div>}

        <div className="mt-2">
            {loading ? (
                <div className="w-full h-12 bg-gray-100 rounded-full flex items-center px-4 relative overflow-hidden border">
                    <div className="absolute left-0 top-0 bottom-0 bg-red-100 transition-all duration-300" style={{ width: `${progress}%` }} />
                    <div className="relative z-10 flex justify-between items-center w-full px-2 text-red-600 font-bold text-xs">
                        <div className="flex items-center gap-2"><Loader2 className="animate-spin" size={14} /><span>{getProgressText()}</span></div>
                        <span>{Math.round(progress)}%</span>
                    </div>
                </div>
            ) : (
                <button onClick={onGenerate} disabled={!topic} className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white font-bold rounded-full shadow-lg active:scale-95 disabled:opacity-50">
                    立即生成
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;