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

        const { file_path, content } = await req.json();

        if (!file_path || typeof content !== 'string') {
            return Response.json({ success: false, error: "Invalid parameters. 'file_path' and 'content' are required." }, { status: 400 });
        }

        // Security: Prevent path traversal attacks. Ensure the path is within the project directory.
        const absolutePath = resolve(CWD, file_path);
        if (!absolutePath.startsWith(CWD)) {
            return Response.json({ success: false, error: 'Access denied. Path is outside the project directory.' }, { status: 403 });
        }

        await Deno.writeTextFile(absolutePath, content);

        return Response.json({ 
            success: true, 
            message: `File '${file_path}' written successfully.`
        });

    } catch (error) {
        return Response.json({ 
            success: false,
            error: `Failed to write file: ${error.message}`,
        }, { status: 500 });
    }
});