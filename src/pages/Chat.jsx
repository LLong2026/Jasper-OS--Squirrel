import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { createAgent } from '@/functions/createAgent';
import { Send, Loader2, Sparkles, AlertCircle, Copy, Check, Cpu, Download, Mic, MicOff, Volume2, VolumeX, Radio, Box, Monitor, Paperclip, Clapperboard, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ConversationHistory from '@/components/ConversationHistory';
import AgentProposalCard from '@/components/AgentProposalCard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { User } from '@/entities/User';
import AegisHeartbeat from '@/components/AegisHeartbeat';
import SystemHeartbeat from '@/components/SystemHeartbeat';
import ImageGeneratorPanel from '@/components/ImageGeneratorPanel';
import ModelSelector, { MODELS } from '@/components/capabilities/ModelSelector';
import AIControlsPanel from '@/components/chat/AIControlsPanel';
import FileDropZone from '@/components/chat/FileDropZone';
import ScreenSharePanel from '@/components/chat/ScreenSharePanel';
import VideoGeneratorPanel from '@/components/chat/VideoGeneratorPanel';
import { Settings2 } from 'lucide-react';

const ProofBadge = ({ proof }) => {
    if (!proof) return null;

    const sourceText = proof.source || 'Unknown Source';
    const modelText = proof.model || 'Unknown Model';
    const tooltipText = proof.reasoning || proof.details || `Routed to ${sourceText}`;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2 px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700 w-fit cursor-help">
                        <Cpu className="h-3 w-3 text-blue-400" />
                        <span>{sourceText}</span>
                        <span className="text-slate-500">/</span>
                        <span className="font-mono text-slate-300">{modelText}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-slate-900 text-slate-200 border-slate-700">
                    <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};


const Message = ({ message, onDeploy, showProof }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    let contentToCopy = message.content || '';
    if (message.image_url) {
      contentToCopy += `\n\nImage: ${message.image_url}`;
    }

    navigator.clipboard.writeText(contentToCopy.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  if (message.type === 'agent_proposal') {
    return <AgentProposalCard agentSpec={message.agent_spec} onDeploy={onDeploy} />;
  }

  // Extract image URL from content if present
  let extractedImageUrl = message.image_url;
  let contentWithoutUrl = message.content;

  if (!extractedImageUrl && message.content) {
    // Extract markdown image: ![alt](url) or plain URL
    const markdownMatch = message.content.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
    if (markdownMatch) {
      extractedImageUrl = markdownMatch[1];
      contentWithoutUrl = message.content.replace(markdownMatch[0], '').trim();
    } else {
      // Fallback to any URL that looks like an image
      const urlMatch = message.content.match(/(https?:\/\/[^\s<>"]+?\.(png|jpg|jpeg|gif|webp|PNG|JPG|JPEG|GIF|WEBP))(\?[^\s<>"]*)?/);
      if (urlMatch) {
        extractedImageUrl = urlMatch[1] + (urlMatch[3] || '');
        contentWithoutUrl = message.content.replace(extractedImageUrl, '').trim();
      }
    }
  }

  return (
    <div className={cn("flex items-start gap-2.5 group", isUser ? "justify-end" : "justify-start")}>
      {isUser && (
        <Button
            onClick={handleCopy}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-300 order-1"
        >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
      
      {!isUser && (
        <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 mt-1 ring-2 ring-blue-500/50 shadow-[0_0_12px_2px_rgba(59,130,246,0.6)]">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693d9a99ca82e178be7bca1b/e908cc8ba_arthur-artwork-1765675024047.png" 
            alt="Jasper AI" 
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"><span class="text-white font-bold text-xs">J</span></div>';
            }}
          />
        </div>
      )}

      <div className={cn(
          "flex flex-col",
          isUser ? "items-end" : "items-start"
      )}>
        <div className={cn("max-w-3xl rounded-2xl", isUser ? "bg-blue-600 text-white order-2" : "bg-slate-800 text-slate-100")}>
          {extractedImageUrl ? (
            <div className="p-2">
              <div className="relative group/image">
                <img 
                  src={extractedImageUrl} 
                  alt="Generated artwork" 
                  className="rounded-lg w-full max-w-2xl shadow-lg"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover/image:opacity-100 bg-slate-900/80 hover:bg-slate-900 transition-opacity"
                  onClick={async () => {
                    const response = await fetch(extractedImageUrl);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `arthur-artwork-${Date.now()}.png`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                  }}
                >
                  <Download className="h-4 w-4 text-slate-300" />
                </Button>
              </div>
              {contentWithoutUrl && (
                <div className="mt-3 px-2">
                  <ReactMarkdown className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-a:text-blue-300 hover:prose-a:text-blue-400">
                    {contentWithoutUrl}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-2.5">
              <ReactMarkdown 
                className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-a:text-blue-300 hover:prose-a:text-blue-400"
                components={{
                  img: ({node, ...props}) => (
                    <img {...props} className="rounded-lg max-w-full shadow-lg" />
                  )
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        
        {showProof && !isUser && message.metadata?.proof && (
            <ProofBadge proof={message.metadata.proof} />
        )}
      </div>

      {!isUser && (
        <Button
            onClick={handleCopy}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-300"
        >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
};

export default function ChatPage() {
  const [conversation, setConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showProof, setShowProof] = useState(false);
  const scrollAreaRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [showImageGen, setShowImageGen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [preferredModel, setPreferredModel] = useState(() => localStorage.getItem('jasper_preferred_model') || 'auto');
  const [directLLMMode, setDirectLLMMode] = useState(() => localStorage.getItem('jasper_direct_llm') === 'true');
  const [showAIControls, setShowAIControls] = useState(false);
  const [showScreenShare, setShowScreenShare] = useState(false);
  const [showVideoGen, setShowVideoGen] = useState(false);
  const [liveVisionActive, setLiveVisionActive] = useState(false);
  const liveVisionUrlRef = useRef(null);
  const [memorySummary, setMemorySummary] = useState('');
  const memoryInjectedRef = useRef(false);
  const lastConsolidateRef = useRef(0);
  const recognitionRef = useRef(null);
  const wakeWordRecognitionRef = useRef(null);
  const synthRef = useRef(null);
  const lastSpokenMessageIdRef = useRef(null);


  // Function to load conversation list
  const loadConversations = useCallback(async () => {
    try {
      const convos = await base44.agents.listConversations({ agent_name: "Jasper" });
      setConversations(convos.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date)));
    } catch (err) {
      console.error("Error loading conversations:", err);
      // Optionally, set an error state for the user if loading conversations fails
    }
  }, [setConversations]);

  // Effect to load debug settings from user preferences on mount
  useEffect(() => {
    const loadUserDebugSettings = async () => {
      try {
        // Check URL parameter first
        const params = new URLSearchParams(window.location.search);
        if (params.get('debug') === 'true') {
          setShowProof(true);
          return; // URL param takes precedence
        }

        // Otherwise, try to load from user settings
        const user = await User.me();
        if (user?.debug_settings?.show_integration_proof === true) {
          setShowProof(true);
        } else {
          setShowProof(false); // Default to false if property is not true or doesn't exist
        }
      } catch (error) {
        console.log('Could not load debug settings:', error);
        setShowProof(false); // Default to false on error
      }
    };

    loadUserDebugSettings();
  }, []);

  // Effect to load all existing conversations on component mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Function to initialize a new conversation
  const initializeNewConversation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const conv = await base44.agents.createConversation({ agent_name: "Jasper" });
      setConversation(conv);
      memoryInjectedRef.current = false;

      // Recall cross-chat memory so Jasper carries context into the new conversation
      let summary = '';
      try {
        const res = await base44.functions.invoke('crossChatMemory', { action: 'recall' });
        summary = res?.summary || '';
      } catch (e) {
        // best-effort — continue without memory
      }
      setMemorySummary(summary);

      const greeting = summary
        ? `Welcome back. I've been mulling over what we last discussed — ${summary} Right then, what shall we build today?`
        : "Right then, what delightful bit of chaos shall we orchestrate today? Jolly good to see you.";
      setMessages([{ role: 'assistant', content: greeting }]);
      await loadConversations(); // Reload conversation list after creating a new one
    } catch (err) {
      console.error("Initialization Error:", err);
      setError("Failed to start conversation. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  }, [setConversation, setMessages, setError, setIsLoading, loadConversations]);

  // Function to select an existing conversation
  const handleSelectConversation = useCallback(async (conversationId) => {
    try {
      setIsLoading(true);
      const selectedConvo = await base44.agents.getConversation(conversationId);
      setConversation(selectedConvo);
      setMessages(selectedConvo.messages || []);
      memoryInjectedRef.current = true; // existing conversations already carry their context
      setError(null);
    } catch (err) {
      console.error("Error loading conversation:", err);
      setError("Failed to load conversation.");
    } finally {
      setIsLoading(false);
    }
  }, [setConversation, setMessages, setError, setIsLoading]);

  // Function to handle deleting a conversation
  const handleDeleteConversation = useCallback(async (conversationId) => {
    try {
      // Remove from local state immediately
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // If the deleted conversation was the currently active one, start a new one
      if (conversation && conversation.id === conversationId) {
        await initializeNewConversation();
      }
      
    } catch (err) {
      console.error("Error deleting conversation:", err);
      setError("Failed to delete conversation.");
      // Reload conversations to ensure UI is in sync
      await loadConversations();
    }
  }, [conversation, initializeNewConversation, setConversations, setError, loadConversations]);

  // Function to start a new conversation (handler for button)
  const handleNewConversation = useCallback(async () => {
    await initializeNewConversation();
  }, [initializeNewConversation]);

  const handleDeployAgent = useCallback(async (agentSpec) => {
    setIsLoading(true);
    setError(null);
    setMessages(prev => [...prev, { role: 'assistant', content: `Deploying agent \`${agentSpec.name}\`...` }]);
    
    try {
      const result = await createAgent({ agent_spec: agentSpec });
      if (result.success) {
        setMessages(prev => {
            const newMessages = prev.filter(m => m.type !== 'agent_proposal');
            newMessages[newMessages.length - 1] = { role: 'assistant', content: result.message };
            return newMessages;
        });
        await loadConversations(); // Reload conversations to reflect new capabilities if needed
      } else {
        throw new Error(result.error || 'Deployment failed.');
      }
    } catch (err) {
      console.error("Agent Deployment Error:", err);
      const errorMessage = { role: 'assistant', content: `Sorry, I encountered an error deploying the agent: ${err.message}` };
      setMessages(prev => {
        // Filter out the agent_proposal and replace the "Deploying agent..." message
        const newMessages = prev.filter(m => m.type !== 'agent_proposal');
        if (newMessages.length > 0) {
            newMessages[newMessages.length - 1] = errorMessage;
        } else {
            // Fallback if somehow no previous messages (shouldn't happen with the "Deploying" msg)
            newMessages.push(errorMessage);
        }
        return newMessages;
      });
      setError("Agent deployment failed.");
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError, setMessages, loadConversations]);

  // Speech functions
  const speakText = useCallback((text) => {
    if (!synthRef.current || !voiceEnabled) {
      console.log('Speech disabled or not available');
      return;
    }

    // Don't interrupt if already speaking
    if (isSpeaking) {
      console.log('Already speaking, queuing...');
      return;
    }

    // Resume synthesis immediately (Chrome autoplay policy)
    if (synthRef.current.paused) {
      synthRef.current.resume();
    }

    // Clean text for speech (remove markdown, code blocks, URLs)
    const cleanText = text
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown images
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '') // Remove inline code
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/[*_~#]/g, '') // Remove markdown formatting
      .replace(/\n\n+/g, '. ') // Convert paragraph breaks to pauses
      .replace(/\n/g, ', ') // Convert line breaks to commas
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!cleanText) {
      console.log('No text to speak');
      return;
    }

    console.log('Speaking:', cleanText.substring(0, 50));

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Configure for natural British female voice - Jasper's personality
    utterance.lang = 'en-GB';
    utterance.rate = 1.1; // Slightly slower for clarity
    utterance.pitch = 1.1; // Feminine, warm tone
    utterance.volume = 1.0;

    // Find the best British female voice available
    const voices = synthRef.current.getVoices();
    console.log('All available voices:', voices.map(v => `${v.name} (${v.lang})`).join(', '));
    
    // Prefer natural-sounding British female voices
    const femaleVoiceNames = ['female', 'kate', 'susan', 'karen', 'samantha', 'victoria', 'serena', 'fiona', 'emma'];
    
    const isFemaleVoice = (voice) => {
      const nameLower = voice.name.toLowerCase();
      return femaleVoiceNames.some(f => nameLower.includes(f)) || 
             nameLower.includes('female') ||
             (!nameLower.includes('male') && voice.name.match(/^[A-Z][a-z]+$/)); // Single capitalized name often female
    };
    
    // Priority: British female, then US female, then any female British, then fallback
    const britishVoice = 
      voices.find(v => v.lang === 'en-GB' && isFemaleVoice(v)) ||
      voices.find(v => v.lang === 'en-US' && isFemaleVoice(v) && v.name.includes('Samantha')) ||
      voices.find(v => v.lang.startsWith('en-') && isFemaleVoice(v)) ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang === 'en-US') ||
      voices[0];

    if (britishVoice) {
      utterance.voice = britishVoice;
      console.log('Using voice:', britishVoice.name);
    } else {
      console.log('No suitable voice found, using default');
    }

    utterance.onstart = () => {
      console.log('Speech started');
      setIsSpeaking(true);
    };
    utterance.onend = () => {
      console.log('Speech ended');
      setIsSpeaking(false);
    };
    utterance.onerror = (e) => {
      console.error('Speech error:', e);
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
  }, [voiceEnabled, isSpeaking]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Recognition already stopped');
      }
      setIsListening(false);
    } else {
      try {
        setInput('');
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        if (e.message.includes('already started')) {
          console.log('Recognition already running');
        } else {
          setError('Could not start voice recognition');
        }
      }
    }
  }, [isListening]);

  const toggleVoice = useCallback(() => {
    // If currently speaking, STOP immediately (don't toggle voice state)
    if (isSpeaking && synthRef.current) {
      console.log('🛑 STOPPING SPEECH');
      synthRef.current.cancel();
      setIsSpeaking(false);
      return; // Don't toggle voice enabled state
    }
    
    // Resume audio context (Chrome autoplay policy)
    if (synthRef.current && !voiceEnabled) {
      synthRef.current.resume();
    }
    
    // Toggle voice enabled/disabled
    setVoiceEnabled(!voiceEnabled);
  }, [voiceEnabled, isSpeaking]);

  const toggleWakeWord = useCallback(() => {
    if (!wakeWordRecognitionRef.current) {
      setError('Wake word detection not supported in this browser');
      return;
    }

    if (wakeWordEnabled) {
      console.log('🛑 Disabling wake word');
      try {
        wakeWordRecognitionRef.current.stop();
      } catch (e) {
        console.log('Wake word recognition already stopped');
      }
      setWakeWordEnabled(false);
    } else {
      console.log('✅ Enabling wake word - say "Hey Jasper"');
      setWakeWordEnabled(true);
      try {
        wakeWordRecognitionRef.current.start();
      } catch (e) {
        console.error('Could not start wake word detection:', e);
        setError('Could not start wake word detection');
      }
    }
  }, [wakeWordEnabled]);

  // Escape key to stop speech
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isSpeaking && synthRef.current) {
        synthRef.current.cancel();
        setIsSpeaking(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSpeaking]);

  // Initialize speech recognition and synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Speech Recognition setup
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-GB';

        recognition.onstart = () => {
          console.log('🎤 MIC IS OPEN - speak now!');
        };
        
        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');

          setInput(transcript);
          console.log('📝 Got speech:', transcript);
        };

        recognition.onend = () => {
          console.log('🛑 Mic ended, checking if should restart...');
          // Keep restarting to maintain continuous listening
          setTimeout(() => {
            if (recognitionRef.current && isListening) {
              try {
                recognitionRef.current.start();
                console.log('✅ Restarted recognition');
              } catch (e) {
                if (!e.message?.includes('already started')) {
                  console.log('Restart failed:', e);
                  setIsListening(false);
                }
              }
            }
          }, 300);
        };

        recognition.onerror = (event) => {
          console.error('❌ Speech error:', event.error);
          // Ignore no-speech errors, keep mic open
          if (event.error === 'no-speech') {
            console.log('No speech detected, but keeping mic open');
            return;
          }
          if (event.error === 'aborted') {
            console.log('Recognition aborted');
            return;
          }
          setIsListening(false);
        };

        recognitionRef.current = recognition;

        // Wake word recognition setup
        const wakeWordRecognition = new SpeechRecognition();
        wakeWordRecognition.continuous = true;
        wakeWordRecognition.interimResults = false;
        wakeWordRecognition.lang = 'en-GB';

        wakeWordRecognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('')
            .toLowerCase();

          console.log('👂 Wake word listening:', transcript);

          if (transcript.includes('hey jasper') || transcript.includes('hi jasper') || transcript.includes('jasper')) {
            console.log('✅ WAKE WORD DETECTED!');
            
            // Start regular listening
            if (recognitionRef.current && !isListening) {
              try {
                setInput('');
                recognitionRef.current.start();
                setIsListening(true);
              } catch (e) {
                console.log('Recognition start error:', e);
              }
            }
          }
        };

        wakeWordRecognition.onerror = (event) => {
          console.log('Wake word error:', event.error);
          if (event.error === 'no-speech' || event.error === 'aborted') {
            // Ignore these, auto-restart will handle
            return;
          }
        };

        wakeWordRecognition.onend = () => {
          console.log('👂 Wake word ended, restarting...');
          setTimeout(() => {
            try {
              wakeWordRecognition.start();
            } catch (e) {
              console.log('Wake word restart error:', e);
            }
          }, 500);
        };

        wakeWordRecognitionRef.current = wakeWordRecognition;
      }

      // Speech Synthesis setup
      if (window.speechSynthesis) {
        synthRef.current = window.speechSynthesis;
        
        // Load voices
        const loadVoices = () => {
          const voices = synthRef.current.getVoices();
          console.log('Available voices:', voices.length);
        };
        
        loadVoices();
        if (synthRef.current.onvoiceschanged !== undefined) {
          synthRef.current.onvoiceschanged = loadVoices;
        }
      }
    }
  }, []);

  // Effect to subscribe to the currently selected conversation
  useEffect(() => {
    if (!conversation) return;
    
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      console.log('🔔 New conversation data:', data);
      if (data.messages && data.messages.length > 0) {
        // Find the latest message from the agent
        const latestAgentMessage = data.messages.slice().reverse().find(m => m.role === 'assistant');
        console.log('📩 Latest agent message (FULL):', JSON.stringify(latestAgentMessage, null, 2));

        // Check if this is a DebugController response that should update our UI state
        if (latestAgentMessage && latestAgentMessage.content) {
          const content = latestAgentMessage.content;
          if (content.includes('Integration proof display is now ON') || 
              content.includes('Debug mode: ON')) {
            setShowProof(true);
          } else if (content.includes('Integration proof display is now OFF') ||
                     content.includes('Debug mode: OFF')) {
            setShowProof(false);
          }
        }

        // Execute browser commands from tool_calls
        if (latestAgentMessage?.tool_calls && Array.isArray(latestAgentMessage.tool_calls)) {
          console.log('🎯 TOOL CALLS DETECTED:', latestAgentMessage.tool_calls.length, 'calls');

          latestAgentMessage.tool_calls.forEach((toolCall, idx) => {
            console.log(`🔧 Tool call #${idx}:`, toolCall.function?.name);

            if (toolCall.function?.name === 'browserControl') {
              console.log('✅ browserControl found! Full object:', toolCall);

              // Extract result - could be in different places
              let result = toolCall.result || toolCall.function?.result;
              console.log('Raw result:', result);

              if (typeof result === 'string') {
                try {
                  result = JSON.parse(result);
                  console.log('Parsed result from string:', result);
                } catch (e) {
                  console.error('❌ Failed to parse result:', e);
                }
              }

              if (result?.commands && Array.isArray(result.commands)) {
                console.log('🚀 Executing', result.commands.length, 'browser commands');
                result.commands.forEach((cmd, cmdIdx) => {
                  console.log(`Command #${cmdIdx}:`, cmd);
                  if (cmd.type === 'OPEN_URL' && cmd.url) {
                    console.log('🌐 Opening URL:', cmd.url);
                    setTimeout(() => {
                      window.open(cmd.url, cmd.target || '_blank');
                    }, 100);
                  }
                });
              } else {
                console.warn('⚠️ No commands array found in result:', result);
              }
            }
          });
        } else {
          console.log('❌ No tool_calls found on latest message');
        }

        // Check if the latest message is a proposal
        if (latestAgentMessage && typeof latestAgentMessage.content === 'string' && latestAgentMessage.content.includes('"type":"agent_proposal"')) {
            try {
                const parsedContent = JSON.parse(latestAgentMessage.content);
                if(parsedContent.type === 'agent_proposal') {
                    // Replace the raw JSON message with a structured proposal message
                    const newMessages = data.messages.map(m => 
                        m.id === latestAgentMessage.id ? { ...m, ...parsedContent, content: parsedContent.message, metadata: latestAgentMessage.metadata } : m
                    );
                    setMessages(newMessages);
                    return; // Stop further processing
                }
            } catch (e) {
                // Not a valid proposal, fall through
            }
        }
        
        setMessages(data.messages);
        
        // Speak the latest assistant message if voice is enabled
        if (voiceEnabled) {
          const latestAgentMessage = data.messages.slice().reverse().find(m => m.role === 'assistant');
          if (latestAgentMessage && 
              latestAgentMessage.id !== lastSpokenMessageIdRef.current && 
              latestAgentMessage.content && 
              typeof latestAgentMessage.content === 'string') {
            // Don't speak if it's a proposal or image generation
            if (!latestAgentMessage.content.includes('"type":"agent_proposal"') && 
                !latestAgentMessage.content.includes('![')) {
              console.log('🎤 Speaking new message:', latestAgentMessage.id);
              lastSpokenMessageIdRef.current = latestAgentMessage.id;
              speakText(latestAgentMessage.content);
            }
          }
        }
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [conversation, voiceEnabled, speakText, messages.length]);

  // Effect to scroll to the bottom of the chat on new messages or loading state change
  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  // Effect to initialize or select a conversation when the page loads or conversations change
  useEffect(() => {
    // If no conversation is currently selected
    if (!conversation) {
      if (conversations.length > 0) {
        // If there are existing conversations, select the latest one
        handleSelectConversation(conversations[0].id);
      } else {
        // If no conversations exist at all, create a new one
        initializeNewConversation();
      }
    }
  }, [conversation, conversations, handleSelectConversation, initializeNewConversation]);

  const handleModelChange = useCallback(async (modelId) => {
    setPreferredModel(modelId);
    localStorage.setItem('jasper_preferred_model', modelId);
    if (conversation) {
      try {
        await base44.agents.updateConversation(conversation.id, {
          metadata: { ...(conversation.metadata || {}), preferred_model: modelId }
        });
      } catch (e) { console.log('Could not persist model preference', e); }
    }
  }, [conversation]);

  const toggleDirectLLMMode = useCallback((v) => {
    setDirectLLMMode(v);
    localStorage.setItem('jasper_direct_llm', String(v));
  }, []);

  const consolidateMemory = useCallback(async (recentMessages) => {
    const now = Date.now();
    if (now - lastConsolidateRef.current < 30000) return; // debounce 30s
    lastConsolidateRef.current = now;
    try {
      await base44.functions.invoke('crossChatMemory', {
        action: 'consolidate',
        messages: recentMessages,
      });
    } catch (e) {
      // silent — memory consolidation is best-effort
    }
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !conversation || isLoading) return;

    setIsLoading(true);
    setError(null);
    // Attach the current live-vision frame (if active) so Jasper can see the screen in real time
    const liveFrame = liveVisionActive ? liveVisionUrlRef.current : null;
    const visionNote = liveFrame ? '\n\n[Jasper can currently see my screen via Live Vision — reference what you observe.]' : '';
    const userMessage = { role: 'user', content: input + visionNote, ...(liveFrame ? { file_urls: [liveFrame] } : {}) };
    setInput('');
    setMessages(prevMessages => [...prevMessages, userMessage]);

    // Consolidate memory from the recent exchange (fire-and-forget, debounced)
    consolidateMemory([...messages, userMessage]);

    // Direct LLM mode: route straight through the selected model with Jasper's persona
    if (directLLMMode) {
      try {
        const m = MODELS.find(x => x.id === preferredModel) || MODELS[0];
        const history = messages
          .filter(msg => msg.content && typeof msg.content === 'string')
          .slice(-10)
          .map(msg => `${msg.role === 'user' ? 'User' : 'Jasper'}: ${msg.content}`)
          .join('\n');
        const memoryBlock = memorySummary ? `\nWhat you remember about the user from previous conversations: ${memorySummary}\n` : '';
        const personaPrompt = `You are Jasperine ("Jasper"), a warm, articulate, British-inflected female AI. Speak with a light British inflection — warm, never stiff. Think with the user, don't lecture. Subtle humour when appropriate.${memoryBlock}\n\nConversation so far:\n${history}\n\nUser: ${input}\n\nRespond as Jasper:`;
        let reply = '';
        let proofReasoning = `Direct LLM mode — routed to ${m.name}`;
        if (m.provider === 'free') {
          const fr = await base44.functions.invoke('freeLLMRouter', {
            prompt: personaPrompt,
            provider_preference: m.free_provider,
          });
          reply = fr?.response || fr?.data || (typeof fr === 'string' ? fr : JSON.stringify(fr));
          proofReasoning = `Free-tier provider — ${m.name}`;
        } else {
          const llmOpts = {
            prompt: personaPrompt,
            model: m.model,
            response_json_schema: { type: 'object', properties: { reply: { type: 'string' } } },
          };
          if (liveFrame) llmOpts.file_urls = [liveFrame];
          const res = await base44.integrations.Core.InvokeLLM(llmOpts);
          reply = res?.reply || (typeof res === 'string' ? res : JSON.stringify(res));
        }
        const assistantMessage = {
          role: 'assistant',
          content: reply,
          metadata: { proof: { source: m.name, model: m.model, reasoning: proofReasoning } }
        };
        setMessages(prev => [...prev, assistantMessage]);
      } catch (err) {
        console.error("Direct LLM Error:", err);
        setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I hit a snag reaching that model: ${err.message}` }]);
        setError("Direct LLM call failed.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      let agentMessage = userMessage;
      // Inject recalled memory context on the first message of a new conversation
      if (!memoryInjectedRef.current && memorySummary) {
        agentMessage = { role: 'user', content: `[Context from our previous conversations — what you remember about me and our work: ${memorySummary}]\n\n---\n\n${input}` };
        memoryInjectedRef.current = true;
      }
      await base44.agents.addMessage(conversation, agentMessage);
    } catch (err) {
      console.error("Send Message Error:", err);
      const errorMessage = { role: 'assistant', content: "Sorry, I'm having trouble connecting to the network. Please try again in a moment." };
      setMessages(prev => [...prev, errorMessage]);
      setError("Message failed to send. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [input, conversation, isLoading, directLLMMode, preferredModel, memorySummary, messages, consolidateMemory, liveVisionActive, setMessages, setIsLoading, setError]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Send an uploaded file (drag-drop or screen capture) to Jasper as a user message with file_urls
  const sendFileToJasper = useCallback(async (fileUrl, label) => {
    if (!conversation) return;
    setIsLoading(true);
    try {
      const userMessage = {
        role: 'user',
        content: label,
        image_url: fileUrl,
      };
      setMessages(prev => [...prev, userMessage]);
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: label,
        file_urls: [fileUrl],
      });
    } catch (err) {
      console.error('Send file error:', err);
      setError('Failed to share content with Jasper.');
    } finally {
      setIsLoading(false);
    }
  }, [conversation, setMessages, setIsLoading, setError]);

  const handleFilesUploaded = useCallback(async (uploaded) => {
    for (const f of uploaded) {
      const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(f.file_name);
      const label = isImage
        ? `I've shared an image (${f.file_name}) — take a look and let me know what you see.`
        : `I've shared a file (${f.file_name}) — please review and help with it.`;
      await sendFileToJasper(f.file_url, label);
    }
  }, [sendFileToJasper]);

  const handleScreenCapture = useCallback(async (fileUrl) => {
    await sendFileToJasper(fileUrl, "Here's a capture of my screen — what do you see? Help me with what's on it.");
  }, [sendFileToJasper]);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      <AegisHeartbeat />
      <SystemHeartbeat />
      <ImageGeneratorPanel
        open={showImageGen}
        onClose={() => setShowImageGen(false)}
        onImageGenerated={(prompt, imageUrl, style) => {
          const userMsg = { role: 'user', content: `Generate a ${style.replace('_', ' ')} 3D image: ${prompt}` };
          const assistantMsg = { role: 'assistant', content: `![Generated 3D Image](${imageUrl})\n\n*${prompt}*` };
          setMessages(prev => [...prev, userMsg, assistantMsg]);
        }}
      />
      <AIControlsPanel
        open={showAIControls}
        onClose={() => setShowAIControls(false)}
        preferredModel={preferredModel}
        onModelChange={handleModelChange}
        directLLMMode={directLLMMode}
        onDirectLLMModeChange={toggleDirectLLMMode}
      />
      <ScreenSharePanel
        open={showScreenShare}
        onClose={() => setShowScreenShare(false)}
        onCaptureSent={async (url) => { await handleScreenCapture(url); }}
        onLiveFrame={(url) => {
          liveVisionUrlRef.current = url;
          setLiveVisionActive(!!url);
        }}
      />
      <VideoGeneratorPanel
        open={showVideoGen}
        onClose={() => setShowVideoGen(false)}
        onVideoGenerated={(promptText, firstUrl, allClips) => {
          const clipList = allClips.map((c, i) => `Scene ${i + 1}: [${c.url}](${c.url})`).join('\n');
          const content = allClips.length > 1
            ? `🎬 Generated a ${allClips.length}-scene storyboard video:\n\n${clipList}`
            : `🎬 Generated a video clip: [${firstUrl}](${firstUrl})`;
          setMessages(prev => [...prev, { role: 'user', content: `Generate video: ${promptText}` }, { role: 'assistant', content }]);
        }}
      />
      <header className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <ConversationHistory
              conversations={conversations}
              selectedConversationId={conversation?.id}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
              onNewConversation={handleNewConversation}
              isLoading={isLoading}
            />
            <div className="h-7 w-7 rounded-full overflow-hidden ring-2 ring-blue-500/50 shadow-[0_0_10px_2px_rgba(59,130,246,0.6)]">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693d9a99ca82e178be7bca1b/e908cc8ba_arthur-artwork-1765675024047.png" 
                alt="Jasper AI" 
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-xl font-bold text-white">Jasper</h1>
            {liveVisionActive && (
              <button
                onClick={() => setShowScreenShare(true)}
                className="flex items-center gap-1.5 rounded-full bg-red-600/20 border border-red-500/40 px-2.5 py-1 text-xs text-red-300 hover:bg-red-600/30 transition-colors"
                title="Jasper is watching your screen in real time — click to manage"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="font-medium">Live Vision</span>
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <ModelSelector value={preferredModel} onChange={handleModelChange} onOpenPreferences={() => setShowAIControls(true)} />
            <Button
              onClick={() => setShowAIControls(true)}
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-slate-200"
              title="AI Controls"
            >
              <Settings2 className="h-5 w-5" />
            </Button>
            <Button
              onClick={toggleWakeWord}
              variant="ghost"
              size="icon"
              className={`${wakeWordEnabled ? 'text-green-400 animate-pulse' : 'text-slate-500'} hover:text-green-300`}
              title={wakeWordEnabled ? 'Wake word active - Say "Hey Jasper"' : 'Click to enable wake word'}
            >
              <Radio className="h-5 w-5" />
            </Button>
            <Button
              onClick={toggleVoice}
              variant="ghost"
              size="icon"
              className={`${isSpeaking ? 'text-red-400 animate-pulse' : voiceEnabled ? 'text-blue-400' : 'text-slate-500'} hover:text-blue-300`}
              title={isSpeaking ? 'Click to stop speaking (or press Escape)' : voiceEnabled ? 'Voice enabled - Click to disable' : 'Voice disabled - Click to enable'}
            >
              {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <FileDropZone onFilesUploaded={handleFilesUploaded} disabled={!conversation || isLoading}>
        <main ref={scrollAreaRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, index) => (
            <Message key={index} message={msg} onDeploy={handleDeployAgent} showProof={showProof} />
          ))}
          {isLoading && messages.length > 0 && (
            <div className="flex gap-4 justify-start items-center">
               <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-blue-500/50 shadow-[0_0_12px_2px_rgba(59,130,246,0.6)]">
                 <img 
                   src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693d9a99ca82e178be7bca1b/e908cc8ba_arthur-artwork-1765675024047.png" 
                   alt="Jasper AI" 
                   className="w-full h-full object-cover"
                 />
               </div>
              <div className="px-4 py-3 rounded-2xl bg-slate-800 flex items-center gap-2">
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-pulse"></span>
              </div>
            </div>
          )}
        </main>
      </FileDropZone>

      <footer className="p-4 border-t border-slate-800">
        {error && (
            <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? "Listening..." : "Ask me anything, old chap..."}
              className="bg-slate-800 border-slate-700 rounded-lg pr-24 text-white placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
              rows={1}
              disabled={!conversation || isLoading || isListening}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <Button
                size="icon"
                className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600"
                onClick={() => setShowScreenShare(true)}
                disabled={!conversation || isLoading}
                title="Share your screen with Jasper"
              >
                <Monitor className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600"
                onClick={() => setShowVideoGen(true)}
                disabled={!conversation || isLoading}
                title="Generate video"
              >
                <Clapperboard className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600"
                onClick={() => setShowImageGen(true)}
                disabled={!conversation || isLoading}
                title="Generate 3D image"
              >
                <Box className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                className={`${isListening ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'} disabled:bg-slate-600`}
                onClick={toggleListening}
                disabled={!conversation || isLoading}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                size="icon"
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600"
                onClick={handleSendMessage}
                disabled={!input.trim() || !conversation || isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <p className="text-xs text-center text-slate-500 mt-2">
            {isSpeaking && <span className="text-blue-400">🎙️ Jasper is speaking... </span>}
            {wakeWordEnabled && <span className="text-green-400">👂 Listening for "Hey Jasper"... </span>}
            {!isSpeaking && !wakeWordEnabled && "Jasper speaks with a charming British accent. Enable wake word to say 'Hey Jasper'."}
          </p>
        </div>
      </footer>
    </div>
  );
}