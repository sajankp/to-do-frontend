import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Sparkles, Volume2 } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { Todo } from '../types';
import { api } from '../services/api';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

interface VoiceAssistantProps {
  todos: Todo[];
  onUpdate: () => void;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ todos, onUpdate }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [volume, setVolume] = useState(0);

  // Refs to maintain state access inside callbacks without stale closures
  const todosRef = useRef(todos);
  const onUpdateRef = useRef(onUpdate);
  const sessionRef = useRef<any>(null);

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
  }, [todos, onUpdate]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const toolDefinitions: FunctionDeclaration[] = [
    {
      name: 'get_todos',
      description: 'Get the current list of todo items.',
      parameters: { type: Type.OBJECT, properties: {} },
    },
    {
      name: 'create_todo',
      description: 'Create a new todo item.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'The title of the task' },
          description: { type: Type.STRING, description: 'The description of the task' },
          priority: {
            type: Type.STRING,
            enum: ['low', 'medium', 'high'],
            description: 'The priority level',
          },
          due_date: { type: Type.STRING, description: 'ISO 8601 date string for the due date' },
        },
        required: ['title'],
      },
    },
    {
      name: 'delete_todo',
      description: 'Delete a todo item by matching its title.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          search_title: {
            type: Type.STRING,
            description:
              'The text to search for in the todo title to identify which task to delete.',
          },
        },
        required: ['search_title'],
      },
    },
    {
      name: 'update_todo',
      description: 'Update an existing todo item found by title.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          search_title: {
            type: Type.STRING,
            description: 'The text to search for to identify the task.',
          },
          new_title: { type: Type.STRING, description: 'The new title' },
          new_description: { type: Type.STRING, description: 'The new description' },
          new_priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
          new_due_date: { type: Type.STRING, description: 'ISO 8601 date string' },
        },
        required: ['search_title'],
      },
    },
  ];

  const handleToolCall = async (fc: any) => {
    const args = fc.args;
    let result: any = { error: 'Unknown tool' };

    try {
      if (fc.name === 'get_todos') {
        result = {
          todos: todosRef.current.map((t) => ({
            title: t.title,
            priority: t.priority,
            due_date: t.due_date,
            description: t.description,
          })),
        };
      } else if (fc.name === 'create_todo') {
        const priority = args.priority || 'medium';
        const dueDate = args.due_date || new Date(Date.now() + 86400000).toISOString();
        await api.createTodo(args.title, args.description || '', priority, dueDate);
        onUpdateRef.current();
        result = { status: 'success', message: `Created task "${args.title}"` };
      } else if (fc.name === 'delete_todo') {
        const query = (args.search_title as string).toLowerCase();
        const matches = todosRef.current.filter((t) => t.title.toLowerCase().includes(query));

        if (matches.length === 0) {
          result = { status: 'error', message: 'No task found matching that name.' };
        } else if (matches.length > 1) {
          result = {
            status: 'error',
            message: `Multiple tasks found: ${matches
              .map((t) => t.title)
              .join(', ')}. Please be more specific.`,
          };
        } else {
          await api.deleteTodo(matches[0].id);
          onUpdateRef.current();
          result = { status: 'success', message: `Deleted task "${matches[0].title}"` };
        }
      } else if (fc.name === 'update_todo') {
        const query = (args.search_title as string).toLowerCase();
        const matches = todosRef.current.filter((t) => t.title.toLowerCase().includes(query));

        if (matches.length === 0) {
          result = { status: 'error', message: 'No task found matching that name.' };
        } else if (matches.length > 1) {
          result = {
            status: 'error',
            message: `Multiple tasks found: ${matches.map((t) => t.title).join(', ')}.`,
          };
        } else {
          const todo = matches[0];
          await api.updateTodo(todo.id, {
            title: args.new_title || todo.title,
            description: args.new_description || todo.description,
            priority: args.new_priority || todo.priority,
            due_date: args.new_due_date || todo.due_date,
          });
          onUpdateRef.current();
          result = { status: 'success', message: `Updated task "${todo.title}"` };
        }
      }
    } catch (e: any) {
      result = { status: 'error', message: e.message || 'Action failed' };
    }

    return result;
  };

  const startSession = async () => {
    setIsConnecting(true);
    try {
      // API Key Check
      if (window.aistudio && (await window.aistudio.hasSelectedApiKey())) {
        // Key is good
      } else if (window.aistudio) {
        await window.aistudio.openSelectKey();
      }

      // Audio Setup
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      inputSourceRef.current = inputContextRef.current.createMediaStreamSource(stream);
      processorRef.current = inputContextRef.current.createScriptProcessor(4096, 1, 1);

      // Visualization logic
      const analyser = inputContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      inputSourceRef.current.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Note: We trigger this after active state is set, but the loop logic above is slightly inverted.
      // We will handle volume loop separately.

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDefinitions }],
          systemInstruction:
            'You are a helpful voice assistant managing a todo list. You can add, delete, update, and list tasks. Identify tasks by fuzzy name matching. If a user wants to delete "milk", look for "Buy Milk". Be concise.',
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);

            // Start audio processing
            if (processorRef.current && inputContextRef.current) {
              processorRef.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                sessionPromise.then((session) => session.sendRealtimeInput({ media: pcmBlob }));

                // Simple volume visualizer
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                  sum += inputData[i] * inputData[i];
                }
                setVolume(Math.sqrt(sum / inputData.length) * 100);
              };
              inputSourceRef.current?.connect(processorRef.current);
              processorRef.current.connect(inputContextRef.current.destination);
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Interruption
            if (msg.serverContent?.interrupted) {
              audioSourcesRef.current.forEach((source) => {
                try {
                  source.stop();
                } catch (e) {}
              });
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            // Handle Tool Calls
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const result = await handleToolCall(fc);
                sessionPromise.then((session) =>
                  session.sendToolResponse({
                    functionResponses: {
                      id: fc.id,
                      name: fc.name,
                      response: { result },
                    },
                  })
                );
              }
            }

            // Handle Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputContextRef.current) {
              const ctx = outputContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

              const audioBuffer = await decodeAudioData(
                base64ToUint8Array(audioData),
                ctx,
                24000,
                1
              );

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
          },
          onclose: () => {
            stopSession();
          },
          onerror: (err) => {
            console.error(err);
            stopSession();
          },
        },
      });

      sessionRef.current = sessionPromise;
    } catch (error) {
      console.error('Connection failed', error);
      setIsConnecting(false);
      setIsActive(false);
    }
  };

  const stopSession = async () => {
    setIsActive(false);
    setIsConnecting(false);
    setVolume(0);

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

    // Close Session
    if (sessionRef.current) {
      try {
        const session = await sessionRef.current;
        session.close();
      } catch (e) {
        console.error('Error closing session', e);
      }
      sessionRef.current = null;
    }
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
