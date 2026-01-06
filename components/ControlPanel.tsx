
import React, { useState } from 'react';
import { Loader2, Sparkles, Upload, X, Lightbulb, AlertCircle, ExternalLink } from 'lucide-react';
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
        <div className="w-8 h-8 bg-[#ff2442] rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-red-200">小</div>
        <h1 className="text-2xl font-black tracking-tight text-gray-900">爆款笔记生成器</h1>
      </div>

      <div className="space-y-6">
        {/* 1. Topic */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px]">1</span>
            笔记话题
          </label>
          <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：30岁裸辞去大理..."
                className="w-full pl-4 pr-24 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGetSuggestions();
                }}
              />
              <button 
                onClick={handleGetSuggestions}
                disabled={isSuggesting || !topic}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-red-50 text-[#ff2442] text-xs font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                 {isSuggesting ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
                 <span>灵感</span>
              </button>
          </div>
          
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 animate-fadeIn">
                {suggestions.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => handleApplySuggestion(s)}
                        className="text-xs bg-gradient-to-r from-red-50 to-pink-50 text-[#ff2442] px-3 py-2 rounded-full border border-red-100 hover:border-red-300 hover:shadow-sm transition-all"
                    >
                        {s}
                    </button>
                ))}
            </div>
          )}
        </div>

        {/* 2. Style */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px]">2</span>
            内容风格
          </label>
          <div className="grid grid-cols-2 gap-3">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                  style === s.id ? 'border-[#ff2442] bg-red-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="text-2xl mb-1.5">{s.icon}</div>
                <div className={`font-bold text-sm ${style === s.id ? 'text-[#ff2442]' : 'text-gray-900'}`}>{s.name}</div>
                <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Cover */}
        <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
           <label className="block text-sm font-bold text-gray-800 mb-4 flex items-center gap-1.5">
             <span className="w-4 h-4 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px]">3</span>
             封面生成方式
           </label>
           
           <div className="flex bg-gray-200/60 p-1 rounded-xl mb-5">
              <button onClick={() => setCoverMode('auto')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${coverMode === 'auto' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>自动生成</button>
              <button onClick={() => setCoverMode('ref')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${coverMode === 'ref' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>参考图</button>
              <button onClick={() => setCoverMode('template')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${coverMode === 'template' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>爆款模板</button>
           </div>

           <div className="animate-fadeIn">
               {coverMode === 'ref' && (
                   <div 
                       onClick={() => fileInputRef.current?.click()}
                       className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${referenceImage ? 'border-[#ff2442] bg-red-50' : 'border-gray-300 hover:border-[#ff2442] hover:bg-red-50/20'}`}
                   >
                       {referenceImage ? (
                           <div className="relative w-full h-40">
                              <img src={referenceImage} alt="ref" className="w-full h-full object-cover rounded-xl" />
                              <button 
                                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black transition-colors"
                                onClick={(e) => { e.stopPropagation(); onClearImage(); }}
                              >
                                  <X size={16} />
                              </button>
                           </div>
                       ) : (
                           <>
                              <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                                <Upload className="w-6 h-6 text-gray-400" />
                              </div>
                              <span className="text-xs font-bold text-gray-500">上传参考图</span>
                              <p className="text-[10px] text-gray-400 mt-1">AI 将参考构图和色彩风格</p>
                           </>
                       )}
                       <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
                   </div>
               )}

               {coverMode === 'template' && (
                   <div className="space-y-4">
                      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                          <label className="text-[10px] font-black text-gray-400 block mb-1 uppercase tracking-widest">模板内容实时编辑</label>
                          <div className="grid grid-cols-2 gap-3">
                              <input type="text" placeholder="日期" value={memoData.date} onChange={(e) => setMemoData({...memoData, date: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs w-full focus:ring-1 focus:ring-red-100 outline-none" />
                              <input type="text" placeholder="地点" value={memoData.location} onChange={(e) => setMemoData({...memoData, location: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs w-full focus:ring-1 focus:ring-red-100 outline-none" />
                          </div>
                          
                          <div className="py-1">
                             <label className="text-[10px] font-bold text-gray-400 block mb-2 uppercase tracking-wide">标题点缀色</label>
                             <div className="flex gap-3">
                                 {MORANDI_COLORS.map((c) => (
                                     <button
                                        key={c}
                                        onClick={() => setMemoData({ ...memoData, titleColor: c })}
                                        className={`w-7 h-7 rounded-full border-2 transition-all shadow-sm ${
                                            (memoData.titleColor || '#000000') === c 
                                            ? 'border-gray-900 scale-125 ring-2 ring-gray-100' 
                                            : 'border-transparent hover:scale-110'
                                        }`}
                                        style={{ backgroundColor: c }}
                                     />
                                 ))}
                             </div>
                          </div>

                          <textarea placeholder="主标题 (最大字号)" value={memoData.title} onChange={(e) => setMemoData({...memoData, title: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm w-full font-bold resize-none h-14 outline-none" />
                          <textarea placeholder="高亮金句 (黄底黑字)" value={memoData.highlight} onChange={(e) => setMemoData({...memoData, highlight: e.target.value})} className="bg-[#FFE66D]/20 border border-[#FFE66D] rounded-xl p-3 text-sm w-full resize-none h-14 outline-none" />
                          <textarea placeholder="正文预览内容..." value={memoData.body} onChange={(e) => setMemoData({...memoData, body: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs w-full h-24 resize-none outline-none" />
                           <input type="text" placeholder="底部标签" value={memoData.footer} onChange={(e) => setMemoData({...memoData, footer: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs w-full outline-none" />
                      </div>
                   </div>
               )}
           </div>
        </div>

        {/* 4. Length */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px]">4</span>
            篇幅长度
          </label>
          <div className="flex flex-col gap-2">
            {LENGTHS.map((l) => (
              <label key={l.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${length === l.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                <input
                  type="radio"
                  name="length"
                  checked={length === l.id}
                  onChange={() => setLength(l.id)}
                  className="hidden"
                />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${length === l.id ? 'border-white' : 'border-gray-300'}`}>
                   {length === l.id && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="text-sm font-bold">{l.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Error Message with Actions */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-3 animate-fadeIn">
            <div className="flex items-start gap-2.5 text-red-600 text-[13px] leading-relaxed">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="font-medium">
                {error}
              </div>
            </div>
            {error.includes("配额") && (
              <a 
                href="https://aistudio.google.com/app/plan" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-4 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors"
              >
                检查 API 配额 <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {/* Generate Button & Progress */}
        <div className="mt-4 pb-10">
            {loading ? (
                <div className="space-y-2 animate-fadeIn">
                     <div className="w-full h-14 bg-gray-100 rounded-2xl flex items-center px-5 relative overflow-hidden border border-gray-200">
                         <div 
                             className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-red-200 to-red-400 transition-all duration-300 opacity-30"
                             style={{ width: `${progress}%` }}
                         />
                         <div className="relative z-10 flex justify-between items-center w-full">
                             <div className="flex items-center gap-2.5 text-[#ff2442] font-black text-sm">
                                 <Loader2 className="w-4 h-4 animate-spin" />
                                 <span>{getProgressText()}</span>
                             </div>
                             <span className="text-[#ff2442] font-black text-sm">{Math.round(progress)}%</span>
                         </div>
                     </div>
                </div>
            ) : (
                <button
                    onClick={onGenerate}
                    disabled={!topic}
                    className="w-full py-5 bg-gradient-to-br from-[#ff2442] to-[#e61d3a] text-white font-black rounded-2xl shadow-xl shadow-red-200/50 transform active:scale-95 transition-all flex items-center justify-center gap-2.5 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group"
                >
                    <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
                    立即生成爆款
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
