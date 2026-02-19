'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { WalletConnect } from '@/components/WalletConnect';
import { supabase } from '@/lib/supabase';
import { CONTRACT_ADDRESSES, MATCH_REGISTRY_ABI } from '@/lib/contracts';
import type { ChatMessage, Profile } from '@/types';

export default function ChatPage() {
  const params = useParams();
  const matchId = parseInt(params.matchId as string);
  const { address, isConnected } = useAccount();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if match is approved
  const { data: approved } = useReadContract({
    address: CONTRACT_ADDRESSES.matchRegistry,
    abi: MATCH_REGISTRY_ABI,
    functionName: 'isMatchApproved',
    args: [BigInt(matchId)],
  });

  // Get proposal details
  const { data: proposal } = useReadContract({
    address: CONTRACT_ADDRESSES.matchRegistry,
    abi: MATCH_REGISTRY_ABI,
    functionName: 'getProposal',
    args: [BigInt(matchId)],
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isConnected && approved && proposal) {
      initChat();
    }
  }, [isConnected, approved, proposal]);

  async function initChat() {
    try {
      setIsApproved(!!approved);

      if (!approved || !proposal) {
        setLoading(false);
        return;
      }

      // Check if user is participant
      const userA = proposal.userA.toLowerCase();
      const userB = proposal.userB.toLowerCase();
      const currentUser = address!.toLowerCase();

      const participant = currentUser === userA || currentUser === userB;
      setIsParticipant(participant);

      if (!participant) {
        setLoading(false);
        return;
      }

      // Get other person's address
      const otherAddress = currentUser === userA ? userB : userA;

      // Fetch other person's profile (ONLY basic info)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('wallet_address, name, age, location, image_url')
        .eq('wallet_address', otherAddress)
        .single();

      if (error) throw error;
      setOtherProfile(profile);

      // Load messages
      await loadMessages();

      // Poll for new messages (in production, use Supabase realtime)
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    } catch (error) {
      console.error('Failed to init chat:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages() {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  async function handleSend() {
    if (!input.trim()) return;

    try {
      const { error } = await supabase.from('chats').insert({
        match_id: matchId,
        sender: address!.toLowerCase(),
        message: input.trim(),
      });

      if (error) throw error;

      setInput('');
      await loadMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Check console for details.');
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Connect Your Wallet</h2>
            <WalletConnect />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto text-center">
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="text-center space-y-4">
              <h2 className="text-2xl font-bold">Match Not Approved</h2>
              <p className="text-[hsl(var(--muted-foreground))]">
                This match is not approved yet. Wait for DAO voting to complete.
              </p>
              <Button onClick={() => (window.location.href = '/proposals')}>
                View Proposals
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isParticipant) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="text-center space-y-4">
              <h2 className="text-2xl font-bold">Access Denied</h2>
              <p className="text-[hsl(var(--muted-foreground))]">
                You are not a participant in this match.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        {/* Other person's info */}
        {otherProfile && (
          <Card className="mb-4">
            <CardContent className="flex items-center gap-4">
              <img
                src={otherProfile.image_url}
                alt={otherProfile.name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <h2 className="text-xl font-semibold">{otherProfile.name}</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {otherProfile.age} • {otherProfile.location}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chat */}
        <Card className="h-[600px] flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-[hsl(var(--muted-foreground))]">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender.toLowerCase() === address!.toLowerCase();
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-lg ${
                        isMe
                          ? 'accent text-white'
                          : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <Divider />

          <div className="p-4 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!input.trim()}>
              Send
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
