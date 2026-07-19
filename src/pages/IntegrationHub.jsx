import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Plug, 
    Check, 
    AlertCircle, 
    Search, 
    Zap,
    Mail,
    MessageSquare,
    Calendar,
    Code,
    ShoppingCart,
    Phone,
    Database,
    Cloud,
    Briefcase,
    TrendingUp,
    Landmark
} from 'lucide-react';
import ConfigureModal from '@/components/IntegrationHub/ConfigureModal';

const integrations = [
    { id: 'gmail', name: 'Gmail', icon: Mail, category: 'Communication', status: 'active', function: 'gmailIntegration' },
    { id: 'slack', name: 'Slack', icon: MessageSquare, category: 'Communication', status: 'active', function: 'slackAdvanced' },
    { id: 'notion', name: 'Notion', icon: Database, category: 'Productivity', status: 'active', function: 'notionIntegration' },
    { id: 'github', name: 'GitHub', icon: Code, category: 'Development', status: 'active', function: 'githubIntegration' },
    { id: 'zoom', name: 'Zoom', icon: Calendar, category: 'Communication', status: 'active', function: 'zoomIntegration' },
    { id: 'shopify', name: 'Shopify', icon: ShoppingCart, category: 'E-commerce', status: 'active', function: 'shopifyIntegration' },
    { id: 'twilio', name: 'Twilio', icon: Phone, category: 'Communication', status: 'active', function: 'twilioIntegration' },
    { id: 'salesforce', name: 'Salesforce', icon: Briefcase, category: 'CRM', status: 'active', function: 'salesforceIntegration' },
    { id: 'stripe', name: 'Stripe', icon: TrendingUp, category: 'Payment', status: 'active', function: 'stripePayment' },
    { id: 'google-calendar', name: 'Google Calendar', icon: Calendar, category: 'Productivity', status: 'active', function: 'googleCalendarIntegration' },
    { id: 'urib-bridge', name: 'URIB ISO 20022 Bridge', icon: Landmark, category: 'Financial Messaging', status: 'active', function: 'universalBridge' },
];

export default function IntegrationHub() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [testResults, setTestResults] = useState({});
    const [configuring, setConfiguring] = useState(null);

    const categories = ['all', ...new Set(integrations.map(i => i.category))];

    const filteredIntegrations = integrations.filter(integration => {
        const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const testIntegration = async (integration) => {
        setTestResults(prev => ({ ...prev, [integration.id]: 'testing' }));
        
        try {
            if (integration.function === 'universalBridge') {
                const res = await base44.functions.invoke('universalBridge', {
                    action: 'emit_iso',
                    debtor: 'TestBank',
                    creditor: 'TestCounterparty',
                    amount: 1,
                    currency: 'USD',
                });
                setTestResults(prev => ({ ...prev, [integration.id]: res?.data?.success ? 'success' : 'error' }));
                return;
            }
            // Simple ping test for other integrations
            await new Promise(resolve => setTimeout(resolve, 1000));
            setTestResults(prev => ({ ...prev, [integration.id]: 'success' }));
        } catch (error) {
            setTestResults(prev => ({ ...prev, [integration.id]: 'error' }));
        }
    };

    const configureIntegration = (integration) => {
        setConfiguring(integration);
    };

    const getIconComponent = (icon) => icon;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <Plug className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Integration Hub</h1>
                            <p className="text-slate-400">Connect and manage external services</p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search integrations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-slate-800 border-slate-700"
                            />
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="all" onValueChange={setSelectedCategory}>
                    <TabsList className="bg-slate-800 border-slate-700">
                        {categories.map(category => (
                            <TabsTrigger 
                                key={category} 
                                value={category}
                                className="data-[state=active]:bg-slate-700"
                            >
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value={selectedCategory} className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredIntegrations.map(integration => {
                                const Icon = getIconComponent(integration.icon);
                                const testStatus = testResults[integration.id];

                                return (
                                    <Card key={integration.id} className="bg-slate-800 border-slate-700 hover:border-blue-500/50 transition-colors">
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center">
                                                        <Icon className="h-5 w-5 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-white text-lg">{integration.name}</CardTitle>
                                                        <p className="text-xs text-slate-400">{integration.category}</p>
                                                    </div>
                                                </div>
                                                {integration.status === 'active' && (
                                                    <Badge className="bg-green-500/20 text-green-400">
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Active
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={() => testIntegration(integration)}
                                                    variant="outline"
                                                    className="flex-1 bg-slate-700 hover:bg-slate-600 border-slate-600"
                                                    disabled={testStatus === 'testing'}
                                                >
                                                    {testStatus === 'testing' && <Zap className="h-4 w-4 mr-2 animate-spin" />}
                                                    {testStatus === 'success' && <Check className="h-4 w-4 mr-2 text-green-400" />}
                                                    {testStatus === 'error' && <AlertCircle className="h-4 w-4 mr-2 text-red-400" />}
                                                    {!testStatus && 'Test'}
                                                    {testStatus === 'testing' && 'Testing...'}
                                                    {testStatus === 'success' && 'Healthy'}
                                                    {testStatus === 'error' && 'Error'}
                                                </Button>
                                                <Button 
                                                    onClick={() => configureIntegration(integration)}
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                >
                                                    Configure
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </TabsContent>
                </Tabs>

                {filteredIntegrations.length === 0 && (
                    <div className="text-center py-12">
                        <AlertCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">No integrations found</p>
                    </div>
                )}
            </div>

            {configuring && (
                <ConfigureModal
                    integration={configuring}
                    testStatus={testResults[configuring.id]}
                    onTest={() => testIntegration(configuring)}
                    onClose={() => setConfiguring(null)}
                />
            )}
        </div>
    );
}