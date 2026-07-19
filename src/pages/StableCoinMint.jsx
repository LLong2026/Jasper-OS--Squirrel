import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Coins, TrendingUp, Shield, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MintWizard from '@/components/stablecoin/MintWizard';

export default function StableCoinMint() {
    const [showMintWizard, setShowMintWizard] = useState(false);
    const { data: coins, isLoading: coinsLoading, refetch: refetchCoins } = useQuery({
        queryKey: ['stablecoins'],
        queryFn: async () => {
            // Fetch from local entities
            const localCoins = await base44.entities.StableCoin.list('-created_date', 100).catch(() => []);
            
            // Also fetch from external Stable Coin Mint app if connected
            try {
                const externalResult = await base44.functions.invoke('universalAppConnector', {
                    action: 'interact',
                    target_app_id: 'stable_coin_mint_2026',
                    entity_name: 'StableCoin',
                    operation: 'list',
                    limit: 100
                });
                
                if (externalResult.data?.success && externalResult.data?.data) {
                    const externalCoins = Array.isArray(externalResult.data.data) 
                        ? externalResult.data.data 
                        : [externalResult.data.data];
                    return [...localCoins, ...externalCoins];
                }
            } catch (err) {
                console.warn('Could not fetch from external app:', err);
            }
            
            return localCoins;
        },
        initialData: []
    });

    const { data: transactions, isLoading: txLoading } = useQuery({
        queryKey: ['transactions'],
        queryFn: () => base44.entities.MintTransaction.list('-created_date', 50),
        initialData: []
    });

    const { data: reserves, isLoading: reservesLoading } = useQuery({
        queryKey: ['reserves'],
        queryFn: () => base44.entities.ReserveAsset.list('-created_date', 100),
        initialData: []
    });

    const statusColors = {
        active: 'bg-green-100 text-green-800',
        suspended: 'bg-yellow-100 text-yellow-800',
        auditing: 'bg-blue-100 text-blue-800'
    };

    const complianceColors = {
        compliant: 'bg-green-100 text-green-800',
        under_review: 'bg-yellow-100 text-yellow-800',
        non_compliant: 'bg-red-100 text-red-800'
    };

    const txTypeColors = {
        mint: 'bg-green-100 text-green-800',
        burn: 'bg-red-100 text-red-800',
        transfer: 'bg-blue-100 text-blue-800',
        reserve_adjustment: 'bg-purple-100 text-purple-800'
    };

    const totalSupply = coins.reduce((sum, coin) => sum + (coin.total_supply || 0), 0);
    const totalReserves = reserves.reduce((sum, r) => sum + (r.current_value_usd || 0), 0);

    const handleMintComplete = () => {
        setShowMintWizard(false);
        refetchCoins();
    };

    return (
        <>
        {showMintWizard && (
            <MintWizard 
                onComplete={handleMintComplete}
                onCancel={() => setShowMintWizard(false)}
            />
        )}
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Stable Coin Mint</h1>
                        <p className="text-slate-400">Reserve-backed digital currency management</p>
                    </div>
                    <Button onClick={() => setShowMintWizard(true)} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Mint New Coin
                    </Button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">Total Supply</CardTitle>
                            <Coins className="h-4 w-4 text-blue-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-100">{totalSupply.toLocaleString()}</div>
                            <p className="text-xs text-slate-400 mt-1">{coins.length} active currencies</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">Reserve Value</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-100">${totalReserves.toLocaleString()}</div>
                            <p className="text-xs text-slate-400 mt-1">{reserves.length} reserve assets</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">Recent Transactions</CardTitle>
                            <Shield className="h-4 w-4 text-purple-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-100">{transactions.length}</div>
                            <p className="text-xs text-slate-400 mt-1">All time activity</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Active Coins */}
                <Card className="bg-slate-800/50 border-slate-700 mb-8">
                    <CardHeader>
                        <CardTitle className="text-slate-100">Active Stable Coins</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {coinsLoading ? (
                            <p className="text-slate-400">Loading coins...</p>
                        ) : coins.length === 0 ? (
                            <div className="text-center py-8">
                                <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                                <p className="text-slate-400">No stable coins minted yet</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {coins.map(coin => (
                                    <div key={coin.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                <Coins className="w-6 h-6 text-blue-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-100">{coin.coin_name}</h3>
                                                <p className="text-sm text-slate-400">{coin.symbol} · {coin.backing_type}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-sm text-slate-400">Supply</p>
                                                <p className="font-semibold text-slate-100">{(coin.total_supply || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-slate-400">Reserve</p>
                                                <p className="font-semibold text-slate-100">${(coin.reserve_backing || 0).toLocaleString()}</p>
                                            </div>
                                            <Badge className={statusColors[coin.status] || 'bg-gray-100 text-gray-800'}>
                                                {coin.status}
                                            </Badge>
                                            <Badge className={complianceColors[coin.compliance_status] || 'bg-gray-100 text-gray-800'}>
                                                {coin.compliance_status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-slate-100">Recent Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {txLoading ? (
                            <p className="text-slate-400">Loading transactions...</p>
                        ) : transactions.length === 0 ? (
                            <p className="text-slate-400 text-center py-4">No transactions yet</p>
                        ) : (
                            <div className="space-y-3">
                                {transactions.slice(0, 10).map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded border border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <Badge className={txTypeColors[tx.transaction_type] || 'bg-gray-100 text-gray-800'}>
                                                {tx.transaction_type}
                                            </Badge>
                                            <span className="text-sm text-slate-300">{tx.transaction_id}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-slate-100 font-medium">{tx.amount.toLocaleString()}</span>
                                            <Badge variant="outline" className="text-slate-300 border-slate-600">
                                                {tx.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
        </>
    );
}