import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, Sparkles } from 'lucide-react';
import { Todo } from '../types';
import { api } from '../services/api';
import { decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

interface VoiceAssistantProps {
  todos: Todo[];
  onUpdate: () => void;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ todos, onUpdate }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [volume, setVolume] = useState(0);

  // Refs
  const todosRef = useRef(todos);
  const onUpdateRef = useRef(onUpdate);
  const wsRef = useRef<WebSocket | null>(null);

  // Audio Contexts
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Update refs when props change
  useEffect(() => {
    todosRef.current = todos;
    onUpdateRef.current = onUpdate;

    // Send updated todos to backend if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'todos_update',
          todos: todos.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            due_date: t.due_date,
            priority: t.priority,
          })),
        })
      );
    }
  }, [todos, onUpdate]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const getWebSocketUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = apiUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${wsHost}/api/ai/voice/stream`;
  };

  const handleAction = async (action: string, data: any) => {
    try {
      if (action === 'create_todo') {
        const priority = data.priority || 'medium';
        const dueDate = data.due_date || null;
        await api.createTodo(data.title, data.description || '', priority, dueDate);
        onUpdateRef.current();
      } else if (action === 'delete_todo') {
        await api.deleteTodo(data.id);
        onUpdateRef.current();
      } else if (action === 'update_todo') {
        await api.updateTodo(data.id, {
          title: data.title,
          description: data.description,
          priority: data.priority,
          due_date: data.due_date,
        });
        onUpdateRef.current();
      }
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const startSession = async () => {
    if (isConnecting || isActive) return;
    setIsConnecting(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No auth token found');
      }

      // Initialize Audio Setup first
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      inputSourceRef.current = inputContextRef.current.createMediaStreamSource(stream);
      processorRef.current = inputContextRef.current.createScriptProcessor(4096, 1, 1);

      // Volume setup
      const analyser = inputContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      inputSourceRef.current.connect(analyser);

      // Connect WebSocket
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        // Send auth token
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'connected') {
          setIsActive(true);
          setIsConnecting(false);

          // Send initial todos
          ws.send(
            JSON.stringify({
              type: 'todos_update',
              todos: todosRef.current.map((t) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                due_date: t.due_date,
                priority: t.priority,
              })),
            })
          );

          // Start audio recording
          if (processorRef.current && inputContextRef.current) {
            processorRef.current.onaudioprocess = async (e) => {
              const inputData = e.inputBuffer.getChannelData(0);

              // Volume visualization
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              setVolume(Math.sqrt(sum / inputData.length) * 100);

              // Convert to PCM16 and send
              // We can rely on createPcmBlob helper but we need base64
              // Let's manually convert float32 to int16
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
              }
              const base64Audio = arrayBufferToBase64(pcmData.buffer);

              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'audio', data: base64Audio }));
              }
            };

            inputSourceRef.current?.connect(processorRef.current);
            processorRef.current.connect(inputContextRef.current.destination);
          }
        } else if (msg.type === 'audio') {
          // Play audio
          if (msg.data && outputContextRef.current) {
            const ctx = outputContextRef.current;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

            const audioBuffer = await decodeAudioData(base64ToUint8Array(msg.data), ctx, 24000, 1);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.addEventListener('ended', () => {
              audioSourcesRef.current.delete(source);
            });
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            audioSourcesRef.current.add(source);
          }
        } else if (msg.type === 'action') {
          await handleAction(msg.action, msg.data);
        } else if (msg.type === 'interrupted') {
          audioSourcesRef.current.forEach((source) => {
            try {
              source.stop();
            } catch (e) {}
          });
          audioSourcesRef.current.clear();
          nextStartTimeRef.current = 0;
        } else if (msg.type === 'error') {
          console.error('WebSocket error message:', msg.message);
          stopSession();
        }
      };

      ws.onclose = () => {
        stopSession();
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        stopSession();
      };
    } catch (error) {
      console.error('Session start failed', error);
      setIsConnecting(false);
      setIsActive(false);
    }
  };

  const stopSession = () => {
    setIsActive(false);
    setIsConnecting(false);
    setVolume(0);

    // Stop WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop Audio Contexts
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }

    // Stop Playback
    audioSourcesRef.current.forEach((source) => source.stop());
    audioSourcesRef.current.clear();
  };

  const toggleSession = () => {
    if (isActive) {
      stopSession();
    } else {
      startSession();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
      {isActive && (
        <div className="bg-slate-900 text-white text-xs py-1 px-3 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2">
          Listening...
        </div>
      )}

      <button
        onClick={toggleSession}
        disabled={isConnecting}
        className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary-200 ${
          isActive
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
      >
        {/* Pulsing Effect when active */}
        {isActive && (
          <span
            className="absolute inset-0 rounded-full bg-red-400 opacity-20 animate-ping"
            style={{ animationDuration: '1.5s' }}
          ></span>
        )}

        {/* Dynamic Volume Ring */}
        {isActive && (
          <span
            className="absolute inset-0 rounded-full border-2 border-white opacity-50 transition-all duration-75"
            style={{ transform: `scale(${1 + Math.min(volume / 50, 0.5)})` }}
          ></span>
        )}

        {isConnecting ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : isActive ? (
          <Mic className="w-6 h-6" />
        ) : (
          <div className="relative">
            <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-yellow-200" />
            <Mic className="w-6 h-6" />
          </div>
        )}
      </button>
    </div>
  );
};
