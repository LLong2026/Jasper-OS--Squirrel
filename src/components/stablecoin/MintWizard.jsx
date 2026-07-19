import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';

export default function MintWizard({ onComplete, onCancel }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const [coinData, setCoinData] = useState({
        coin_name: '',
        symbol: '',
        backing_type: 'gold',
        peg_ratio: 1.0,
        audit_frequency_days: 30
    });

    const [supplyData, setSupplyData] = useState({
        initial_supply: '',
        reserve_value: ''
    });

    const [reserveAssets, setReserveAssets] = useState([{
        asset_type: 'gold',
        quantity: '',
        unit: 'oz',
        current_value_usd: '',
        vault_location: '',
        custodian: ''
    }]);

    const validateStep1 = () => {
        const newErrors = {};
        if (!coinData.coin_name.trim()) newErrors.coin_name = 'Coin name required';
        if (!coinData.symbol.trim()) newErrors.symbol = 'Symbol required';
        if (coinData.symbol.length > 10) newErrors.symbol = 'Symbol too long (max 10 chars)';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        const newErrors = {};
        const supply = parseFloat(supplyData.initial_supply);
        const reserve = parseFloat(supplyData.reserve_value);
        
        if (!supplyData.initial_supply || supply <= 0) {
            newErrors.initial_supply = 'Initial supply must be greater than 0';
        }
        if (!supplyData.reserve_value || reserve <= 0) {
            newErrors.reserve_value = 'Reserve value must be greater than 0';
        }
        if (supply && reserve && reserve < supply * coinData.peg_ratio) {
            newErrors.reserve_value = `Reserve must be at least $${(supply * coinData.peg_ratio).toLocaleString()} to back supply`;
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep3 = () => {
        const newErrors = {};
        const totalReserveValue = reserveAssets.reduce((sum, asset) => {
            return sum + (parseFloat(asset.current_value_usd) || 0);
        }, 0);
        
        const requiredReserve = parseFloat(supplyData.reserve_value);
        
        reserveAssets.forEach((asset, idx) => {
            if (!asset.quantity || parseFloat(asset.quantity) <= 0) {
                newErrors[`asset_${idx}_quantity`] = 'Quantity required';
            }
            if (!asset.current_value_usd || parseFloat(asset.current_value_usd) <= 0) {
                newErrors[`asset_${idx}_value`] = 'Value required';
            }
            if (!asset.vault_location?.trim()) {
                newErrors[`asset_${idx}_location`] = 'Location required';
            }
        });
        
        if (Math.abs(totalReserveValue - requiredReserve) > 0.01) {
            newErrors.total = `Total asset value ($${totalReserveValue.toLocaleString()}) must match reserve ($${requiredReserve.toLocaleString()})`;
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        let valid = false;
        if (step === 1) valid = validateStep1();
        if (step === 2) valid = validateStep2();
        if (valid) setStep(step + 1);
    };

    const handleBack = () => {
        setErrors({});
        setStep(step - 1);
    };

    const addReserveAsset = () => {
        setReserveAssets([...reserveAssets, {
            asset_type: 'gold',
            quantity: '',
            unit: 'oz',
            current_value_usd: '',
            vault_location: '',
            custodian: ''
        }]);
    };

    const updateReserveAsset = (index, field, value) => {
        const updated = [...reserveAssets];
        updated[index][field] = value;
        setReserveAssets(updated);
    };

    const removeReserveAsset = (index) => {
        setReserveAssets(reserveAssets.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!validateStep3()) return;
        
        setLoading(true);
        try {
            const coinPayload = {
                ...coinData,
                total_supply: parseFloat(supplyData.initial_supply),
                reserve_backing: parseFloat(supplyData.reserve_value),
                status: 'active',
                compliance_status: 'compliant',
                last_audit_date: new Date().toISOString()
            };

            // Try to create in external Stable Coin Mint app first
            let coin;
            let useExternal = false;
            try {
                const externalResult = await base44.functions.invoke('universalAppConnector', {
                    action: 'interact',
                    target_app_id: 'stable_coin_mint_2026',
                    entity_name: 'StableCoin',
                    operation: 'create',
                    data: coinPayload
                });
                
                if (externalResult.data?.success && externalResult.data?.data) {
                    coin = externalResult.data.data;
                    useExternal = true;
                }
            } catch (err) {
                console.warn('External app not available, creating locally:', err);
            }

            // Fallback to local creation
            if (!coin) {
                coin = await base44.entities.StableCoin.create(coinPayload);
            }

            // Create reserve assets
            for (const asset of reserveAssets) {
                const assetPayload = {
                    ...asset,
                    quantity: parseFloat(asset.quantity),
                    current_value_usd: parseFloat(asset.current_value_usd),
                    allocated_to_coin: coin.id,
                    audit_status: 'verified',
                    last_audit_date: new Date().toISOString()
                };

                if (useExternal) {
                    await base44.functions.invoke('universalAppConnector', {
                        action: 'interact',
                        target_app_id: 'stable_coin_mint_2026',
                        entity_name: 'ReserveAsset',
                        operation: 'create',
                        data: assetPayload
                    }).catch(() => base44.entities.ReserveAsset.create(assetPayload));
                } else {
                    await base44.entities.ReserveAsset.create(assetPayload);
                }
            }

            // Create mint transaction
            const txPayload = {
                coin_id: coin.id,
                transaction_type: 'mint',
                amount: parseFloat(supplyData.initial_supply),
                reserve_change: parseFloat(supplyData.reserve_value),
                initiator: 'System',
                authorized_by: 'Admin',
                status: 'executed',
                compliance_verified: true,
                execution_timestamp: Date.now()
            };

            if (useExternal) {
                await base44.functions.invoke('universalAppConnector', {
                    action: 'interact',
                    target_app_id: 'stable_coin_mint_2026',
                    entity_name: 'MintTransaction',
                    operation: 'create',
                    data: txPayload
                }).catch(() => base44.entities.MintTransaction.create(txPayload));
            } else {
                await base44.entities.MintTransaction.create(txPayload);
            }

            onComplete();
        } catch (error) {
            setErrors({ submit: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="bg-slate-800 border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <CardHeader>
                    <CardTitle className="text-slate-100">Mint New Stable Coin</CardTitle>
                    <CardDescription className="text-slate-400">
                        Step {step} of 3: {step === 1 ? 'Coin Details' : step === 2 ? 'Supply & Reserve' : 'Asset Allocation'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Step 1: Coin Details */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <Label className="text-slate-300">Coin Name</Label>
                                <Input
                                    value={coinData.coin_name}
                                    onChange={(e) => setCoinData({...coinData, coin_name: e.target.value})}
                                    placeholder="e.g., Texas Digital Dollar"
                                    className="bg-slate-900 border-slate-700 text-slate-100"
                                />
                                {errors.coin_name && <p className="text-red-400 text-sm mt-1">{errors.coin_name}</p>}
                            </div>

                            <div>
                                <Label className="text-slate-300">Symbol</Label>
                                <Input
                                    value={coinData.symbol}
                                    onChange={(e) => setCoinData({...coinData, symbol: e.target.value.toUpperCase()})}
                                    placeholder="e.g., TXD"
                                    maxLength={10}
                                    className="bg-slate-900 border-slate-700 text-slate-100"
                                />
                                {errors.symbol && <p className="text-red-400 text-sm mt-1">{errors.symbol}</p>}
                            </div>

                            <div>
                                <Label className="text-slate-300">Backing Type</Label>
                                <Select value={coinData.backing_type} onValueChange={(v) => setCoinData({...coinData, backing_type: v})}>
                                    <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gold">Gold</SelectItem>
                                        <SelectItem value="silver">Silver</SelectItem>
                                        <SelectItem value="mixed_metals">Mixed Metals</SelectItem>
                                        <SelectItem value="fiat">Fiat Currency</SelectItem>
                                        <SelectItem value="commodity_basket">Commodity Basket</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-slate-300">Peg Ratio (1 coin = X USD)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={coinData.peg_ratio}
                                    onChange={(e) => setCoinData({...coinData, peg_ratio: parseFloat(e.target.value)})}
                                    className="bg-slate-900 border-slate-700 text-slate-100"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Supply & Reserve */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div>
                                <Label className="text-slate-300">Initial Supply</Label>
                                <Input
                                    type="number"
                                    value={supplyData.initial_supply}
                                    onChange={(e) => setSupplyData({...supplyData, initial_supply: e.target.value})}
                                    placeholder="e.g., 1000000"
                                    className="bg-slate-900 border-slate-700 text-slate-100"
                                />
                                {errors.initial_supply && <p className="text-red-400 text-sm mt-1">{errors.initial_supply}</p>}
                            </div>

                            <div>
                                <Label className="text-slate-300">Reserve Value (USD)</Label>
                                <Input
                                    type="number"
                                    value={supplyData.reserve_value}
                                    onChange={(e) => setSupplyData({...supplyData, reserve_value: e.target.value})}
                                    placeholder="e.g., 1000000"
                                    className="bg-slate-900 border-slate-700 text-slate-100"
                                />
                                {errors.reserve_value && <p className="text-red-400 text-sm mt-1">{errors.reserve_value}</p>}
                            </div>

                            {supplyData.initial_supply && supplyData.reserve_value && (
                                <div className="p-4 bg-slate-900/50 rounded border border-slate-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                        <span className="text-slate-300 font-medium">Backing Ratio</span>
                                    </div>
                                    <p className="text-slate-400 text-sm">
                                        {((parseFloat(supplyData.reserve_value) / parseFloat(supplyData.initial_supply)) * 100).toFixed(2)}% backed
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Asset Allocation */}
                    {step === 3 && (
                        <div className="space-y-4">
                            {reserveAssets.map((asset, idx) => (
                                <Card key={idx} className="bg-slate-900/50 border-slate-700">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm text-slate-300">Reserve Asset {idx + 1}</CardTitle>
                                            {reserveAssets.length > 1 && (
                                                <Button variant="ghost" size="sm" onClick={() => removeReserveAsset(idx)} className="text-red-400">
                                                    Remove
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label className="text-slate-300 text-xs">Asset Type</Label>
                                                <Select value={asset.asset_type} onValueChange={(v) => updateReserveAsset(idx, 'asset_type', v)}>
                                                    <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="gold">Gold</SelectItem>
                                                        <SelectItem value="silver">Silver</SelectItem>
                                                        <SelectItem value="platinum">Platinum</SelectItem>
                                                        <SelectItem value="fiat_usd">USD</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-slate-300 text-xs">Unit</Label>
                                                <Input
                                                    value={asset.unit}
                                                    onChange={(e) => updateReserveAsset(idx, 'unit', e.target.value)}
                                                    className="bg-slate-900 border-slate-700 text-slate-100"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label className="text-slate-300 text-xs">Quantity</Label>
                                                <Input
                                                    type="number"
                                                    value={asset.quantity}
                                                    onChange={(e) => updateReserveAsset(idx, 'quantity', e.target.value)}
                                                    className="bg-slate-900 border-slate-700 text-slate-100"
                                                />
                                                {errors[`asset_${idx}_quantity`] && <p className="text-red-400 text-xs mt-1">{errors[`asset_${idx}_quantity`]}</p>}
                                            </div>
                                            <div>
                                                <Label className="text-slate-300 text-xs">Value (USD)</Label>
                                                <Input
                                                    type="number"
                                                    value={asset.current_value_usd}
                                                    onChange={(e) => updateReserveAsset(idx, 'current_value_usd', e.target.value)}
                                                    className="bg-slate-900 border-slate-700 text-slate-100"
                                                />
                                                {errors[`asset_${idx}_value`] && <p className="text-red-400 text-xs mt-1">{errors[`asset_${idx}_value`]}</p>}
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-slate-300 text-xs">Vault Location</Label>
                                            <Input
                                                value={asset.vault_location}
                                                onChange={(e) => updateReserveAsset(idx, 'vault_location', e.target.value)}
                                                placeholder="e.g., Texas Bullion Depository"
                                                className="bg-slate-900 border-slate-700 text-slate-100"
                                            />
                                            {errors[`asset_${idx}_location`] && <p className="text-red-400 text-xs mt-1">{errors[`asset_${idx}_location`]}</p>}
                                        </div>

                                        <div>
                                            <Label className="text-slate-300 text-xs">Custodian (Optional)</Label>
                                            <Input
                                                value={asset.custodian}
                                                onChange={(e) => updateReserveAsset(idx, 'custodian', e.target.value)}
                                                className="bg-slate-900 border-slate-700 text-slate-100"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            <Button onClick={addReserveAsset} variant="outline" className="w-full border-slate-700 text-slate-300">
                                + Add Another Asset
                            </Button>

                            {errors.total && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded">
                                    <AlertCircle className="w-5 h-5 text-red-400" />
                                    <p className="text-red-400 text-sm">{errors.total}</p>
                                </div>
                            )}

                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded">
                                <p className="text-sm text-slate-300">
                                    Total Reserve: ${reserveAssets.reduce((sum, a) => sum + (parseFloat(a.current_value_usd) || 0), 0).toLocaleString()}
                                </p>
                                <p className="text-sm text-slate-300">
                                    Required: ${parseFloat(supplyData.reserve_value || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    )}

                    {errors.submit && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded">
                            <AlertCircle className="w-5 h-5 text-red-400" />
                            <p className="text-red-400 text-sm">{errors.submit}</p>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between pt-4 border-t border-slate-700">
                        <Button onClick={step === 1 ? onCancel : handleBack} variant="outline" className="border-slate-700">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            {step === 1 ? 'Cancel' : 'Back'}
                        </Button>
                        
                        {step < 3 ? (
                            <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                                Next
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
                                {loading ? 'Minting...' : 'Mint Coin'}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}