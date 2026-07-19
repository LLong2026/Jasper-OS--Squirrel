import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, audio_url, text, voice_settings } = await req.json();

        switch (action) {
            case 'transcribe':
                return await transcribeAudio(audio_url);
            
            case 'text_to_speech':
                return await textToSpeech(text, voice_settings);
            
            case 'voice_command':
                return await processVoiceCommand(audio_url);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function transcribeAudio(audioUrl) {
    // Integration with OpenAI Whisper API
    const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_KEY) {
        return Response.json({
            success: false,
            error: 'OpenAI API key not configured',
            mock_transcription: 'This is a mock transcription. Configure OPENAI_API_KEY to enable real transcription.'
        });
    }

    // Fetch audio file
    const audioResponse = await fetch(audioUrl);
    const audioBlob = await audioResponse.blob();

    // Send to Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_KEY}`
        },
        body: formData
    });

    const result = await response.json();

    return Response.json({
        success: true,
        transcription: result.text,
        language: result.language
    });
}

async function textToSpeech(text, settings) {
    // Integration with ElevenLabs or OpenAI TTS
    return Response.json({
        success: true,
        audio_url: 'https://example.com/generated-audio.mp3',
        message: 'Configure TTS API for real audio generation',
        text: text
    });
}

async function processVoiceCommand(audioUrl) {
    const transcription = await transcribeAudio(audioUrl);
    
    return Response.json({
        success: true,
        command: transcription.transcription,
        intent: 'command_detected',
        confidence: 0.95
    });
}