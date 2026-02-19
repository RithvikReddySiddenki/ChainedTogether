'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Divider } from './ui/Divider';
import { zeroGClient } from '@/services/0gComputeClient';
import type { IntakeMessage, ExtractedProfile } from '@/types';

interface IntakeChatProps {
  sessionId: string;
  imageUrl: string;
  walletAddress: string;
  onComplete: (extracted: ExtractedProfile, summary: string[]) => void;
}

export function IntakeChat({ sessionId, imageUrl, walletAddress, onComplete }: IntakeChatProps) {
  const [messages, setMessages] = useState<IntakeMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedProfile | null>(null);
  const [summary, setSummary] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize conversation
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const response = await zeroGClient.startIntake();
        const agentMsg: IntakeMessage = {
          id: Date.now(),
          session_id: sessionId,
          role: 'agent',
          content: response.agentMessage,
          created_at: new Date().toISOString(),
        };
        setMessages([agentMsg]);

        // Save to Supabase
        await saveMessage(agentMsg);
      } catch (error) {
        console.error('Failed to start intake:', error);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [sessionId]);

  async function saveMessage(msg: Omit<IntakeMessage, 'id'> & { id?: number }) {
    // TODO: Save to Supabase
    // const { error } = await supabase
    //   .from('intake_messages')
    //   .insert({ session_id: msg.session_id, role: msg.role, content: msg.content });
    // if (error) console.error('Failed to save message:', error);
  }

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMsg: IntakeMessage = {
      id: Date.now(),
      session_id: sessionId,
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Save user message
    await saveMessage(userMsg);

    try {
      // Get next question or finalize
      const response = await zeroGClient.nextQuestion({
        intakeSessionId: sessionId,
        userMessage: userMsg.content,
        history: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
      });

      const agentMsg: IntakeMessage = {
        id: Date.now() + 1,
        session_id: sessionId,
        role: 'agent',
        content: response.agentMessage,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, agentMsg]);
      await saveMessage(agentMsg);

      if (response.done && response.extracted && response.summary) {
        // Show confirmation
        setExtracted(response.extracted);
        setSummary(response.summary);
        setShowConfirmation(true);
      }
    } catch (error) {
      console.error('Failed to get next question:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (extracted && summary) {
      onComplete(extracted, summary);
    }
  }

  function handleEdit() {
    // User wants to edit - continue conversation
    setShowConfirmation(false);
    setExtracted(null);
    setSummary([]);

    const editMsg: IntakeMessage = {
      id: Date.now(),
      session_id: sessionId,
      role: 'agent',
      content: "Sure! What would you like to change or add?",
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, editMsg]);
  }

  if (showConfirmation) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent>
          <h3 className="text-xl font-semibold mb-4">Confirm Your Profile</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            Here's what I learned about you. Does this look correct?
          </p>

          <div className="space-y-2 mb-6">
            {summary.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-[hsl(var(--accent))]">•</span>
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>

          <Divider className="my-4" />

          <div className="flex gap-3">
            <Button onClick={handleConfirm} className="flex-1">
              Looks Great!
            </Button>
            <Button onClick={handleEdit} variant="outline" className="flex-1">
              Let Me Edit
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="h-[600px] flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'accent text-white'
                    : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[hsl(var(--muted))] px-4 py-2 rounded-lg">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <Divider />

        {/* Input */}
        <div className="p-4 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type your answer..."
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
