/**
 * Body Cache Middleware - Non-destructive request body reader
 * Solves the "body already consumed" problem by buffering the body
 */

export async function getCachedBody(req) {
    // Check if body is already cached
    if (req._cachedBody !== undefined) {
        return req._cachedBody;
    }

    try {
        // Clone and buffer the body
        const body = await req.text();
        
        // Cache it on the request object
        req._cachedBody = body;
        
        // Return parsed JSON
        return body ? JSON.parse(body) : {};
    } catch (error) {
        console.error('Body cache error:', error);
        // Return empty object if parsing fails
        req._cachedBody = '{}';
        return {};
    }
}

/**
 * Self-healing wrapper for tool execution
 * Automatically retries if body consumption fails
 */
export async function executeWithBodyRetry(req, handler, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Get cached body (non-destructive)
            const payload = await getCachedBody(req);
            
            // Execute handler with cached payload
            return await handler(payload);
            
        } catch (error) {
            lastError = error;
            
            // Check if it's a body consumption error
            if (error.message?.includes('body') || 
                error.message?.includes('already read') ||
                error.message?.includes('consumed')) {
                
                console.log(`Body consumption detected, retry ${attempt + 1}/${maxRetries}`);
                
                // Clear cache and retry
                delete req._cachedBody;
                continue;
            }
            
            // Not a body error, throw immediately
            throw error;
        }
    }
    
    throw lastError;
}