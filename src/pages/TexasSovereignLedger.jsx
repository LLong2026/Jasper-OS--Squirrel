import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Database, Lock, MessageSquare, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function TexasSovereignLedger() {
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);

    const loadBlocks = async () => {
        setLoading(true);
        try {
            const response = await base44.functions.invoke('texasSovereignLedger', {
                action: 'list_blocks',
                limit: 50
            });
            if (response.data?.data) {
                setBlocks(Array.isArray(response.data.data) ? response.data.data : []);
            }
        } catch (error) {
            console.error('Failed to load blocks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        
        setLoading(true);
        try {
            const response = await base44.functions.invoke('postQuantumDecryption', {
                action: 'search_asset',
                asset_id: searchQuery
            });
            setSearchResults(response.data);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBlocks();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                            <Shield className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                                Texas Sovereign Ledger
                            </h1>
                            <p className="text-slate-400 text-lg">Post-Quantum Blockchain Security</p>
                        </div>
                    </div>
                    
                    <Link to={createPageUrl('Chat')}>
                        <Button 
                            size="lg" 
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 gap-2"
                        >
                            <MessageSquare className="h-5 w-5" />
                            Ask Jasper
                        </Button>
                    </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-400 text-sm">Total Blocks</p>
                                    <p className="text-3xl font-bold text-white">{blocks.length}</p>
                                </div>
                                <Database className="h-8 w-8 text-blue-400" />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-400 text-sm">Encryption</p>
                                    <p className="text-xl font-bold text-green-400">CRYSTALS-Kyber</p>
                                </div>
                                <Lock className="h-8 w-8 text-green-400" />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-400 text-sm">Status</p>
                                    <p className="text-xl font-bold text-green-400">Operational</p>
                                </div>
                                <Shield className="h-8 w-8 text-green-400" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <Card className="bg-slate-800/50 border-slate-700 mb-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="h-5 w-5 text-blue-400" />
                            Search Assets
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter asset ID (e.g., TX-GOLD-Bar-5092)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                className="bg-slate-900 border-slate-700 text-white"
                            />
                            <Button onClick={handleSearch} disabled={loading}>
                                <Search className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        {searchResults && (
                            <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                                <p className="text-sm text-slate-400 mb-2">
                                    Searched {searchResults.total_blocks_searched} blocks
                                </p>
                                {searchResults.matching_blocks > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-green-400">Found {searchResults.matching_blocks} matches</p>
                                        {searchResults.matches?.map((match, idx) => (
                                            <div key={idx} className="p-3 bg-slate-800 rounded border border-slate-700">
                                                <p className="text-sm text-slate-300">Block #{match.height}</p>
                                                <p className="text-xs text-slate-500 font-mono">{match.block_hash}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-yellow-400">No matches found for "{searchResults.asset_id}"</p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Blocks List */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5 text-purple-400" />
                            Recent Blocks
                        </CardTitle>
                        <Button onClick={loadBlocks} disabled={loading} variant="outline" size="sm">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {blocks.map((block) => (
                                <div key={block.id} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-blue-500/20 text-blue-400">
                                                Block #{block.height}
                                            </Badge>
                                            {block.compliance_proof && (
                                                <Badge className="bg-green-500/20 text-green-400">
                                                    <Shield className="h-3 w-3 mr-1" />
                                                    Verified
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            {new Date(block.created_date).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                        <p className="text-slate-400">
                                            Hash: <span className="text-slate-300 font-mono">{block.block_hash?.substring(0, 40)}...</span>
                                        </p>
                                        {block.node_name && (
                                            <p className="text-slate-400">
                                                Node: <span className="text-slate-300">{block.node_name}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {blocks.length === 0 && !loading && (
                                <div className="text-center text-slate-500 py-8">
                                    No blocks found
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}