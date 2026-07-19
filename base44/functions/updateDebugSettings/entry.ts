import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, setting, value } = await req.json();

        // Get current user settings or create default
        let currentSettings = {};
        try {
            // Try to get existing debug settings from user data
            const userData = await base44.entities.User.get(user.id);
            currentSettings = userData.debug_settings || {};
        } catch (error) {
            // If no settings exist, start with defaults
            currentSettings = {
                show_integration_proof: false,
                demo_mode: false,
                verbose_logging: false
            };
        }

        // Update the specific setting
        switch (action) {
            case 'toggle_proof':
                currentSettings.show_integration_proof = value;
                break;
            case 'toggle_demo_mode':
                currentSettings.demo_mode = value;
                break;
            case 'toggle_verbose':
                currentSettings.verbose_logging = value;
                break;
            case 'get_settings':
                // Just return current settings without modification
                break;
            default:
                return Response.json({ 
                    success: false, 
                    error: `Unknown action: ${action}` 
                }, { status: 400 });
        }

        // Save updated settings back to user
        if (action !== 'get_settings') {
            await base44.entities.User.update(user.id, {
                debug_settings: currentSettings
            });
        }

        return Response.json({
            success: true,
            action: action,
            current_settings: currentSettings,
            message: `Debug settings updated successfully.`
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});