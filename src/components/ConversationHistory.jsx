
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Trash2, Plus, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ConversationHistory({ 
  conversations, 
  selectedConversationId, 
  onSelectConversation, 
  onDeleteConversation, 
  onNewConversation 
}) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getConversationTitle = (conversation) => {
    if (conversation.metadata?.name) {
      return conversation.metadata.name;
    }
    // Get first user message as title
    const firstUserMessage = conversation.messages?.find(m => m.role === 'user');
    if (firstUserMessage) {
      return firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
    }
    return 'New Chat';
  };

  const handleDelete = (e, conversationId) => {
    e.stopPropagation();
    onDeleteConversation(conversationId);
  };
  
  const handleDownload = (e, conversation) => {
    e.stopPropagation();
    
    // The conversation object already contains all messages
    const exportData = JSON.stringify(conversation, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    
    // Create a clean filename from the title
    const title = getConversationTitle(conversation).replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
    a.download = `wednesday-conversation-${title}-${conversation.id.slice(0, 8)}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          <History className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-80 bg-slate-900 border-slate-700 text-slate-100"
      >
        <div className="p-2">
          <Button 
            onClick={() => {
              onNewConversation();
              setIsOpen(false);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 mb-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
        
        {conversations.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-slate-700" />
            <ScrollArea className="h-[400px]">
              <div className="p-1">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-md hover:bg-slate-800 cursor-pointer group",
                      selectedConversationId === conversation.id && "bg-slate-800"
                    )}
                    onClick={() => {
                      onSelectConversation(conversation.id);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-4 w-4 rounded-full overflow-hidden flex-shrink-0">
                          <img 
                            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68cb3e322da78c89c08a1bdb/344c0d367_image.png" 
                            alt="Wednesday AI" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.classList.add('bg-blue-500');
                            }}
                          />
                        </div>
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {getConversationTitle(conversation)}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">
                        {formatDate(conversation.updated_date)}
                      </p>
                    </div>
                    <div className="flex items-center flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10"
                          title="Download conversation"
                          onClick={(e) => handleDownload(e, conversation)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                          title="Delete conversation"
                          onClick={(e) => handleDelete(e, conversation.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
        
        {conversations.length === 0 && (
          <div className="p-4 text-center text-slate-400 text-sm">
            No conversation history yet
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
