const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

// Mapping produit → fichier PDF hébergé
const PRODUCTS = {
  'Commercial': {
    pdf: process.env.PDF_COMMERCIAL_URL,
    subject: '40 Prompts IA pour un Commercial — PrompTalent',
  },
  'Manager': {
    pdf: process.env.PDF_MANAGER_URL,
    subject: '50 Prompts IA pour un Manager — PrompTalent',
  },
  'Recruteur': {
    pdf: process.env.PDF_RECRUTEUR_URL,
    subject: '60 Prompts IA pour un Recruteur — PrompTalent',
  },
  'Chef de Projet': {
    pdf: process.env.PDF_CDP_URL,
    subject: '60 Prompts IA pour un Chef de Projet — PrompTalent',
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details.email;
    const productName = session.metadata.productName;
    const product = PRODUCTS[productName];

    if (!product) {
      console.error('Produit non trouvé:', productName);
      return res.status(200).json({ received: true });
    }

    // Envoyer le PDF par email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"PrompTalent" <${process.env.SMTP_USER}>`,
      to: email,
      subject: product.subject,
      html: `
        <div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1740;color:#fff;padding:40px;border-radius:12px;">
          <h1 style="color:#FCDE5A;font-size:24px;margin-bottom:16px;">Promp<span style="color:#fff;">Talent</span></h1>
          <h2 style="font-size:20px;margin-bottom:16px;">Merci pour ton achat !</h2>
          <p style="color:rgba(255,255,255,0.7);line-height:1.7;margin-bottom:24px;">
            Ton guide <strong style="color:#fff;">${product.subject.split('—')[0].trim()}</strong> est disponible en téléchargement ci-dessous.
          </p>
          <a href="${product.pdf}" 
             style="display:inline-block;background:#FCDE5A;color:#1a1740;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;">
            Télécharger mon guide →
          </a>
          <p style="color:rgba(255,255,255,0.4);font-size:12px;margin-top:32px;">
            PrompTalent · Donnez du talent à votre IA ⚡
          </p>
        </div>
      `,
    });

    console.log(`Email envoyé à ${email} pour ${productName}`);
  }

  return res.status(200).json({ received: true });
};
