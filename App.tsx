
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Image as ImageIcon, Mic, MicOff, Send, Layers, ExternalLink, RefreshCw, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { Resolution, AspectRatio, GeneratedImage } from './types';

// Extend window for Speech Recognition and AI Studio
// Fixed: Using AIStudio interface name and removing readonly to match environment declaration modifiers.
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio: AIStudio;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [selectedResolution, setSelectedResolution] = useState<Resolution>('1K');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('1:1');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isKeySelected, setIsKeySelected] = useState<boolean | null>(null);
  
  // Voice recording state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if API key is selected on mount as mandatory step for Pro models
    const checkKey = async () => {
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setIsKeySelected(hasKey);
        } catch (e) {
          console.error("Error checking key selection:", e);
          setIsKeySelected(false);
        }
      } else {
        // Fallback if environment doesn't provide aistudio (not expected in this context)
        setIsKeySelected(true);
      }
    };
    checkKey();

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

  const handleOpenSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success after opening dialog to prevent race conditions
      setIsKeySelected(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateImage = async () => {
    if (!prompt.trim() && !referenceImage) {
      setErrorMessage("Please provide a prompt or a reference image.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      // Create fresh instance right before call to use the latest API key from the dialog
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const contents: { parts: any[] } = { parts: [] };
      
      if (referenceImage) {
        const base64Data = referenceImage.split(',')[1];
        const mimeType = referenceImage.split(';')[0].split(':')[1];
        contents.parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      }

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
        setReferenceImage(null);
      } else {
        throw new Error("The model did not return an image. Try a different prompt.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        // Reset key selection state and prompt for re-selection on auth errors
        setIsKeySelected(false);
        setErrorMessage("API Authorization expired or invalid project. Please re-select your paid API key.");
      } else {
        setErrorMessage(err.message || "Failed to generate image.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const clearHistory = () => {
    if (confirm("Clear all generated images?")) {
      setHistory([]);
    }
  };

  // Mandatory API Key Selection screen
  if (isKeySelected === false) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full glass rounded-[2.5rem] p-10 border border-white/10 text-center space-y-8 shadow-2xl">
          <div className="mx-auto w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white tracking-tight">Setup Required</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              To use <span className="text-indigo-400 font-semibold">Gemini 3 Pro</span> image generation, you must select an API key from a paid GCP project.
            </p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800 text-left">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-500 leading-normal">
                Make sure billing is enabled for your project. Visit the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">billing documentation</a> for details.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenSelectKey}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-indigo-500/30 active:scale-95 flex items-center justify-center gap-2"
          >
            Select Paid API Key
          </button>
        </div>
      </div>
    );
  }

  // Initial loading state
  if (isKeySelected === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-950 text-zinc-100">
      {/* Sidebar - Control Panel */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-zinc-800 p-6 space-y-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Banana Pro 3</h1>
          </div>
          <button 
            onClick={handleOpenSelectKey} 
            title="Configure API Key"
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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

          {/* Reference Image */}
          <section className="space-y-3">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-3 h-3" /> Reference Source
            </label>
            <div className="relative group">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="ref-img" />
              <label 
                htmlFor="ref-img"
                className={`w-full h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden bg-zinc-900/50 ${
                  referenceImage ? 'border-indigo-500' : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {referenceImage ? (
                  <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-zinc-700 mb-2" />
                    <span className="text-[10px] text-zinc-500 px-4 text-center">Click to upload reference image</span>
                  </>
                )}
              </label>
              {referenceImage && (
                <button 
                  onClick={() => setReferenceImage(null)}
                  className="absolute top-2 right-2 p-1 bg-black/60 backdrop-blur-sm rounded-full text-zinc-300 hover:text-white"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
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
                <p className="text-sm mt-2">Describe a scene or upload an image to begin.</p>
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
            <div className="glass rounded-3xl p-3 flex items-end gap-3 shadow-2xl border border-white/10 relative">
              <div className="flex-1 bg-zinc-900/80 rounded-2xl border border-white/5 focus-within:border-indigo-500/50 transition-all p-2 flex items-center gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Tell Nano Banana Pro what to create..."
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
                disabled={isGenerating || (!prompt.trim() && !referenceImage)}
                onClick={generateImage}
                className={`p-4 h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${
                  isGenerating || (!prompt.trim() && !referenceImage)
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-500/40 active:scale-95'
                }`}
              >
                {isGenerating ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
              </button>
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
