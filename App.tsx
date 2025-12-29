
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Image as ImageIcon, Mic, MicOff, Send, Layers, ExternalLink, RefreshCw, Trash2, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { Resolution, AspectRatio, GeneratedImage } from './types';

// Extend window for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const App: React.FC = () => {
  // App State
  const [prompt, setPrompt] = useState('');
  const [selectedResolution, setSelectedResolution] = useState<Resolution>('1K');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('1:1');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Voice recording state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setPrompt(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (typeof event.target?.result === 'string') {
              setAttachedImages(prev => [...prev, event.target!.result as string]);
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const generateImage = async () => {
    if (!prompt.trim() && attachedImages.length === 0) {
      setErrorMessage("Please provide a prompt or paste an image.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      // Safely access the API key from the window shim
      const apiKey = (window as any).process?.env?.API_KEY;
      
      if (!apiKey) {
        throw new Error("API Key not found in environment configuration.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const contents: { parts: any[] } = { parts: [] };
      
      // Add all attached images
      attachedImages.forEach(imgData => {
        const base64Data = imgData.split(',')[1];
        const mimeType = imgData.split(';')[0].split(':')[1];
        contents.parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      });

      if (prompt.trim()) {
        contents.parts.push({ text: prompt });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: contents,
        config: {
          imageConfig: {
            aspectRatio: selectedAspectRatio,
            imageSize: selectedResolution
          },
          tools: [{ googleSearch: {} }]
        }
      });

      let foundImageUrl = '';
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          // Find the image part as it may not be the first part
          if (part.inlineData) {
            foundImageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (foundImageUrl) {
        const newImage: GeneratedImage = {
          id: Date.now().toString(),
          url: foundImageUrl,
          prompt: prompt || 'Vision from reference',
          resolution: selectedResolution,
          timestamp: Date.now()
        };
        setHistory(prev => [newImage, ...prev]);
        setPrompt('');
        setAttachedImages([]);
      } else {
        throw new Error("The model did not return an image. Try a different prompt.");
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || err.toString();
      setErrorMessage(errMsg || "Failed to generate image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const clearHistory = () => {
    if (confirm("Clear all generated images?")) {
      setHistory([]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-950 text-zinc-100">
      {/* Sidebar - Control Panel */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-zinc-800 p-6 space-y-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Nano Banana Pro 3</h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* Resolution */}
          <section className="space-y-3">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3 h-3" /> Output Resolution
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['1K', '2K', '4K'] as Resolution[]).map((res) => (
                <button
                  key={res}
                  onClick={() => setSelectedResolution(res)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold transition-all border ${
                    selectedResolution === res 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </section>

          {/* Aspect Ratio */}
          <section className="space-y-3">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-3 h-3" /> Aspect Ratio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['1:1', '3:4', '4:3', '9:16', '16:9'] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setSelectedAspectRatio(ratio)}
                  className={`py-2 px-1 rounded-lg text-xs font-medium transition-all border ${
                    selectedAspectRatio === ratio 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </section>

        </div>

        {history.length > 0 && (
          <div className="pt-8 border-t border-zinc-800">
            <button 
              onClick={clearHistory}
              className="flex items-center gap-2 text-xs text-zinc-600 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Clear History
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen relative overflow-hidden">
        {/* Workspace Display */}
        <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-12 pb-40">
          {history.length === 0 && !isGenerating && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-20">
              <div className="p-10 rounded-full border border-zinc-700 bg-zinc-900">
                <Sparkles className="w-24 h-24 text-zinc-500" />
              </div>
              <div>
                <h2 className="text-2xl font-light italic">Your imagination, rendered in {selectedResolution}</h2>
                <p className="text-sm mt-2">Describe a scene or paste images to begin.</p>
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="max-w-4xl mx-auto w-full aspect-video bg-zinc-900/50 rounded-3xl border border-zinc-800 flex flex-col items-center justify-center gap-4 animate-pulse">
              <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-zinc-300 font-medium">Nano Banana Pro is painting...</p>
                <p className="text-xs text-zinc-500 mt-1">Generating high-fidelity {selectedResolution} results</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-12">
            {history.map((img) => (
              <div key={img.id} className="max-w-4xl mx-auto w-full group animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="relative glass rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl">
                  <img src={img.url} alt={img.prompt} className="w-full h-auto" />
                  <div className="absolute top-6 right-6 flex gap-2">
                    <span className="px-4 py-1.5 bg-black/60 backdrop-blur-xl rounded-full text-[10px] font-black text-white border border-white/10 tracking-widest uppercase shadow-lg">
                      {img.resolution} PRO
                    </span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-8 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex items-center justify-between gap-6">
                      <p className="text-zinc-200 text-sm italic font-light line-clamp-2">"{img.prompt}"</p>
                      <a 
                        href={img.url} 
                        download={`nano-pro-${img.id}.png`}
                        className="flex-shrink-0 p-4 bg-white text-black rounded-full hover:scale-110 active:scale-95 transition-all shadow-xl"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Floating Controls */}
        <div className="absolute bottom-8 inset-x-0 px-6 pointer-events-none">
          <div className="max-w-4xl mx-auto w-full pointer-events-auto">
            <div className="glass rounded-3xl p-3 shadow-2xl border border-white/10 relative flex flex-col gap-2">
              
              {/* Image Previews */}
              {attachedImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 px-1">
                  {attachedImages.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 flex-shrink-0 group">
                      <img src={img} alt={`Attached ${idx}`} className="w-full h-full object-cover rounded-lg border border-white/20" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute -top-1 -right-1 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-white/10 p-0.5 shadow-md"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-3">
                <div className="flex-1 bg-zinc-900/80 rounded-2xl border border-white/5 focus-within:border-indigo-500/50 transition-all p-2 flex items-center gap-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Describe what to create (paste images here)..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-zinc-500 text-sm resize-none py-2 px-3 h-14 min-h-[56px] max-h-40 leading-relaxed"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        generateImage();
                      }
                    }}
                  />
                  <button 
                    onClick={toggleListening}
                    className={`p-3 rounded-xl transition-all ${
                      isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800'
                    }`}
                    title={isListening ? "Stop Listening" : "Speak Prompt"}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </div>
                <button
                  disabled={isGenerating || (!prompt.trim() && attachedImages.length === 0)}
                  onClick={generateImage}
                  className={`p-4 h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${
                    isGenerating || (!prompt.trim() && attachedImages.length === 0)
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-500/40 active:scale-95'
                  }`}
                >
                  {isGenerating ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                </button>
              </div>
            </div>
            {errorMessage && (
              <div className="mt-4 px-4 py-2 bg-red-500/10 border border-red-500/40 rounded-xl text-red-400 text-[10px] font-bold text-center uppercase tracking-widest animate-in fade-in zoom-in">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
