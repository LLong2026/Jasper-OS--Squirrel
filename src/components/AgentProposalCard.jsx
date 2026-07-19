import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileJson, Cpu, Bot, Send } from 'lucide-react';

export default function AgentProposalCard({ agentSpec, onDeploy }) {

  const handleDeployClick = () => {
    if(onDeploy) {
      onDeploy(agentSpec);
    }
  };

  return (
    <Card className="bg-slate-800/80 border-blue-500/50 shadow-lg shadow-blue-500/20 max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-blue-300">
          <Bot className="h-6 w-6" />
          <span>Agent Deployment Proposal</span>
        </CardTitle>
        <CardDescription className="text-slate-400">
          A new expert agent has been designed and validated. Review and approve for integration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold text-white flex items-center gap-2"><FileJson className="h-4 w-4" />Name</h4>
          <code className="text-green-400 bg-slate-900 px-2 py-1 rounded-md text-sm">{agentSpec.name}</code>
        </div>
        <div>
          <h4 className="font-semibold text-white">Description</h4>
          <p className="text-slate-300 text-sm">{agentSpec.description}</p>
        </div>
        <div>
          <h4 className="font-semibold text-white">Instructions</h4>
          <p className="text-slate-300 text-sm max-h-24 overflow-y-auto bg-slate-900/50 p-2 rounded-md">{agentSpec.instructions}</p>
        </div>
        {agentSpec.tool_configs && agentSpec.tool_configs.length > 0 && (
          <div>
            <h4 className="font-semibold text-white flex items-center gap-2"><Cpu className="h-4 w-4" />Tools</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {agentSpec.tool_configs.map((tool, index) => (
                <Badge key={index} variant="secondary" className="bg-slate-700 text-slate-200">{tool.function_name || tool.entity_name}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleDeployClick} className="w-full bg-green-600 hover:bg-green-700">
          <Send className="mr-2 h-4 w-4" />
          Approve & Deploy Agent
        </Button>
      </CardFooter>
    </Card>
  );
}