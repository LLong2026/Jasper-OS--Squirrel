import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { resolve } from 'jsr:@std/path';

const CWD = Deno.cwd();

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_path } = await req.json();

        if (!file_path) {
            return Response.json({ success: false, error: "Missing 'file_path' parameter." }, { status: 400 });
        }
        
        // Security: Prevent path traversal attacks.
        const absolutePath = resolve(CWD, file_path);
        if (!absolutePath.startsWith(CWD)) {
            return Response.json({ success: false, error: 'Access denied. Path is outside the project directory.' }, { status: 403 });
        }

        const content = await Deno.readTextFile(absolutePath);

        return Response.json({ 
            success: true, 
            file_path,
            content
        });

    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
             return Response.json({ success: false, error: `File not found: ${file_path}` }, { status: 404 });
        }
        return Response.json({ 
            success: false,
            error: `Failed to read file: ${error.message}`,
        }, { status: 500 });
    }
});