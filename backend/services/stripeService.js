// services/stripeService.js - Stripe Payment Integration (Test Mode)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../utils/logger');


// Ticket pricing configuration
const TICKET_PRICES = {
  Standard: { amount: 0, currency: 'usd', name: 'Standard Ticket' },      // Free
  Premium: { amount: 499, currency: 'usd', name: 'Premium Ticket' },     // $4.99
};

// @desc    Create Stripe checkout session for ticket purchase
const createCheckoutSession = async ({ ticketData, successUrl, cancelUrl }) => {
  try {
    const startTime = Date.now();
    
    const { ticketType, eventName, userName, userEmail, ticketId } = ticketData;
    const priceInfo = TICKET_PRICES[ticketType];

    if (!priceInfo) {
      throw new Error(`Invalid ticket type: ${ticketType}`);
    }

    // For free tickets, no payment needed
    if (priceInfo.amount === 0) {
      return {
        isFreeTick: true,
        ticketType: 'Standard',
        amount: 0,
        message: 'Free ticket - no payment required'
      };
    }

    // Create checkout session for paid tickets
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: priceInfo.currency,
            product_data: {
              name: `${priceInfo.name} - ${eventName}`,
              description: `Event ticket for ${userName}`,
              metadata: {
                ticketId: ticketId,
                eventName: eventName,
                ticketType: ticketType
              }
            },
            unit_amount: priceInfo.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&ticket_id=${ticketId}`,
      cancel_url: `${cancelUrl}?ticket_id=${ticketId}`,
      customer_email: userEmail,
      metadata: {
        ticketId: ticketId,
        eventName: eventName,
        ticketType: ticketType,
        userName: userName,
        userEmail: userEmail
      },
      // Optional: Add automatic tax calculation
      automatic_tax: { enabled: false },
      // Optional: Allow promotion codes
      allow_promotion_codes: true,
      // Expiration time (30 minutes)
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60)
    });

    logger.logPerformance('stripe_checkout_creation', Date.now() - startTime, {
      ticketId,
      ticketType,
      amount: priceInfo.amount
    });

    logger.info('Stripe checkout session created', {
      sessionId: session.id,
      ticketId,
      ticketType,
      amount: priceInfo.amount,
      customerEmail: userEmail
    });

    return {
      sessionId: session.id,
      sessionUrl: session.url,
      amount: priceInfo.amount,
      currency: priceInfo.currency,
      expiresAt: session.expires_at
    };

  } catch (error) {
    logger.error('Error creating Stripe checkout session:', {
      error: error.message,
      ticketData,
      stack: error.stack
    });
    throw new Error(`Payment session creation failed: ${error.message}`);
  }
};

// @desc    Retrieve checkout session details
const getCheckoutSession = async (sessionId) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'customer']
    });

    logger.info('Stripe checkout session retrieved', {
      sessionId,
      status: session.payment_status,
      amount: session.amount_total
    });

    return {
      id: session.id,
      paymentStatus: session.payment_status,
      paymentIntent: session.payment_intent,
      customerEmail: session.customer_email,
      amountTotal: session.amount_total,
      currency: session.currency,
      metadata: session.metadata,
      expiresAt: session.expires_at,
      url: session.url
    };

  } catch (error) {
    logger.error('Error retrieving Stripe checkout session:', {
      error: error.message,
      sessionId
    });
    throw new Error(`Failed to retrieve payment session: ${error.message}`);
  }
};

// @desc    Handle successful payment
const handleSuccessfulPayment = async (sessionId) => {
  try {
    const session = await getCheckoutSession(sessionId);
    
    if (session.paymentStatus !== 'paid') {
      throw new Error('Payment not completed');
    }

    const paymentData = {
      sessionId: session.id,
      paymentIntentId: session.paymentIntent?.id,
      amount: session.amountTotal,
      currency: session.currency,
      customerEmail: session.customerEmail,
      ticketId: session.metadata?.ticketId,
      eventName: session.metadata?.eventName,
      ticketType: session.metadata?.ticketType,
      paidAt: new Date(),
      paymentMethod: 'stripe'
    };

    logger.info('Payment processed successfully', {
      sessionId,
      ticketId: paymentData.ticketId,
      amount: paymentData.amount
    });

    return paymentData;

  } catch (error) {
    logger.error('Error handling successful payment:', {
      error: error.message,
      sessionId
    });
    throw error;
  }
};

// @desc    
const createPaymentIntent = async ({ ticketData, metadata = {} }) => {
  try {
    const { ticketType, eventName, userName, userEmail, ticketId } = ticketData;
    const priceInfo = TICKET_PRICES[ticketType];

    if (!priceInfo || priceInfo.amount === 0) {
      throw new Error('Payment intent not needed for free tickets');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceInfo.amount,
      currency: priceInfo.currency,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        ticketId,
        eventName,
        ticketType,
        userName,
        userEmail,
        ...metadata
      },
      description: `${priceInfo.name} for ${eventName}`,
      receipt_email: userEmail,
    });

    logger.info('Payment intent created', {
      paymentIntentId: paymentIntent.id,
      ticketId,
      amount: priceInfo.amount
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: priceInfo.amount,
      currency: priceInfo.currency
    };

  } catch (error) {
    logger.error('Error creating payment intent:', error);
    throw new Error(`Payment intent creation failed: ${error.message}`);
  }
};

// @desc    Confirm payment intent
const confirmPaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      logger.info('Payment intent confirmed', {
        paymentIntentId,
        amount: paymentIntent.amount
      });
      
      return {
        success: true,
        paymentIntent,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata
      };
    }

    return {
      success: false,
      status: paymentIntent.status,
      paymentIntent
    };

  } catch (error) {
    logger.error('Error confirming payment intent:', error);
    throw new Error(`Payment confirmation failed: ${error.message}`);
  }
};

// @desc    Process refund for cancelled tickets
const processRefund = async (paymentIntentId, amount = null, reason = 'requested_by_customer') => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount, // null for full refund
      reason: reason,
      metadata: {
        refundedAt: new Date().toISOString(),
        refundReason: reason
      }
    });

    logger.info('Refund processed', {
      refundId: refund.id,
      paymentIntentId,
      amount: refund.amount,
      status: refund.status
    });

    return {
      refundId: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason
    };

  } catch (error) {
    logger.error('Error processing refund:', error);
    throw new Error(`Refund processing failed: ${error.message}`);
  }
};

// @desc    Get payment details by payment intent ID
const getPaymentDetails = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['charges.data.receipt_url']
    });

    return {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      description: paymentIntent.description,
      receiptEmail: paymentIntent.receipt_email,
      metadata: paymentIntent.metadata,
      charges: paymentIntent.charges.data.map(charge => ({
        id: charge.id,
        amount: charge.amount,
        receiptUrl: charge.receipt_url,
        paymentMethod: charge.payment_method_details?.type
      }))
    };

  } catch (error) {
    logger.error('Error retrieving payment details:', error);
    throw new Error(`Failed to retrieve payment details: ${error.message}`);
  }
};

// @desc    Verify webhook signature
const verifyWebhookSignature = (payload, signature) => {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return event;
  } catch (error) {
    logger.error('Webhook signature verification failed:', error);
    throw new Error('Invalid webhook signature');
  }
};

// @desc    Handle Stripe webhook events
const handleWebhookEvent = async (event) => {
  try {
    logger.info('Processing Stripe webhook event', {
      type: event.type,
      id: event.id
    });

    switch (event.type) {
      case 'checkout.session.completed':
        // Payment successful
        const session = event.data.object;
        logger.info('Checkout session completed', {
          sessionId: session.id,
          ticketId: session.metadata?.ticketId
        });
        return { type: 'payment_success', data: session };

      case 'payment_intent.succeeded':
        // Payment intent succeeded
        const paymentIntent = event.data.object;
        logger.info('Payment intent succeeded', {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount
        });
        return { type: 'payment_confirmed', data: paymentIntent };

      case 'payment_intent.payment_failed':
        // Payment failed
        const failedPayment = event.data.object;
        logger.warn('Payment intent failed', {
          paymentIntentId: failedPayment.id,
          lastPaymentError: failedPayment.last_payment_error
        });
        return { type: 'payment_failed', data: failedPayment };

      case 'charge.dispute.created':
        // Dispute/chargeback created
        const dispute = event.data.object;
        logger.warn('Charge dispute created', {
          chargeId: dispute.charge,
          amount: dispute.amount,
          reason: dispute.reason
        });
        return { type: 'dispute_created', data: dispute };

      default:
        logger.info('Unhandled webhook event type', { type: event.type });
        return { type: 'unhandled', data: event.data.object };
    }

  } catch (error) {
    logger.error('Error handling webhook event:', error);
    throw error;
  }
};

// @desc    Health check for Stripe service
const healthCheck = async () => {
  try {
    // Test API connection by retrieving account info
    const account = await stripe.accounts.retrieve();
    
    return {
      status: 'healthy',
      accountId: account.id,
      country: account.country,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      testMode: !account.livemode
    };

  } catch (error) {
    logger.error('Stripe health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// @desc    Get test card numbers for development
const getTestCards = () => {
  return {
    success: {
      number: '4242424242424242',
      description: 'Succeeds and immediately processes the payment.'
    },
    decline: {
      number: '4000000000000002',
      description: 'Always declines with a generic decline code.'
    },
    insufficientFunds: {
      number: '4000000000009995',
      description: 'Declines with insufficient_funds code.'
    },
    requiresAuthentication: {
      number: '4000002500003155',
      description: 'Requires 3D Secure authentication.'
    },
    expiredCard: {
      number: '4000000000000069',
      description: 'Declines with expired_card code.'
    },
    processingError: {
      number: '4000000000000119',
      description: 'Declines with processing_error code.'
    }
  };
};

module.exports = {
  createCheckoutSession,
  getCheckoutSession,
  handleSuccessfulPayment,
  createPaymentIntent,
  confirmPaymentIntent,
  processRefund,
  getPaymentDetails,
  verifyWebhookSignature,
  handleWebhookEvent,
  healthCheck,
  getTestCards,
  TICKET_PRICES
};