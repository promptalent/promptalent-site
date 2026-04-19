const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

const PRODUCTS = {
  'Commercial': {
    pdf: process.env.PDF_COMMERCIAL_URL,
    subject: '40 Prompts IA pour un Commercial — PrompTalent',
  },
  'Manager Equipe': {
    pdf: process.env.PDF_MANAGER_URL,
    subject: "50 Prompts IA pour un Manager d'Equipe — PrompTalent",
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

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details.email;
    const productName = session.metadata.productName;
    const product = PRODUCTS[productName];

    console.log('Paiement recu pour:', productName, '- Email:', email);

    if (product) {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: '"PrompTalent" <' + process.env.SMTP_USER + '>',
        to: email,
        subject: product.subject,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f0e2a;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0e2a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1740;border-radius:16px;overflow:hidden;width:100%;max-width:600px;">
      
      <!-- Header -->
      <tr>
        <td style="background:#1a1740;padding:40px 48px 0;text-align:center;">
          <p style="font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:rgba(255,255,255,0.6);margin:0;">
            Promp<span style="color:#FCDE5A;">Talent</span>
          </p>
        </td>
      </tr>

      <!-- Titre -->
      <tr>
        <td style="padding:32px 48px 0;text-align:center;">
          <h1 style="font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#fff;margin:0 0 12px;letter-spacing:-0.5px;">
            Merci pour ton achat !
          </h1>
          <p style="font-family:Helvetica,Arial,sans-serif;font-size:16px;color:rgba(255,255,255,0.5);line-height:1.7;margin:0;">
            Ton guide est pret. Clique sur le bouton ci-dessous pour le telecharger — aucun compte requis.
          </p>
        </td>
      </tr>

      <!-- Bouton -->
      <tr>
        <td style="padding:36px 48px;text-align:center;">
          <a href="${product.pdf}" 
             style="display:inline-block;background:#FCDE5A;color:#1a1740;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;padding:16px 40px;border-radius:10px;text-decoration:none;">
            Telecharger mon guide
          </a>
          <p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.3);margin:16px 0 0;">
            Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br>
            <span style="color:rgba(255,255,255,0.5);">${product.pdf}</span>
          </p>
        </td>
      </tr>

      <!-- Separateur -->
      <tr>
        <td style="padding:0 48px;">
          <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:28px 48px 36px;text-align:center;">
          <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.35);line-height:1.7;margin:0;">
            Pour toute question ou retour, contacte-nous :<br>
            <a href="mailto:noe@promptalent.fr" style="color:#FCDE5A;text-decoration:none;">noe@promptalent.fr</a>
          </p>
          <p style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.2);margin:16px 0 0;">
            PrompTalent &middot; Donnez du talent a votre IA
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>
`,
      });

      console.log('Email envoye a:', email);
    } else {
      console.error('Produit non trouve:', productName);
    }
  }

  return res.status(200).json({ received: true });
};
