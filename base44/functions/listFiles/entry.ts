import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { walk } from 'jsr:@std/fs/walk';

const IGNORED_DIRS = ['.git', 'node_modules', '.vscode', '__pycache__'];
const IGNORED_FILES = ['.DS_Store'];

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const filePaths = [];
        const CWD = Deno.cwd();

        for await (const entry of walk(CWD, {
            skip: IGNORED_DIRS.map(dir => new RegExp(dir)),
            followSymlinks: false
        })) {
            if (entry.isFile && !IGNORED_FILES.some(f => entry.path.endsWith(f))) {
                // Return relative paths for clarity
                filePaths.push(entry.path.replace(CWD + '/', ''));
            }
        }

        return Response.json({
            success: true,
            files: filePaths.sort()
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: `Failed to list files: ${error.message}`
        }, { status: 500 });
    }
});