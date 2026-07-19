import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Video, Film, Clapperboard, Check, X } from 'lucide-react';

const ASPECTS = [
    { value: '16:9', label: 'Landscape 16:9' },
    { value: '9:16', label: 'Portrait 9:16' },
];

const DURATIONS = [
    { value: 4, label: '4 seconds' },
    { value: 6, label: '6 seconds' },
    { value: 8, label: '8 seconds (max per clip)' },
];

const STYLES = [
    { value: 'cinematic', label: 'Cinematic film' },
    { value: 'documentary', label: 'Documentary' },
    { value: '3d_animated', label: '3D Animated' },
    { value: 'photorealistic', label: 'Photorealistic' },
    { value: 'explainer', label: 'Explainer / motion graphics' },
];

export default function VideoGeneratorPanel({ open, onClose, onVideoGenerated }) {
    const [mode, setMode] = useState('single'); // 'single' | 'storyboard'
    const [prompt, setPrompt] = useState('');
    const [aspect, setAspect] = useState('16:9');
    const [duration, setDuration] = useState(8);
    const [style, setStyle] = useState('cinematic');
    const [sceneCount, setSceneCount] = useState(5);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState(null);
    const [clips, setClips] = useState([]);

    const buildClipPrompt = (scene, baseStyle) => {
        const styleHints = {
            cinematic: 'cinematic wide shot, dramatic lighting, film grain, shallow depth of field',
            documentary: 'documentary style, natural lighting, observational camera',
            '3d_animated': '3D animated, Pixar-style, vibrant colors, soft global illumination',
            photorealistic: 'photorealistic, 4K detail, natural textures',
            explainer: 'motion graphics explainer, clean vector style, bold typography',
        };
        const hint = styleHints[baseStyle] || styleHints.cinematic;
        return `${scene}. ${hint}`;
    };

    const handleGenerateSingle = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setError(null);
        setStatus('Generating clip with Google Veo...');
        try {
            const res = await base44.integrations.Core.GenerateVideo({
                prompt: buildClipPrompt(prompt, style),
                duration,
                aspect_ratio: aspect,
            });
            const url = res?.url;
            if (!url) throw new Error('No video returned');
            setClips([{ url, prompt }]);
            if (onVideoGenerated) onVideoGenerated(prompt, url, clips.concat([{ url, prompt }]));
        } catch (err) {
            setError(err.message || 'Generation failed');
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    const handleGenerateStoryboard = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setError(null);
        setClips([]);
        try {
            // Ask Jasper to break the concept into scenes
            setStatus('Jasper is writing your storyboard...');
            const plan = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a video director. Break this video concept into ${sceneCount} sequential scenes, each rendered as a single 8-second clip. Return ONLY a JSON array of ${sceneCount} strings, each a vivid visual prompt for one scene that continues the narrative from the previous. Concept: "${prompt}". Style: ${style}.`,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        scenes: { type: 'array', items: { type: 'string' } },
                    },
                },
            });
            const scenes = plan?.scenes || [];
            if (!scenes.length) throw new Error('Could not build storyboard');

            const generated = [];
            for (let i = 0; i < scenes.length; i++) {
                setStatus(`Generating scene ${i + 1} of ${scenes.length}...`);
                const res = await base44.integrations.Core.GenerateVideo({
                    prompt: buildClipPrompt(scenes[i], style),
                    duration: 8,
                    aspect_ratio: aspect,
                });
                if (res?.url) {
                    generated.push({ url: res.url, prompt: scenes[i], scene: i + 1 });
                    setClips([...generated]);
                }
            }
            if (onVideoGenerated) onVideoGenerated(prompt, generated[0]?.url, generated);
        } catch (err) {
            setError(err.message || 'Storyboard generation failed');
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    const close = () => {
        setClips([]);
        setPrompt('');
        setError(null);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clapperboard className="h-5 w-5 text-blue-400" />
                        Jasper Video Studio
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-2 space-y-4">
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant={mode === 'single' ? 'default' : 'outline'}
                            onClick={() => setMode('single')}
                            className={mode === 'single' ? 'bg-blue-600' : 'border-slate-600 text-slate-300'}
                        >
                            <Video className="h-4 w-4" /> Single Clip
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'storyboard' ? 'default' : 'outline'}
                            onClick={() => setMode('storyboard')}
                            className={mode === 'storyboard' ? 'bg-blue-600' : 'border-slate-600 text-slate-300'}
                        >
                            <Film className="h-4 w-4" /> Storyboard (longer videos)
                        </Button>
                    </div>

                    <Textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder={
                            mode === 'single'
                                ? 'Describe your clip... e.g. a drone soaring over misty mountains at sunrise'
                                : 'Describe the full video you want... e.g. an 8-minute origin story of a startup, from garage to IPO'
                        }
                        className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 min-h-[90px]"
                        disabled={loading}
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <Select value={style} onValueChange={setStyle} disabled={loading}>
                            <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600 text-slate-100">
                                {STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={aspect} onValueChange={setAspect} disabled={loading}>
                            <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600 text-slate-100">
                                {ASPECTS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {mode === 'single' ? (
                        <Select value={String(duration)} onValueChange={v => setDuration(Number(v))} disabled={loading}>
                            <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600 text-slate-100">
                                {DURATIONS.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-4 py-3">
                            <label className="text-xs text-slate-400">Scenes: {sceneCount} × 8s = {(sceneCount * 8 / 60).toFixed(1)} min total</label>
                            <input
                                type="range" min={2} max={30} value={sceneCount}
                                onChange={e => setSceneCount(Number(e.target.value))}
                                disabled={loading}
                                className="w-full mt-2 accent-blue-500"
                            />
                            <p className="text-[11px] text-slate-500 mt-1">Each scene is a separate 8-second clip. Jasper writes the storyboard, then renders each scene sequentially.</p>
                        </div>
                    )}

                    {status && (
                        <div className="flex items-center gap-2 text-sm text-blue-300">
                            <Loader2 className="h-4 w-4 animate-spin" /> {status}
                        </div>
                    )}
                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    {clips.length > 0 && (
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                            {clips.map((c, i) => (
                                <div key={i} className="rounded-lg border border-slate-700 overflow-hidden">
                                    <video src={c.url} controls className="w-full" />
                                    {c.scene && <p className="px-3 py-1.5 text-xs text-slate-400 bg-slate-800/60">Scene {c.scene}: {c.prompt}</p>}
                                </div>
                            ))}
                        </div>
                    )}

                    <Button
                        onClick={mode === 'single' ? handleGenerateSingle : handleGenerateStoryboard}
                        disabled={!prompt.trim() || loading}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                        {loading ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Working...</>
                        ) : (
                            <><Clapperboard className="h-4 w-4 mr-2" /> {mode === 'single' ? 'Generate Clip' : `Render ${sceneCount} Scenes`}</>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}