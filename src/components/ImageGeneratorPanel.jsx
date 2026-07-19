import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Box, Sparkles } from 'lucide-react';

const STYLES = [
    { value: '3d_render', label: '3D Render (Octane)' },
    { value: 'cinematic', label: 'Cinematic 3D' },
    { value: 'photorealistic', label: 'Photorealistic' },
    { value: 'artistic', label: 'Artistic' },
];

export default function ImageGeneratorPanel({ open, onClose, onImageGenerated }) {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('3d_render');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const res = await base44.functions.invoke('imageGeneration', { prompt, style });
            const imageUrl = res.data?.images?.[0];
            if (!imageUrl) throw new Error('No image returned');
            onImageGenerated(prompt, imageUrl, style);
            setPrompt('');
            onClose();
        } catch (err) {
            setError(err.message || 'Generation failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Box className="h-5 w-5 text-blue-400" />
                        Generate 3D Image
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                    <Textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="Describe your 3D scene... e.g. a futuristic city at dusk, glowing neon lights"
                        className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 min-h-[100px]"
                        disabled={loading}
                    />
                    <Select value={style} onValueChange={setStyle} disabled={loading}>
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-100">
                            {STYLES.map(s => (
                                <SelectItem key={s.value} value={s.value} className="focus:bg-slate-700">{s.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <Button
                        onClick={handleGenerate}
                        disabled={!prompt.trim() || loading}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                        {loading ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                        ) : (
                            <><Sparkles className="h-4 w-4 mr-2" /> Generate</>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}