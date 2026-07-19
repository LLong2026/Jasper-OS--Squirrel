import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Search, Sparkles, Loader2, Download, Landmark } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { fetchLiveFeed } from '@/functions/fetchLiveFeed';
import { processPrivateData } from '@/functions/processPrivateData';
import { InvokeLLM, UploadFile, ExtractDataFromUploadedFile } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import OptimizationTrendsChart from '@/components/research/OptimizationTrendsChart';
import ReactMarkdown from 'react-markdown';

export default function ResearchWorkbench() {
  const [topic, setTopic] = useState('Quantum Computing');
  const [userNotes, setUserNotes] = useState('');
  const [arxivData, setArxivData] = useState(null);
  const [personalAnalysis, setPersonalAnalysis] = useState(null);
  const [synthesis, setSynthesis] = useState('');
  const [isLoading, setIsLoading] = useState({
    arxiv: false,
    personal: false,
    financial: false,
    synthesis: false
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isoMessage, setIsoMessage] = useState('');
  const [isoFields, setIsoFields] = useState({ debtor: '', creditor: '', amount: '', currency: 'USD' });
  const [bridgeResult, setBridgeResult] = useState(null);

  const handleFetchArxiv = async () => {
    setIsLoading(prev => ({ ...prev, arxiv: true }));
    try {
      const { data } = await fetchLiveFeed({ feed_name: 'arXiv', query: topic });
      setArxivData(data);
    } catch (error) {
      console.error("Error fetching arXiv data:", error);
    }
    setIsLoading(prev => ({ ...prev, arxiv: false }));
  };

  const handleAnalyzeNotes = async () => {
    if (!userNotes.trim()) return;
    setIsLoading(prev => ({ ...prev, personal: true }));
    try {
      const { data } = await processPrivateData({ data: userNotes, data_type: 'User Research Notes' });
      const analyzed = data || { raw_notes: userNotes };
      setPersonalAnalysis(analyzed);
      // Auto-advance: synthesize the report immediately once notes are analyzed
      await runSynthesis(arxivData, analyzed, userNotes, topic);
    } catch (error) {
      console.error("Error analyzing personal notes:", error);
      // Fall back to raw notes so synthesis can still proceed
      const fallback = { raw_notes: userNotes };
      setPersonalAnalysis(fallback);
      await runSynthesis(arxivData, fallback, userNotes, topic);
    }
    setIsLoading(prev => ({ ...prev, personal: false }));
  };
  
  const handleProcessISO = async () => {
    setIsLoading(prev => ({ ...prev, financial: true }));
    try {
      let rawDoc;
      if (isoMessage.trim()) {
        // Try to parse pasted ISO 20022 XML/JSON
        let parsed;
        try {
          parsed = JSON.parse(isoMessage);
        } catch (_) {
          // Crude XML field extraction fallback
          const get = (tag) => {
            const m = isoMessage.match(new RegExp('<' + tag + '>([^<]*)</' + tag + '>'));
            return m ? m[1].trim() : '';
          };
          parsed = {
            debtor: get('Dbtr') || get('InitgPty'),
            creditor: get('Cdtr') || get('CdtrAgt'),
            amount: parseFloat(get('InstdAmt') || '0') || 0,
            currency: 'USD',
            message_id: get('MsgId') || `ISO${Date.now()}`,
          };
        }
        rawDoc = { ...parsed, message_id: parsed.message_id || parsed.end_to_end_id || `ISO${Date.now()}` };
      } else {
        rawDoc = {
          debtor: isoFields.debtor,
          creditor: isoFields.creditor,
          amount: parseFloat(isoFields.amount) || 0,
          currency: isoFields.currency,
          message_id: `ISO${Date.now()}`,
        };
      }
      if (!rawDoc.debtor || !rawDoc.creditor || !rawDoc.amount) {
        setIsLoading(prev => ({ ...prev, financial: false }));
        return;
      }
      const res = await base44.functions.invoke('universalBridge', {
        action: 'orchestrate',
        raw_doc: rawDoc,
        actor: 'research_workbench',
        rails: ['ISO', 'BTC', 'XRP', 'CBDC'],
      });
      setBridgeResult(res);
    } catch (error) {
      console.error('Error processing ISO 20022 message:', error);
    }
    setIsLoading(prev => ({ ...prev, financial: false }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    const isTextFile = file.type.startsWith('text/') || /\.(txt|md|csv|json|log)$/i.test(file.name);
    if (isTextFile) {
      const reader = new FileReader();
      reader.onload = (e) => setUserNotes(e.target.result);
      reader.readAsText(file);
      return;
    }
    // Binary docs (pdf, doc, docx, images) — extract text via the platform
    setIsLoading(prev => ({ ...prev, personal: true }));
    try {
      const { file_url } = await UploadFile({ file });
      const result = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: { type: 'object', properties: { content: { type: 'string' } } }
      });
      const text = result?.output?.content || (typeof result?.output === 'string' ? result.output : '');
      setUserNotes(text || 'Could not extract text from this file. Please paste your notes manually.');
    } catch (error) {
      console.error('Error extracting file content:', error);
      setUserNotes('Failed to read this file type. Please paste your notes manually.');
    } finally {
      setIsLoading(prev => ({ ...prev, personal: false }));
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const runSynthesis = async (arxiv = arxivData, personal = personalAnalysis, notes = userNotes, currentTopic = topic, bridge = bridgeResult) => {
    if (!arxiv && !personal && !bridge) return;
    setIsLoading(prev => ({ ...prev, synthesis: true }));

    const prompt = `
      You are Wednesday, a master synthesizer with a grimly practical outlook. Your task is to dissect two sources of information and produce a novel, insightful, and brutally honest synthesis.

      Source 1: Recent Research from arXiv
      This data contains the latest academic papers on the topic of "${currentTopic}".
      Raw Data:
      ${JSON.stringify(arxiv, null, 2)}

      Source 2: User's Private Research Notes
      This data contains the user's personal thoughts and scribblings on the topic.
      Raw Data:
      ${JSON.stringify(personal, null, 2)}
      User Notes Content:
      "${notes}"

      Source 3: ISO 20022 Financial Messaging (URIB Bridge)
      This data contains processed financial settlement messages with cryptographic proofs from the universal bridge, including cross-rail states and the ISO 20022 pacs.008 output.
      Raw Data:
      ${bridge ? JSON.stringify({ h_doc: bridge.h_doc, c_stack: bridge.c_stack, thread_anchor: bridge.thread_anchor, rail_states: bridge.rail_states, iso20022_messages: bridge.iso20022_messages }, null, 2) : 'No financial messages processed.'}

      Your Synthesis Report Must:
      1.  **Identify the Morbidly Obvious Theme:** What is the central idea connecting the user's notes and the recent research? Be direct.
      2.  **Find Unsettling Connections:** Point out specific, non-obvious links between the user's ideas and concepts in the research. Highlight the strange and unexpected.
      3.  **Identify Gaps in Logic:** Where do the user's ideas falter? What glaring questions does the research raise that the user has foolishly overlooked?
      4.  **Propose 3 Actionable, if Unpleasant, Next Steps:** Suggest three concrete steps for the user to move forward. They should be practical, not aspirational.

      Produce the report in clear, well-structured Markdown format. No fluff.
    `;

    try {
      const response = await InvokeLLM({ prompt });
      setSynthesis(response);
    } catch (error) {
      console.error("Error synthesizing report:", error);
      setSynthesis("Error generating synthesis. Please try again.");
    }
    setIsLoading(prev => ({ ...prev, synthesis: false }));
  };

  const handleDownloadPDF = () => { // Renamed from PDF to TXT in implementation to match outline, but keeping original name from requirements
    if (!synthesis) return;
    
    const element = document.createElement('a');
    const file = new Blob([synthesis], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `wednesday-research-synthesis-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleExportConversations = async () => {
    try {
      // Import agentSDK to get conversations
      const { agentSDK } = await import('@/agents');
      const conversations = await agentSDK.listConversations({ agent_name: "Wednesday" });
      
      const exportData = {
        export_date: new Date().toISOString(),
        total_conversations: conversations.length,
        conversations: conversations.map(conv => ({
          id: conv.id,
          created_date: conv.created_date,
          updated_date: conv.updated_date,
          message_count: conv.messages?.length || 0,
          messages: conv.messages || []
        }))
      };

      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      element.href = URL.createObjectURL(file);
      element.download = `wednesday-conversations-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      console.error("Error exporting conversations:", error);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white min-h-screen font-sans">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-blue-400">Personalized Research & Innovation Engine</h1>
        <p className="text-slate-400 mt-2">Fuse global knowledge with your personal insights. Directed by Wednesday.</p>
      </header>

      <div className="max-w-7xl mx-auto mb-8">
        <OptimizationTrendsChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Input Column */}
        <div className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-300">
                <Search /> 1. Harvest Global Knowledge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Enter research topic (e.g., Quantum Computing)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-slate-800 border-slate-600 focus:ring-blue-500"
              />
              <Button onClick={handleFetchArxiv} disabled={isLoading.arxiv} className="w-full bg-blue-600 hover:bg-blue-700">
                {isLoading.arxiv ? <Loader2 className="animate-spin" /> : "Fetch from arXiv"}
              </Button>
              {arxivData && <p className="text-sm text-green-400">✓ arXiv data fetched successfully.</p>}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-300">
                <Upload /> 2. Ingest Personal Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging 
                    ? 'border-purple-400 bg-purple-400/10' 
                    : 'border-slate-600 hover:border-purple-500 hover:bg-purple-500/5'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-300 mb-2">
                  Drag and drop your research files here
                </p>
                <p className="text-slate-500 text-sm mb-4">
                  or click to browse
                </p>
                <Input 
                  type="file" 
                  onChange={handleFileChange} 
                  className="hidden" 
                  id="file-upload"
                  accept=".txt,.md,.csv,.json,.log,.pdf,.doc,.docx"
                />
                <Button 
                  variant="outline" 
                  onClick={() => document.getElementById('file-upload').click()}
                  className="bg-slate-700 border-slate-600 hover:bg-slate-600"
                >
                  Browse Files
                </Button>
              </div>
              
              <div className="text-center text-slate-400 text-sm">or</div>
              
              <Textarea
                placeholder="Paste your notes, questions, or ideas here..."
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                className="bg-slate-800 border-slate-600 h-32 focus:ring-purple-500"
              />
              
              <Button onClick={handleAnalyzeNotes} disabled={isLoading.personal || !userNotes.trim()} className="w-full bg-purple-600 hover:bg-purple-700">
                {isLoading.personal ? <Loader2 className="animate-spin" /> : "Analyze My Notes"}
              </Button>
              {personalAnalysis && <p className="text-sm text-green-400">✓ Personal notes analyzed successfully.</p>}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-300">
                <Landmark /> 3. Ingest ISO 20022 Financial Messaging
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Debtor" value={isoFields.debtor} onChange={(e) => setIsoFields({...isoFields, debtor: e.target.value})} className="bg-slate-800 border-slate-600 focus:ring-amber-500" />
                <Input placeholder="Creditor" value={isoFields.creditor} onChange={(e) => setIsoFields({...isoFields, creditor: e.target.value})} className="bg-slate-800 border-slate-600 focus:ring-amber-500" />
                <Input placeholder="Amount" type="number" value={isoFields.amount} onChange={(e) => setIsoFields({...isoFields, amount: e.target.value})} className="bg-slate-800 border-slate-600 focus:ring-amber-500" />
                <Input placeholder="Currency" value={isoFields.currency} maxLength={3} onChange={(e) => setIsoFields({...isoFields, currency: e.target.value})} className="bg-slate-800 border-slate-600 focus:ring-amber-500" />
              </div>
              <div className="text-center text-slate-400 text-sm">or paste raw ISO 20022 message (XML/JSON)</div>
              <Textarea placeholder="Paste pacs.008 XML or JSON message here..." value={isoMessage} onChange={(e) => setIsoMessage(e.target.value)} className="bg-slate-800 border-slate-600 h-24 focus:ring-amber-500 font-mono text-xs" />
              <Button onClick={handleProcessISO} disabled={isLoading.financial || (!isoMessage.trim() && (!isoFields.debtor || !isoFields.creditor || !isoFields.amount))} className="w-full bg-amber-600 hover:bg-amber-700">
                {isLoading.financial ? <Loader2 className="animate-spin" /> : "Process via URIB Bridge"}
              </Button>
              {bridgeResult && <p className="text-sm text-green-400">✓ ISO 20022 message processed · C_stack: {bridgeResult.c_stack?.slice(0,16)}…</p>}
            </CardContent>
          </Card>

           <Button onClick={() => runSynthesis()} disabled={isLoading.synthesis || (!arxivData && !personalAnalysis && !bridgeResult)} className="w-full py-6 text-lg bg-green-600 hover:bg-green-700">
            {isLoading.synthesis ? <Loader2 className="animate-spin" /> : <><Sparkles className="mr-2" /> Synthesize Innovation Report</>}
          </Button>
        </div>

        {/* Output Column */}
        <div className="bg-slate-800/50 border-slate-700 rounded-lg p-6">
           <div className="flex justify-between items-center mb-4">
             <h2 className="text-2xl font-bold text-green-300">Innovation Report</h2>
             {synthesis && (
               <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="bg-slate-700 border-slate-600 hover:bg-slate-600">
                 <Download className="w-4 h-4 mr-2" />
                 Download
               </Button>
             )}
           </div>
           {synthesis ? (
             <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{synthesis}</ReactMarkdown>
             </div>
           ) : (
             <div className="text-slate-400 flex flex-col items-center justify-center h-full">
                <Sparkles className="h-16 w-16 text-slate-600 mb-4" />
                Your synthesized report will appear here.
             </div>
           )}
        </div>
      </div>
    </div>
  );
}