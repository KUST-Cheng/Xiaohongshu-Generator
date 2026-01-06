
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
      if (coverMode === 'template') return "正在生成内容...";
      return progress < 60 ? "正在撰写爆款文案..." : "正在绘制高清封面...";
  };

  return (
    <div className="w-full p-5 lg:p-6 flex flex-col gap-6 bg-white z-10">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-[#ff2442] rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">小</div>
        <h1 className="text-2xl font-black tracking-tight text-gray-900">爆款笔记生成器</h1>
      </div>

      <div className="space-y-6">
        {/* 1. Topic */}
        <div>
          <label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px]">1</span>
            笔记话题
          </label>
          <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：30岁裸辞去大理..."
                className="w-full pl-4 pr-24 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all font-medium text-sm"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGetSuggestions();
                }}
              />
              <button 
                onClick={handleGetSuggestions}
                disabled={isSuggesting || !topic}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-red-50 text-[#ff2442] text-xs font-bold rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 disabled:opacity-50"
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
                        className="text-[11px] bg-red-50 text-[#ff2442] px-3 py-1.5 rounded-full border border-red-100 hover:border-red-300 transition-all font-bold"
                    >
                        {s}
                    </button>
                ))}
            </div>
          )}
        </div>

        {/* 2. Style */}
        <div>
          <label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px]">2</span>
            内容风格
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                  style === s.id ? 'border-[#ff2442] bg-red-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="text-xl mb-1">{s.icon}</div>
                <div className={`font-black text-xs ${style === s.id ? 'text-[#ff2442]' : 'text-gray-900'}`}>{s.name}</div>
                <div className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Cover */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
           <label className="block text-sm font-black text-gray-800 mb-3 flex items-center gap-1.5">
             <span className="w-4 h-4 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px]">3</span>
             封面模式
           </label>
           
           <div className="flex bg-gray-200/60 p-1 rounded-lg mb-4">
              <button onClick={() => setCoverMode('auto')} className={`flex-1 py-1.5 rounded-md text-[11px] font-black transition-all ${coverMode === 'auto' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>自动生成</button>
              <button onClick={() => setCoverMode('ref')} className={`flex-1 py-1.5 rounded-md text-[11px] font-black transition-all ${coverMode === 'ref' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>参考图</button>
              <button onClick={() => setCoverMode('template')} className={`flex-1 py-1.5 rounded-md text-[11px] font-black transition-all ${coverMode === 'template' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>爆款模板</button>
           </div>

           <div className="animate-fadeIn min-h-[60px]">
               {coverMode === 'ref' && (
                   <div 
                       onClick={() => fileInputRef.current?.click()}
                       className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${referenceImage ? 'border-[#ff2442] bg-red-50' : 'border-gray-300 hover:border-[#ff2442]'}`}
                   >
                       {referenceImage ? (
                           <div className="relative w-full h-32">
                              <img src={referenceImage} alt="ref" className="w-full h-full object-cover rounded-lg" />
                              <button 
                                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black"
                                onClick={(e) => { e.stopPropagation(); onClearImage(); }}
                              >
                                  <X size={14} />
                              </button>
                           </div>
                       ) : (
                           <>
                              <Upload className="w-6 h-6 mb-2 text-gray-400" />
                              <span className="text-[11px] font-bold text-gray-500">点击上传参考图</span>
                           </>
                       )}
                       <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
                   </div>
               )}

               {coverMode === 'template' && (
                   <div className="space-y-3">
                      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-2.5">
                          <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="日期" value={memoData.date} onChange={(e) => setMemoData({...memoData, date: e.target.value})} className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-[11px] w-full outline-none" />
                              <input type="text" placeholder="地点" value={memoData.location} onChange={(e) => setMemoData({...memoData, location: e.target.value})} className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-[11px] w-full outline-none" />
                          </div>
                          
                          <div className="flex gap-2.5 items-center px-1">
                               {MORANDI_COLORS.map((c) => (
                                   <button
                                      key={c}
                                      onClick={() => setMemoData({ ...memoData, titleColor: c })}
                                      className={`w-5 h-5 rounded-full border transition-all ${ (memoData.titleColor || '#000000') === c ? 'ring-2 ring-red-100 border-gray-900 scale-110' : 'border-transparent' }`}
                                      style={{ backgroundColor: c }}
                                   />
                               ))}
                          </div>

                          <textarea placeholder="主标题" value={memoData.title} onChange={(e) => setMemoData({...memoData, title: e.target.value})} className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-xs w-full font-bold resize-none h-12 outline-none" />
                          <textarea placeholder="高亮金句" value={memoData.highlight} onChange={(e) => setMemoData({...memoData, highlight: e.target.value})} className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs w-full resize-none h-12 outline-none font-bold" />
                          <textarea placeholder="正文预览..." value={memoData.body} onChange={(e) => setMemoData({...memoData, body: e.target.value})} className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-[10px] w-full h-20 resize-none outline-none" />
                           <input type="text" placeholder="标签" value={memoData.footer} onChange={(e) => setMemoData({...memoData, footer: e.target.value})} className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-[11px] w-full outline-none" />
                      </div>
                   </div>
               )}
           </div>
        </div>

        {/* 4. Length */}
        <div>
          <label className="block text-sm font-black text-gray-800 mb-2 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px]">4</span>
            字数要求
          </label>
          <div className="space-y-2">
            {LENGTHS.map((l) => (
              <label key={l.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${length === l.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                <input type="radio" name="length" checked={length === l.id} onChange={() => setLength(l.id)} className="hidden" />
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${length === l.id ? 'border-white' : 'border-gray-300'}`}>
                   {length === l.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className="text-xs font-bold">{l.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-600 text-[11px] animate-fadeIn">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span className="font-bold">{error}</span>
          </div>
        )}

        {/* Generate Button */}
        <div className="pt-2 pb-8">
            {loading ? (
                <div className="w-full h-14 bg-gray-50 rounded-xl flex items-center px-4 relative overflow-hidden border border-gray-100">
                    <div className="absolute left-0 top-0 bottom-0 bg-red-50 transition-all duration-300" style={{ width: `${progress}%` }} />
                    <div className="relative z-10 flex justify-between items-center w-full">
                        <div className="flex items-center gap-2 text-[#ff2442] font-black text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{getProgressText()}</span>
                        </div>
                        <span className="text-[#ff2442] font-black text-sm">{Math.round(progress)}%</span>
                    </div>
                </div>
            ) : (
                <button
                    onClick={onGenerate}
                    disabled={!topic}
                    className="w-full py-4.5 bg-[#ff2442] text-white font-black rounded-xl shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
                >
                    <Sparkles size={18} />
                    立即生成爆款内容
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
