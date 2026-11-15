import { useEffect, useRef, useState } from 'react';
import {
  Globe,
  Mic,
  MicOff,
  Pause,
  Play,
  Radio,
  Send,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { voiceService } from '../../services/api';

interface ChatMsg {
  id?: number;
  sender: 'user' | 'bot';
  text: string;
  intent?: string;
  isTyping?: boolean;
}

export default function VoiceDeskView() {
  const [language, setLanguage] = useState<'ml' | 'hi' | 'en'>('ml');
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sampleQuestions, setSampleQuestions] = useState<any[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    voiceService
      .getVoiceSamples(language)
      .then((res) => setSampleQuestions(res.data?.samples || []))
      .catch(() => {});

    const greeting =
      language === 'ml'
        ? 'നമസ്കാരം! യീൽഡറി & ലോമുറ കാർഷിക വോയ്‌സ് അസിസ്റ്റന്റിലേക്ക് സ്വാഗതം. നിങ്ങളുടെ സംശയങ്ങൾ ചോദിക്കൂ.'
        : language === 'hi'
        ? 'नमस्ते! यील्डरी किसान वॉइस डेस्क में आपका स्वागत है। अपनी फसल संबंधित प्रश्न पूछें।'
        : 'Welcome to the Multilingual Voice Desk. Speak or type your agricultural inquiry.';
    setMessages([{ sender: 'bot', text: greeting, intent: 'System Greeting' }]);
  }, [language]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barCount = 16;
      const barWidth = 6;
      const gap = 6;
      const totalWidth = barCount * (barWidth + gap);
      const startX = (canvas.width - totalWidth) / 2;
      phase += 0.08;

      for (let i = 0; i < barCount; i += 1) {
        let height = 6;
        if (isRecording) {
          height = Math.sin(phase + i * 0.4) * 20 + 26;
        } else if (isPlayingAudio) {
          height = Math.cos(phase + i * 0.5) * 14 + 18;
        }
        const x = startX + i * (barWidth + gap);
        const y = (canvas.height - height) / 2;
        ctx.fillStyle = '#84CC16';
        ctx.fillRect(x, y, barWidth, height);
      }
      animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [isRecording, isPlayingAudio]);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      handleVoiceSend(null, language);
    } else {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        handleVoiceSend(null, language);
      }, 2500);
    }
  };

  const handleVoiceSend = async (manualQuery: string | null = null, selectedLang = language) => {
    setIsLoading(true);
    const query =
      manualQuery ||
      inputQuery ||
      (selectedLang === 'ml'
        ? 'വാഴയിലെ ഇലപ്പുള്ളി രോഗം മാറ്റാൻ എന്ത് ചെയ്യണം?'
        : selectedLang === 'hi'
        ? 'धान में झुलसा रोग लगने पर कौन सी दवा डालें?'
        : 'How to control leaf spot disease in banana crops?');

    setMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setInputQuery('');

    try {
      const res = await voiceService.sendChat(query, selectedLang);
      const data = res.data;
      simulateTypewriter(data.answer_text, data.detected_intent, data.audio_url);
    } catch {
      setIsLoading(false);
    }
  };

  const simulateTypewriter = (fullText: string, intent: string, ttsUrl: string) => {
    let idx = 0;
    const botMsgId = Date.now();
    setMessages((prev) => [...prev, { id: botMsgId, sender: 'bot', text: '', intent, isTyping: true }]);

    const interval = setInterval(() => {
      idx += 4;
      if (idx >= fullText.length) {
        clearInterval(interval);
        setMessages((prev) =>
          prev.map((m) => (m.id === botMsgId ? { ...m, text: fullText, isTyping: false } : m)),
        );
        setIsLoading(false);
        if (ttsUrl) setAudioUrl(ttsUrl);
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === botMsgId ? { ...m, text: fullText.slice(0, idx) } : m)),
        );
      }
    }, 20);
  };

  const togglePlayAudio = () => {
    if (!audioPlayerRef.current) return;
    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioPlayerRef.current.play().catch(() => {});
      setIsPlayingAudio(true);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#84CC16] uppercase tracking-wider">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>AI4Bharat Indic Speech Engine</span>
          </div>
          <h2 className="text-xl font-bold text-white">Multilingual Farmer Voice Helpdesk</h2>
          <p className="text-xs text-slate-400">
            Native vernacular speech-to-text (ASR), IndicTrans2 advisory matching &amp; Indic-TTS audio playback
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#07090D] border border-white/10 p-1.5 rounded-xl text-xs font-bold">
          <Globe className="w-4 h-4 text-[#84CC16] ml-1.5 mr-1" />
          <button
            type="button"
            onClick={() => setLanguage('ml')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              language === 'ml' ? 'bg-[#84CC16] text-[#07090D]' : 'text-slate-400 hover:text-white'
            }`}
          >
            മലയാളം (Malayalam)
          </button>
          <button
            type="button"
            onClick={() => setLanguage('hi')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              language === 'hi' ? 'bg-[#84CC16] text-[#07090D]' : 'text-slate-400 hover:text-white'
            }`}
          >
            हिन्दी (Hindi)
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              language === 'en' ? 'bg-[#84CC16] text-[#07090D]' : 'text-slate-400 hover:text-white'
            }`}
          >
            English
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-6 text-center space-y-5 shadow-2xl">
            <div>
              <span className="text-[11px] font-mono uppercase text-[#84CC16] font-bold">
                {isRecording ? 'Listening to your voice...' : 'Tap microphone to speak your farm query'}
              </span>
              <h3 className="text-base font-bold text-white mt-1">Vernacular Speech-to-Text (ASR)</h3>
            </div>

            <div className="h-20 flex items-center justify-center bg-[#07090D] rounded-xl border border-white/10 p-2">
              <canvas ref={canvasRef} width={220} height={60} className="w-full h-full" />
            </div>

            <div className="relative inline-flex items-center justify-center">
              {isRecording && <div className="absolute w-24 h-24 rounded-full bg-[#84CC16]/25 animate-ping" />}
              <button
                type="button"
                onClick={toggleRecording}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition shadow-2xl cursor-pointer ${
                  isRecording
                    ? 'bg-red-600 text-white'
                    : 'bg-[#84CC16] hover:bg-[#84CC16]/90 text-[#07090D]'
                }`}
              >
                {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </button>
            </div>

            {audioUrl && (
              <div className="p-3.5 rounded-xl bg-[#07090D] border border-[#84CC16]/40 text-left space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-[#84CC16] font-bold">
                    <Volume2 className="w-4 h-4" /> Indic-TTS Regional Speech
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">16kHz PCM WAV</span>
                </div>
                <audio
                  ref={audioPlayerRef}
                  src={audioUrl}
                  onEnded={() => setIsPlayingAudio(false)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={togglePlayAudio}
                  className="w-full py-2 rounded-lg bg-[#84CC16]/15 border border-[#84CC16]/40 text-[#84CC16] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isPlayingAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlayingAudio ? 'Pause Audio Advisory' : 'Play Audio Advisory'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Preset Regional Questions */}
          <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Sparkles className="w-4 h-4 text-[#84CC16]" />
              <span>Frequently Asked Farmer Questions</span>
            </div>
            <div className="space-y-2">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleVoiceSend(q.question, language)}
                  className="w-full p-3 rounded-xl bg-[#07090D] hover:bg-[#84CC16]/15 border border-white/10 hover:border-[#84CC16]/40 text-left text-xs text-slate-200 transition flex items-center justify-between cursor-pointer"
                >
                  <span className="pr-2 font-medium">{q.question}</span>
                  <Send className="w-3.5 h-3.5 text-[#84CC16] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Chat Flow */}
        <div className="lg:col-span-7 rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl flex flex-col h-[540px]">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
            <span className="text-white font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#84CC16]" />
              <span>Indic-Trans2 &amp; ASR Chat Transcript</span>
            </span>
            <span className="font-mono text-[#84CC16] text-[11px]">
              Active: {language === 'ml' ? 'Malayalam' : language === 'hi' ? 'Hindi' : 'English'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
            {messages.map((msg, idx) => {
              const isUser = msg.sender === 'user';
              return (
                <div key={msg.id || idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  {!isUser && msg.intent && (
                    <span className="text-[10px] font-mono text-[#84CC16] mb-1">Intent: {msg.intent}</span>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#84CC16] text-[#07090D] font-medium rounded-tr-none'
                        : 'bg-[#07090D] border border-white/10 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    <p>{msg.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVoiceSend(inputQuery, language)}
              placeholder={
                language === 'ml'
                  ? 'നിങ്ങളുടെ സംശയം ടൈപ്പ് ചെയ്യുക...'
                  : language === 'hi'
                  ? 'अपना प्रश्न यहां लिखें...'
                  : 'Type your farm inquiry...'
              }
              className="flex-1 bg-[#07090D] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#84CC16]"
            />
            <button
              type="button"
              onClick={() => handleVoiceSend(inputQuery, language)}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-[#84CC16] text-[#07090D] font-bold cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
