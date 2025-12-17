import React, { useState } from 'react';
import { Loader2, Sparkles, Upload, X, Lightbulb } from 'lucide-react';
import { STYLES, LENGTHS, MORANDI_COLORS } from '../constants';
import { StyleType, LengthType, CoverMode, MemoData } from '../types';
import { generateRelatedTopics } from '../services/geminiService';

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

  const handleApplySuggestion = (suggestion: string) => {
    setTopic(suggestion);
    setSuggestions([]);
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
        {/* 1. Topic */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">1. 笔记话题</label>
          <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：30岁裸辞去大理..."
                className="w-full pl-4 pr-24 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGetSuggestions();
                }}
              />
              <button 
                onClick={handleGetSuggestions}
                disabled={isSuggesting || !topic}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                 {isSuggesting ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
                 <span>灵感</span>
              </button>
          </div>
          
          {/* Suggestions List */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 animate-fadeIn">
                {suggestions.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => handleApplySuggestion(s)}
                        className="text-xs bg-gradient-to-r from-red-50 to-pink-50 text-red-600 px-3 py-1.5 rounded-full border border-red-100 hover:border-red-300 hover:shadow-sm transition-all"
                    >
                        {s}
                    </button>
                ))}
            </div>
          )}
        </div>

        {/* 2. Style */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">2. 内容风格</label>
          <div className="grid grid-cols-2 gap-3">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                  style === s.id ? 'border-red-500 bg-red-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="text-xl mb-1">{s.icon}</div>
                <div className={`font-semibold text-sm ${style === s.id ? 'text-red-600' : 'text-gray-900'}`}>{s.name}</div>
                <div className="text-xs text-gray-500 line-clamp-1">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Cover Generation Method */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
           <label className="block text-sm font-bold text-gray-800 mb-3">3. 封面生成方式</label>
           
           <div className="flex bg-gray-200 p-1 rounded-lg mb-4">
              <button onClick={() => setCoverMode('auto')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${coverMode === 'auto' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>自动生成</button>
              <button onClick={() => setCoverMode('ref')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${coverMode === 'ref' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>参考图</button>
              <button onClick={() => setCoverMode('template')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${coverMode === 'template' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>爆款模板</button>
           </div>

           <div className="animate-fadeIn">
               {/* Reference Image Input */}
               {coverMode === 'ref' && (
                   <div 
                       onClick={() => fileInputRef.current?.click()}
                       className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${referenceImage ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-red-400'}`}
                   >
                       {referenceImage ? (
                           <div className="relative w-full h-32">
                              <img src={referenceImage} alt="ref" className="w-full h-full object-cover rounded-lg" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 rounded-lg group">
                                  <X className="text-white bg-black/50 rounded-full p-1" size={24} onClick={(e) => { e.stopPropagation(); onClearImage(); }} />
                              </div>
                           </div>
                       ) : (
                           <>
                              <Upload className="w-6 h-6 mb-2 text-gray-400" />
                              <span className="text-xs text-gray-500">上传参考图 (Max 5MB)</span>
                           </>
                       )}
                       <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
                   </div>
               )}

               {/* Template Editor */}
               {coverMode === 'template' && (
                   <div className="space-y-3">
                      <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm space-y-2">
                          <label className="text-xs font-bold text-gray-400 block mb-1">模板内容编辑</label>
                          <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="日期" value={memoData.date} onChange={(e) => setMemoData({...memoData, date: e.target.value})} className="bg-gray-50 border border-gray-200 rounded p-1.5 text-xs w-full" />
                              <input type="text" placeholder="地点" value={memoData.location} onChange={(e) => setMemoData({...memoData, location: e.target.value})} className="bg-gray-50 border border-gray-200 rounded p-1.5 text-xs w-full" />
                          </div>
                          
                          {/* Title Color Picker */}
                          <div className="py-2">
                             <label className="text-[10px] font-bold text-gray-400 block mb-1.5 uppercase tracking-wide">标题颜色</label>
                             <div className="flex gap-2.5">
                                 {MORANDI_COLORS.map((c) => (
                                     <button
                                        key={c}
                                        onClick={() => setMemoData({ ...memoData, titleColor: c })}
                                        className={`w-6 h-6 rounded-full border-2 transition-all shadow-sm ${
                                            (memoData.titleColor || '#000000') === c 
                                            ? 'border-gray-900 scale-110 ring-1 ring-gray-300' 
                                            : 'border-transparent hover:scale-110'
                                        }`}
                                        style={{ backgroundColor: c }}
                                        title={c}
                                     />
                                 ))}
                             </div>
                          </div>

                          <textarea placeholder="主标题 (最大字号)" value={memoData.title} onChange={(e) => setMemoData({...memoData, title: e.target.value})} className="bg-gray-50 border border-gray-200 rounded p-2 text-sm w-full font-bold resize-none h-12" />
                          <textarea placeholder="高亮金句 (黄底黑字)" value={memoData.highlight} onChange={(e) => setMemoData({...memoData, highlight: e.target.value})} className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm w-full resize-none h-12" />
                          <textarea placeholder="正文预览内容..." value={memoData.body} onChange={(e) => setMemoData({...memoData, body: e.target.value})} className="bg-gray-50 border border-gray-200 rounded p-2 text-xs w-full h-20 resize-none" />
                           <input type="text" placeholder="底部标签" value={memoData.footer} onChange={(e) => setMemoData({...memoData, footer: e.target.value})} className="bg-gray-50 border border-gray-200 rounded p-1.5 text-xs w-full" />
                      </div>
                   </div>
               )}
           </div>
        </div>

        {/* 4. Length */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">4. 篇幅长度</label>
          <div className="flex flex-col gap-2">
            {LENGTHS.map((l) => (
              <label key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="length"
                  checked={length === l.id}
                  onChange={() => setLength(l.id)}
                  className="w-4 h-4 text-red-500 focus:ring-red-500 border-gray-300 accent-red-500"
                />
                <span className="text-sm text-gray-700">{l.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 animate-pulse">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {/* Generate Button & Progress */}
        <div className="mt-2">
            {loading ? (
                <div className="space-y-2 animate-fadeIn">
                     <div className="w-full h-12 bg-gray-100 rounded-full flex items-center px-4 relative overflow-hidden border border-gray-200">
                         {/* Progress Fill */}
                         <div 
                             className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-red-100 to-pink-100 transition-all duration-300"
                             style={{ width: `${progress}%` }}
                         />
                         {/* Content */}
                         <div className="relative z-10 flex justify-between items-center w-full px-2">
                             <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                                 <Loader2 className="w-4 h-4 animate-spin" />
                                 <span>{getProgressText()}</span>
                             </div>
                             <span className="text-red-600 font-bold text-sm">{Math.round(progress)}%</span>
                         </div>
                     </div>
                </div>
            ) : (
                <button
                    onClick={onGenerate}
                    disabled={!topic}
                    className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold rounded-full shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Sparkles className="w-5 h-5" />
                    立即生成
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;