"use client";

import { useState, useRef, useEffect } from "react";
import { sendAssistantMessage, interpretVoice } from "@/lib/api";
import { ChatMessageResponse, ActionConfirmation } from "@/types/student";

interface MessageItem {
  id: string;
  sender: "user" | "assistant";
  text: string;
  trustCategory?: string;
  sourcesCited?: string[];
  toolsUsed?: string[];
  pendingConfirmation?: ActionConfirmation | null;
}

const DEFAULT_PROMPTS = [
  "What should I do today?",
  "What is blocking my applications?",
  "Which scholarships should I focus on?",
  "How much funding am I pursuing?",
  "What evidence is in my Evidence Bank?",
  "Update my weekly hours to 6 hours.",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "intro",
      sender: "assistant",
      text: "Hello Arjun! I am your SCHOLARAi Assistant.\n\nI can help evaluate shared application blockers, suggest high-yield weekly actions, verify scholarship rules against official documentation, and ground essay answers in your Evidence Bank.\n\nWhat would you like to review today?",
      trustCategory: "AI ANALYSIS",
      sourcesCited: ["Student Portfolio & Catalog Registry"],
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState("");
  const [voiceInterpreting, setVoiceInterpreting] = useState(false);
  const [voiceConfirmation, setVoiceConfirmation] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string, confirmedAction?: ActionConfirmation | null) => {
    const trimmed = textToSend.trim();
    if (!trimmed && !confirmedAction) return;

    const userMsgId = `user-${Date.now()}`;
    const newHistory = [
      ...messages,
      {
        id: userMsgId,
        sender: "user" as const,
        text: confirmedAction ? `[Confirmed Action]: ${confirmedAction.description}` : trimmed,
      },
    ];
    setMessages(newHistory);
    if (!confirmedAction) setInputText("");
    setLoading(true);

    try {
      // Map history for API
      const historyPayload = newHistory.map((m) => ({
        role: m.sender,
        content: m.text,
      }));

      const res: ChatMessageResponse = await sendAssistantMessage(
        trimmed || "Confirmed action",
        historyPayload,
        confirmedAction
      );

      const assistantMsgId = `asst-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: "assistant",
          text: res.reply,
          trustCategory: res.trust_category,
          sourcesCited: res.sources_cited,
          toolsUsed: res.tools_used,
          pendingConfirmation: res.pending_action_confirmation,
        },
      ]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "assistant",
          text: "I encountered an error querying the assistant tools. Please try again.",
          trustCategory: "UNKNOWN",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleActionConfirm = (action: ActionConfirmation) => {
    const updatedAction: ActionConfirmation = { ...action, status: "CONFIRMED" };
    handleSendMessage("Confirming requested change", updatedAction);
  };

  const handleActionCancel = (action: ActionConfirmation) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `cancel-${Date.now()}`,
        sender: "assistant",
        text: `Action cancelled. No changes were made to your profile.`,
        trustCategory: "FACTS FROM USER DATA",
      },
    ]);
  };

  // Voice Decoder handling
  const handleVoiceInterpret = async (speechText: string) => {
    if (!speechText.trim()) return;
    setVoiceInterpreting(true);
    try {
      const res = await interpretVoice(speechText);
      setVoiceConfirmation(res);
    } catch (e) {
      console.error(e);
      alert("Voice interpretation failed.");
    } finally {
      setVoiceInterpreting(false);
    }
  };

  const handleApplyVoiceCommand = () => {
    if (!voiceConfirmation) return;
    setVoiceModalOpen(false);
    const textToSubmit = voiceConfirmation.interpreted_text;
    setVoiceConfirmation(null);
    setVoiceQuery("");
    handleSendMessage(textToSubmit);
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-7rem)] pb-4 space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">SCHOLARAi Assistant</h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-800">
              Controlled Tools Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Conversational decision support grounded strictly in verified profile facts and official documentation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setVoiceModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors"
          >
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span>Voice Decoder</span>
          </button>
        </div>
      </div>

      {/* Trust Principle Banner */}
      <div className="px-4 py-2 bg-slate-900 text-slate-300 rounded-lg text-xs flex items-center justify-between flex-shrink-0">
        <span>Trust Principle: <strong>&ldquo;AI assists. Official sources decide. Student approves.&rdquo;</strong></span>
        <span className="text-[11px] text-slate-400">Strictly bounds AI to stored facts</span>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.sender === "user"
                  ? "bg-indigo-600 text-white rounded-br-none"
                  : "bg-slate-50 text-slate-900 border border-slate-200 rounded-bl-none"
              }`}
            >
              {/* Trust Category Pill */}
              {msg.sender === "assistant" && msg.trustCategory && (
                <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span
                    className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full ${
                      msg.trustCategory === "FACTS FROM USER DATA"
                        ? "bg-indigo-100 text-indigo-800"
                        : msg.trustCategory === "OFFICIAL SOURCE INFORMATION"
                        ? "bg-emerald-100 text-emerald-800"
                        : msg.trustCategory === "AI SUGGESTIONS"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {msg.trustCategory}
                  </span>
                </div>
              )}

              <div className="whitespace-pre-line">{msg.text}</div>

              {/* Citations */}
              {msg.sourcesCited && msg.sourcesCited.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
                  <span className="font-semibold text-slate-700">Sources Cited:</span>
                  <ul className="list-disc list-inside">
                    {msg.sourcesCited.map((cite, i) => (
                      <li key={i}>{cite}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Confirmation Request */}
              {msg.pendingConfirmation && msg.pendingConfirmation.status === "PENDING" && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
                  <p className="font-bold text-amber-900">Student Confirmation Required</p>
                  <p className="text-amber-800">{msg.pendingConfirmation.description}</p>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      onClick={() => handleActionConfirm(msg.pendingConfirmation!)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Confirm Change
                    </button>
                    <button
                      onClick={() => handleActionCancel(msg.pendingConfirmation!)}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 p-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
            <span>Gathering structured application context via tools...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 flex-shrink-0 text-xs text-slate-600">
        <span className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider flex-shrink-0">Suggested:</span>
        {DEFAULT_PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(p)}
            className="px-3 py-1 bg-white border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap transition-colors shadow-2xs"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex-shrink-0"
      >
        <button
          type="button"
          onClick={() => setVoiceModalOpen(true)}
          className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Voice query"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>

        <input
          type="text"
          placeholder="Ask about application blockers, weekly planning, or drafting assistance..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={loading}
          className="flex-1 px-3 py-2 text-sm focus:outline-none focus:ring-0 bg-transparent"
        />

        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs disabled:opacity-40 transition-colors"
        >
          Send
        </button>
      </form>

      {/* Voice Decoder Modal */}
      {voiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Voice Intent Decoder</h2>
                  <p className="text-[11px] text-slate-500">Supports English, Tamil, and Tanglish</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setVoiceModalOpen(false);
                  setVoiceConfirmation(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Type or speak your intent. The decoder identifies goals, weekly hours, or search requests and prompts for your explicit confirmation.
              </p>

              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setVoiceQuery("I have 5 hours this week.")}
                  className="px-2 py-1 bg-slate-100 rounded text-[11px] hover:bg-slate-200"
                >
                  &ldquo;I have 5 hours this week&rdquo;
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceQuery("Enakku sixty thousand fees funding thevai irukku.")}
                  className="px-2 py-1 bg-slate-100 rounded text-[11px] hover:bg-slate-200"
                >
                  &ldquo;Enakku sixty thousand fees...&rdquo; (Tanglish)
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceQuery("What document is blocking my applications?")}
                  className="px-2 py-1 bg-slate-100 rounded text-[11px] hover:bg-slate-200"
                >
                  &ldquo;What document is blocking...&rdquo;
                </button>
              </div>

              <textarea
                rows={2}
                value={voiceQuery}
                onChange={(e) => setVoiceQuery(e.target.value)}
                placeholder="Spoken query transcription..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />

              <button
                type="button"
                onClick={() => handleVoiceInterpret(voiceQuery)}
                disabled={voiceInterpreting || !voiceQuery.trim()}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {voiceInterpreting ? "Interpreting..." : "Decode Spoken Intent"}
              </button>

              {/* Confirmation Dialog */}
              {voiceConfirmation && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2 mt-3">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-200 text-indigo-800">
                    Intent: {voiceConfirmation.intent} ({voiceConfirmation.detected_language})
                  </span>
                  <p className="font-semibold text-slate-900 whitespace-pre-line text-xs">
                    {voiceConfirmation.confirmation_message}
                  </p>
                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={handleApplyVoiceCommand}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceConfirmation(null)}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceConfirmation(null);
                        setVoiceModalOpen(false);
                      }}
                      className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
