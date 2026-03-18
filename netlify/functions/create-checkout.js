const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid request body' };
  }

  const { name, price, productId } = body;

  if (!name || !price || !productId) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const priceInCents = Math.round(Number(price) * 100);
  if (isNaN(priceInCents) || priceInCents <= 0) {
    return { statusCode: 400, body: 'Invalid price' };
  }

  const origin = event.headers.origin || event.headers.referer || 'https://curious-wisp-0fab32.netlify.app';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: name,
            metadata: { productId },
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${origin}/success.html?product=${encodeURIComponent(productId)}`,
      cancel_url: `${origin}/product.html?id=${encodeURIComponent(productId)}`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
