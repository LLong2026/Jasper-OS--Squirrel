import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.5.0';

// STRIPE PAYMENT PROCESSOR - Execute real transactions
// Handles payment intents, checkout sessions, and transaction completion

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
            apiVersion: '2024-12-18.acacia',
        });

        const { action, amount, currency = 'usd', description, metadata } = await req.json();

        if (action === 'create_payment_intent') {
            // Create a payment intent for one-time purchase
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency,
                description,
                metadata: {
                    user_id: user.id,
                    user_email: user.email,
                    ...metadata
                },
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            return Response.json({
                success: true,
                client_secret: paymentIntent.client_secret,
                payment_intent_id: paymentIntent.id,
                amount: paymentIntent.amount / 100,
                status: paymentIntent.status
            });
        }

        if (action === 'create_checkout_session') {
            // Create a full checkout session with redirect
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency,
                        product_data: {
                            name: description,
                            description: metadata?.product_description || ''
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: metadata?.quantity || 1,
                }],
                mode: 'payment',
                success_url: `${req.headers.get('origin')}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${req.headers.get('origin')}/payment-cancelled`,
                customer_email: user.email,
                metadata: {
                    user_id: user.id,
                    ...metadata
                }
            });

            return Response.json({
                success: true,
                checkout_url: session.url,
                session_id: session.id
            });
        }

        if (action === 'verify_payment') {
            // Verify a completed payment
            const { payment_intent_id } = await req.json();
            const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

            return Response.json({
                success: true,
                status: paymentIntent.status,
                amount: paymentIntent.amount / 100,
                paid: paymentIntent.status === 'succeeded'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});