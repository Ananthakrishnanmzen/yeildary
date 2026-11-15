import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Globe,
  Mic,
  MicOff,
  Pause,
  Play,
  Radio,
  Send,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { voiceService } from '../../services/api';

interface ChatMsg {
  id?: number;
  sender: 'user' | 'bot';
  text: string;
  intent?: string;
  translated_en?: string;
  model_used?: string;
  kb_grounded?: boolean;
  isTyping?: boolean;
}

export default function VoiceDeskView() {
  const [language, setLanguage] = useState<'ml' | 'hi' | 'en'>('ml');
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sampleQuestions, setSampleQuestions] = useState<any[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<number | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Fetch sample questions & set greeting when language changes
  useEffect(() => {
    voiceService
      .getVoiceSamples(language)
      .then((res) => setSampleQuestions(res.data?.samples || []))
      .catch(() => {});

    const greeting =
      language === 'ml'
        ? 'നമസ്കാരം! യീൽഡറി കാർഷിക വോയ്‌സ് ഡെസ്കിലേക്ക് സ്വാഗതം. നിങ്ങളുടെ സംശയങ്ങൾ നേരിട്ട് സംസാരിച്ചോ ടൈപ്പ് ചെയ്തോ ചോദിക്കാം.'
        : language === 'hi'
        ? 'नमस्ते! यील्डरी किसान वॉइस हेल्पडेस्क में आपका स्वागत है। अपनी फसल संबंधित प्रश्न बोलकर या लिखकर पूछें।'
        : 'Welcome to the Yieldary Multilingual Voice Desk. Speak or type your agricultural inquiry.';
    setMessages([
      {
        id: 1,
        sender: 'bot',
        text: greeting,
        intent: 'System Greeting',
        model_used: 'AI Multilingual Assistant',
        kb_grounded: false,
      },
    ]);

    stopSpeaking();
  }, [language]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveTranscript]);

  // Audio visualizer on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;
    const barCount = 18;
    const barWidth = 6;
    const gap = 6;
    const totalWidth = barCount * (barWidth + gap);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const startX = (canvas.width - totalWidth) / 2;
      phase += 0.08;

      let freqData: Uint8Array | null = null;
      if (analyserRef.current && isRecording) {
        freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freqData);
      }

      for (let i = 0; i < barCount; i += 1) {
        let height = 6;
        if (freqData && freqData.length > 0) {
          const sampleIdx = Math.floor((i / barCount) * (freqData.length / 2));
          const val = freqData[sampleIdx] || 0;
          height = Math.max(6, (val / 255) * 50);
        } else if (isRecording) {
          height = Math.sin(phase + i * 0.4) * 20 + 26;
        } else if (isPlayingAudio) {
          height = Math.cos(phase + i * 0.5) * 14 + 18;
        }
        const x = startX + i * (barWidth + gap);
        const y = (canvas.height - height) / 2;
        ctx.fillStyle = isRecording ? '#EF4444' : '#84CC16';
        ctx.fillRect(x, y, barWidth, height);
      }
      animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [isRecording, isPlayingAudio]);

  // Speech Synthesis: Speak text out loud
  const speakText = (text: string, msgId?: number) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    if (currentlySpeakingId === msgId && isPlayingAudio) {
      setIsPlayingAudio(false);
      setCurrentlySpeakingId(null);
      return;
    }

    const cleanText = text
      .replace(/[*_#`]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language === 'ml' ? 'ml-IN' : language === 'hi' ? 'hi-IN' : 'en-US';
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith(language) ||
        (language === 'ml' && v.name.toLowerCase().includes('malayalam')) ||
        (language === 'hi' && v.name.toLowerCase().includes('hindi'))
    );
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      setIsPlayingAudio(true);
      if (msgId) setCurrentlySpeakingId(msgId);
    };
    utterance.onend = () => {
      setIsPlayingAudio(false);
      setCurrentlySpeakingId(null);
    };
    utterance.onerror = () => {
      setIsPlayingAudio(false);
      setCurrentlySpeakingId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setIsPlayingAudio(false);
    setCurrentlySpeakingId(null);
  };

  // Microphone Voice Capture
  const startRecording = async () => {
    setRecordingError(null);
    setLiveTranscript('');
    stopSpeaking();

    // 1. Setup AudioContext & microphone analyzer for real waveform
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
      }

      // MediaRecorder for fallback/audio upload
      recordedChunksRef.current = [];
      try {
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.warn('MediaRecorder init error:', err);
      }
    } catch (err) {
      console.error('Microphone access denied:', err);
      setRecordingError('Microphone access is needed to speak. Please allow microphone permission.');
      return;
    }

    // 2. Setup Web Speech Recognition
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.lang = language === 'ml' ? 'ml-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
        recognition.continuous = false;
        recognition.interimResults = true;

        let accumulated = '';

        recognition.onstart = () => {
          setIsRecording(true);
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              accumulated += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const currentText = accumulated || interim;
          setLiveTranscript(currentText);
          setInputQuery(currentText);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          if (event.error !== 'no-speech') {
            setRecordingError(`Speech note: ${event.error}`);
          }
          stopRecording(false);
        };

        recognition.onend = () => {
          stopRecording(true, accumulated);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
      } catch (e) {
        console.warn('Failed to start speech recognition:', e);
        setIsRecording(true);
      }
    } else {
      setIsRecording(true);
    }
  };

  const stopRecording = (shouldSend = true, overrideQuery?: string) => {
    setIsRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    const queryToSend = overrideQuery || inputQuery || liveTranscript;
    setLiveTranscript('');

    if (shouldSend && queryToSend && queryToSend.trim()) {
      handleVoiceSend(queryToSend.trim(), language);
    } else if (shouldSend && recordedChunksRef.current.length > 0) {
      const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
      handleAudioBlobSend(audioBlob);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording(true);
    } else {
      startRecording();
    }
  };

  // Send textual query to voice chat backend
  const handleVoiceSend = async (
    manualQuery: string | null = null,
    selectedLang = language,
    selectedKbIntent?: string,
  ) => {
    const query = manualQuery || inputQuery;
    if (!query || !query.trim()) return;

    stopSpeaking();
    setIsLoading(true);
    setInputQuery('');
    setLiveTranscript('');

    const userMsg: ChatMsg = {
      id: Date.now(),
      sender: 'user',
      text: query.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      // Send conversation history to preserve conversational context
      const historyPayload = messages
        .filter((m) => !m.isTyping && m.text)
        .slice(-6)
        .map((m) => ({
          sender: m.sender,
          text: m.text,
        }));

      const res = await voiceService.sendChat(query.trim(), selectedLang, historyPayload, selectedKbIntent);
      const data = res.data;

      simulateTypewriter(
        data.answer_text,
        data.detected_intent,
        data.audio_url,
        data.translated_en,
        data.model_used,
        data.kb_grounded,
      );
    } catch (err) {
      console.error('Voice chat failed:', err);
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text:
            selectedLang === 'ml'
              ? 'ക്ഷമിക്കണം, സെർവറുമായി ബന്ധപ്പെടാൻ സാധിച്ചില്ല. ദയവായി അല്പം കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.'
              : selectedLang === 'hi'
              ? 'क्षमा करें, सर्वर से संपर्क नहीं हो सका। कृपया कुछ समय बाद पुनः प्रयास करें।'
              : 'Sorry, could not connect to the advisory server. Please check your connection and try again.',
          intent: 'Connection Error',
          kb_grounded: false,
        },
      ]);
    }
  };

  // Send raw recorded audio Blob to backend
  const handleAudioBlobSend = async (blob: Blob) => {
    stopSpeaking();
    setIsLoading(true);

    const formData = new FormData();
    formData.append('audio', blob, 'farmer_voice.webm');
    formData.append('language', language);
    formData.append(
      'history',
      JSON.stringify(
        messages
          .filter((m) => !m.isTyping && m.text)
          .slice(-6)
          .map((m) => ({ sender: m.sender, text: m.text }))
      )
    );

    try {
      const res = await voiceService.processVoice(formData);
      const data = res.data;
      if (data.transcript) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), sender: 'user', text: data.transcript },
        ]);
      }
      simulateTypewriter(
        data.answer_text,
        data.detected_intent,
        data.audio_url,
        data.translated_en,
        data.model_used,
        data.kb_grounded,
      );
    } catch (err) {
      console.error('Audio processing failed:', err);
      setIsLoading(false);
    }
  };

  // Typewriter effect rendering & auto-speaking
  const simulateTypewriter = (
    fullText: string,
    intent: string,
    ttsUrl: string,
    translatedEn?: string,
    modelUsed?: string,
    kbGrounded?: boolean,
  ) => {
    let idx = 0;
    const botMsgId = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: botMsgId,
        sender: 'bot',
        text: '',
        intent,
        translated_en: translatedEn,
        model_used: modelUsed,
        kb_grounded: kbGrounded,
        isTyping: true,
      },
    ]);

    const interval = setInterval(() => {
      idx += 5;
      if (idx >= fullText.length) {
        clearInterval(interval);
        setMessages((prev) =>
          prev.map((m) => (m.id === botMsgId ? { ...m, text: fullText, isTyping: false } : m))
        );
        setIsLoading(false);
        if (ttsUrl) setAudioUrl(ttsUrl);

        if (autoSpeak) {
          speakText(fullText, botMsgId);
        }
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === botMsgId ? { ...m, text: fullText.slice(0, idx) } : m))
        );
      }
    }, 16);
  };

  const togglePlayAudio = () => {
    if (isPlayingAudio) {
      stopSpeaking();
    } else {
      const lastBotMsg = [...messages].reverse().find((m) => m.sender === 'bot' && m.text);
      if (lastBotMsg) {
        speakText(lastBotMsg.text, lastBotMsg.id);
      } else if (audioPlayerRef.current && audioUrl) {
        audioPlayerRef.current.play().catch(() => {});
        setIsPlayingAudio(true);
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#84CC16] uppercase tracking-wider">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>AI Multilingual Voice Engine</span>
          </div>
          <h2 className="text-xl font-bold text-white">Multilingual Farmer Voice Helpdesk</h2>
          <p className="text-xs text-slate-400">
            Real-time vernacular voice speaking, multi-turn AI conversation &amp; automated speech playback
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-Speak Toggle */}
          <button
            type="button"
            onClick={() => {
              setAutoSpeak(!autoSpeak);
              if (autoSpeak) stopSpeaking();
            }}
            title={autoSpeak ? 'Auto-speak enabled' : 'Auto-speak muted'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              autoSpeak
                ? 'bg-[#84CC16]/15 border-[#84CC16]/50 text-[#84CC16]'
                : 'bg-[#07090D] border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{autoSpeak ? 'Voice Speaking: ON' : 'Voice Speaking: MUTED'}</span>
          </button>

          {/* Language Selector */}
          <div className="flex items-center gap-1 bg-[#07090D] border border-white/10 p-1.5 rounded-xl text-xs font-bold">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Voice Interaction & Presets */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-6 text-center space-y-5 shadow-2xl">
            <div>
              <span className={`text-[11px] font-mono uppercase font-bold ${isRecording ? 'text-red-400 animate-pulse' : 'text-[#84CC16]'}`}>
                {isRecording ? '● Listening to your voice... Speak now' : 'Tap microphone to speak your farm question'}
              </span>
              <h3 className="text-base font-bold text-white mt-1">
                {language === 'ml' ? 'സംസാരിച്ച് ചോദ്യങ്ങൾ ചോദിക്കാം' : language === 'hi' ? 'बोलकर प्रश्न पूछें' : 'Voice Speech-to-Text with AI Assistant'}
              </h3>
            </div>

            {/* Audio Waveform Canvas */}
            <div className="h-20 flex items-center justify-center bg-[#07090D] rounded-xl border border-white/10 p-2">
              <canvas ref={canvasRef} width={240} height={60} className="w-full h-full" />
            </div>

            {/* Microphone Button */}
            <div className="relative inline-flex items-center justify-center">
              {isRecording && <div className="absolute w-24 h-24 rounded-full bg-red-500/30 animate-ping" />}
              <button
                type="button"
                onClick={toggleRecording}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition shadow-2xl cursor-pointer ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-[#84CC16] hover:bg-[#84CC16]/90 text-[#07090D]'
                }`}
                title={isRecording ? 'Stop speaking' : 'Start speaking'}
              >
                {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </button>
            </div>

            {/* Recording status note */}
            {isRecording && (
              <p className="text-xs text-red-400 font-medium animate-pulse">
                Speaking allowed... Press microphone again or stop speaking to submit.
              </p>
            )}

            {/* Error Message */}
            {recordingError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{recordingError}</span>
              </div>
            )}

            {/* Audio Playback Bar */}
            <div className="p-3.5 rounded-xl bg-[#07090D] border border-[#84CC16]/40 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-[#84CC16] font-bold">
                  <Volume2 className="w-4 h-4" /> AI Voice Speech Advisory
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {isPlayingAudio ? 'Speaking...' : 'Ready'}
                </span>
              </div>
              <audio
                ref={audioPlayerRef}
                src={audioUrl || undefined}
                onEnded={() => setIsPlayingAudio(false)}
                className="hidden"
              />
              <button
                type="button"
                onClick={togglePlayAudio}
                className="w-full py-2 rounded-lg bg-[#84CC16]/15 hover:bg-[#84CC16]/25 border border-[#84CC16]/40 text-[#84CC16] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                {isPlayingAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlayingAudio ? 'Stop Voice Speech' : 'Play Voice Advisory'}</span>
              </button>
            </div>
          </div>

          {/* Preset Frequently Asked Questions */}
          <div className="rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Sparkles className="w-4 h-4 text-[#84CC16]" />
              <span>Frequently Asked Questions (Verified KB)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Frequently asked regional questions verified with agricultural advisory data.
            </p>
            <div className="space-y-2">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleVoiceSend(q.question, language, q.intent)}
                  className="w-full p-3 rounded-xl bg-[#07090D] hover:bg-[#84CC16]/15 border border-white/10 hover:border-[#84CC16]/40 text-left text-xs text-slate-200 transition flex items-center justify-between cursor-pointer group"
                >
                  <div className="pr-2">
                    <span className="font-medium group-hover:text-white block">{q.question}</span>
                    <span className="text-[10px] text-[#84CC16]/80 font-mono flex items-center gap-1 mt-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> KB: {q.intent}
                    </span>
                  </div>
                  <Send className="w-3.5 h-3.5 text-[#84CC16] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Chat Flow & Conversation Transcript */}
        <div className="lg:col-span-7 rounded-2xl bg-[#0E1015]/90 border border-white/10 p-5 shadow-2xl flex flex-col h-[580px]">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
            <span className="text-white font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#84CC16]" />
              <span>Multilingual Voice Conversation</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[#84CC16] text-[11px]">
                Language: {language === 'ml' ? 'Malayalam' : language === 'hi' ? 'Hindi' : 'English'}
              </span>
            </div>
          </div>

          {/* Mode Explainer Pill */}
          <div className="mt-3 p-2.5 rounded-xl bg-[#07090D] border border-white/10 text-[11px] text-slate-300 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#84CC16] shrink-0" />
            <span>
              <strong className="text-white">Intelligent Advisory Engine:</strong> Uses verified regional Knowledge Base for standard agricultural topics, and advanced AI intelligence for all other farming inquiries.
            </span>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
            {messages.map((msg, idx) => {
              const isUser = msg.sender === 'user';
              const isSpeakingThis = currentlySpeakingId === msg.id && isPlayingAudio;
              return (
                <div key={msg.id || idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  {!isUser && (
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      {msg.kb_grounded ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-[#84CC16] bg-[#84CC16]/10 border border-[#84CC16]/30 rounded px-1.5 py-0.5">
                          <Sparkles className="w-3 h-3" />
                          Verified Regional KB + AI Advisory
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 rounded px-1.5 py-0.5">
                          <Bot className="w-3 h-3" />
                          Autonomous AI Knowledge
                        </span>
                      )}
                      {msg.intent && (
                        <span className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-slate-300">
                          {msg.intent}
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed relative group ${
                      isUser
                        ? 'bg-[#84CC16] text-[#07090D] font-medium rounded-tr-none shadow-lg'
                        : 'bg-[#07090D] border border-white/10 text-slate-200 rounded-tl-none shadow-lg'
                    }`}
                  >
                    {isUser && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-[#07090D]/70 mb-1">
                        <User className="w-3 h-3" /> Spoken Inquiry
                      </div>
                    )}
                    <p className="whitespace-pre-line">{msg.text}</p>

                    {/* Bot Voice Replay Button */}
                    {!isUser && msg.text && !msg.isTyping && (
                      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                        <button
                          type="button"
                          onClick={() => speakText(msg.text, msg.id)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold cursor-pointer transition ${
                            isSpeakingThis
                              ? 'bg-[#84CC16] text-[#07090D]'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5 text-[#84CC16]" />
                          <span>{isSpeakingThis ? 'Speaking...' : 'Listen aloud'}</span>
                        </button>
                        {msg.translated_en && language !== 'en' && (
                          <span className="text-[10px] text-slate-400 italic truncate max-w-[200px]" title={msg.translated_en}>
                            EN: {msg.translated_en}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Live Interim Transcript when speaking */}
            {isRecording && liveTranscript && (
              <div className="flex flex-col items-end animate-fade-in">
                <div className="max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm bg-[#84CC16]/20 border border-[#84CC16] text-[#84CC16] rounded-tr-none">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase mb-1">
                    <Mic className="w-3 h-3 animate-pulse" /> Speaking live...
                  </div>
                  <p>{liveTranscript}</p>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start gap-2 text-xs text-[#84CC16] animate-pulse py-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Analyzing your farm inquiry and crafting advice...</span>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Input & Send Bar */}
          <div className="pt-3 border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVoiceSend(inputQuery, language)}
              placeholder={
                language === 'ml'
                  ? 'സംസാരിക്കുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക...'
                  : language === 'hi'
                  ? 'बोलें या प्रश्न यहां टाइप करें...'
                  : 'Speak into microphone or type farm inquiry...'
              }
              className="flex-1 bg-[#07090D] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#84CC16]"
            />
            <button
              type="button"
              onClick={toggleRecording}
              className={`p-2.5 rounded-xl font-bold cursor-pointer transition ${
                isRecording
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200'
              }`}
              title={isRecording ? 'Stop voice speaking' : 'Speak into microphone'}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => handleVoiceSend(inputQuery, language)}
              disabled={isLoading || (!inputQuery.trim() && !isRecording)}
              className="p-2.5 rounded-xl bg-[#84CC16] hover:bg-[#84CC16]/90 disabled:opacity-50 text-[#07090D] font-bold cursor-pointer transition"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
