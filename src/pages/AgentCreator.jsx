import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
    Sparkles, 
    Send, 
    Loader2, 
    Brain, 
    Zap, 
    CheckCircle, 
    AlertCircle,
    TrendingUp,
    Plug
} from 'lucide-react';

export default function AgentCreator() {
    const [prompt, setPrompt] = useState('');
    const [agentName, setAgentName] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedSpec, setGeneratedSpec] = useState(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [existingAgents, setExistingAgents] = useState([]);

    useEffect(() => {
        loadExistingAgents();
    }, []);

    const loadExistingAgents = async () => {
        try {
            const response = await base44.functions.invoke('listAgents', {});
            setExistingAgents(response.data.agents || []);
        } catch (error) {
            console.error('Error loading agents:', error);
        }
    };

    const handleGenerateAgent = async () => {
        if (!prompt.trim() || !agentName.trim()) {
            setError('Please provide both agent name and description');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await base44.functions.invoke('generateAgentFromPrompt', {
                agent_name: agentName,
                user_prompt: prompt
            });

            setGeneratedSpec(response.data.agent_spec);
            setSuccess('Agent specification generated successfully!');
        } catch (error) {
            setError(error.message || 'Failed to generate agent');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeployAgent = async () => {
        if (!generatedSpec) return;

        setIsDeploying(true);
        setError(null);

        try {
            await base44.functions.invoke('createAgent', {
                agent_spec: generatedSpec
            });

            setSuccess('Agent deployed successfully!');
            setGeneratedSpec(null);
            setPrompt('');
            setAgentName('');
            await loadExistingAgents();
        } catch (error) {
            setError(error.message || 'Failed to deploy agent');
        } finally {
            setIsDeploying(false);
        }
    };

    const handleEnableAdaptiveLearning = async (agentName) => {
        try {
            await base44.functions.invoke('enableAdaptiveLearning', {
                agent_name: agentName,
                learning_enabled: true
            });
            setSuccess(`Adaptive learning enabled for ${agentName}`);
            await loadExistingAgents();
        } catch (error) {
            setError(error.message || 'Failed to enable learning');
        }
    };

    const handleDiscoverTools = async (agentName) => {
        try {
            setSuccess(`${agentName} is discovering new tools...`);
            const response = await base44.functions.invoke('autonomousToolDiscovery', {
                agent_name: agentName,
                discover_mode: 'active'
            });
            setSuccess(`Discovered ${response.data.tools_found || 0} new tools for ${agentName}`);
            await loadExistingAgents();
        } catch (error) {
            setError(error.message || 'Tool discovery failed');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <Brain className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">AI Agent Creator</h1>
                        <p className="text-slate-400">Design autonomous agents with natural language</p>
                    </div>
                </div>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert className="bg-green-500/20 border-green-500/50">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <AlertDescription className="text-green-300">{success}</AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-400" />
                                Create New Agent
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                Describe your agent's personality, goals, and capabilities
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-300 mb-2 block">Agent Name</label>
                                <Input
                                    placeholder="e.g., DataAnalyst, CreativeWriter, DevOps Expert"
                                    value={agentName}
                                    onChange={(e) => setAgentName(e.target.value)}
                                    className="bg-slate-700 border-slate-600 text-white"
                                />
                            </div>

                            <div>
                                <label className="text-sm text-slate-300 mb-2 block">Agent Description</label>
                                <Textarea
                                    placeholder="Describe what you want this agent to do. Examples:&#10;- 'A data analyst that can process CSV files, generate insights, and create visualizations'&#10;- 'A creative writer that helps with blog posts, marketing copy, and social media content'&#10;- 'A DevOps engineer that monitors systems, deploys code, and troubleshoots issues'"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="bg-slate-700 border-slate-600 text-white min-h-[200px]"
                                />
                            </div>

                            <Button
                                onClick={handleGenerateAgent}
                                disabled={isGenerating || !prompt.trim() || !agentName.trim()}
                                className="w-full bg-purple-600 hover:bg-purple-700"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Generating Agent...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Generate Agent
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {generatedSpec && (
                        <Card className="bg-slate-800 border-slate-700">
                            <CardHeader>
                                <CardTitle className="text-white">Generated Agent Specification</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">{generatedSpec.name}</h3>
                                    <p className="text-sm text-slate-300 mb-4">{generatedSpec.description}</p>
                                </div>

                                <div>
                                    <label className="text-sm text-slate-400 mb-2 block">Core Instructions</label>
                                    <div className="bg-slate-700/50 p-3 rounded-lg text-xs text-slate-300 max-h-40 overflow-y-auto">
                                        {generatedSpec.instructions}
                                    </div>
                                </div>

                                {generatedSpec.tool_configs && generatedSpec.tool_configs.length > 0 && (
                                    <div>
                                        <label className="text-sm text-slate-400 mb-2 block">Tools & Capabilities</label>
                                        <div className="flex flex-wrap gap-2">
                                            {generatedSpec.tool_configs.map((tool, idx) => (
                                                <Badge key={idx} className="bg-blue-500/20 text-blue-300">
                                                    {tool.function_name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <Button
                                    onClick={handleDeployAgent}
                                    disabled={isDeploying}
                                    className="w-full bg-green-600 hover:bg-green-700"
                                >
                                    {isDeploying ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Deploying...
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="h-4 w-4 mr-2" />
                                            Deploy Agent
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white">Your Agents</CardTitle>
                        <CardDescription className="text-slate-400">
                            Manage learning and tool discovery for deployed agents
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {existingAgents.map((agent) => (
                                <Card key={agent.name} className="bg-slate-700 border-slate-600">
                                    <CardContent className="p-4">
                                        <h3 className="text-white font-semibold mb-2">{agent.name}</h3>
                                        <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                                            {agent.description}
                                        </p>
                                        
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleEnableAdaptiveLearning(agent.name)}
                                                className="flex-1 text-xs"
                                            >
                                                <TrendingUp className="h-3 w-3 mr-1" />
                                                Learn
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleDiscoverTools(agent.name)}
                                                className="flex-1 text-xs"
                                            >
                                                <Plug className="h-3 w-3 mr-1" />
                                                Discover
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}