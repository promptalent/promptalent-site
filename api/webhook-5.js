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
        html: `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0f0e2a;width:100%;min-height:100vh;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0e2a;min-height:100vh;">
  <tr>
    <td align="center" style="padding:48px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#1a1740;border-radius:20px;overflow:hidden;">

        <!-- Logo -->
        <tr>
          <td style="padding:40px 48px 0;text-align:center;">
            <p style="font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:rgba(255,255,255,0.55);margin:0;">
              Promp<span style="color:#FCDE5A;">Talent</span>
            </p>
          </td>
        </tr>

        <!-- Titre -->
        <tr>
          <td style="padding:32px 48px 0;text-align:center;">
            <h1 style="font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#ffffff;margin:0 0 14px;letter-spacing:-0.5px;">
              Merci pour ton achat&nbsp;!
            </h1>
            <p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:rgba(255,255,255,0.5);line-height:1.75;margin:0;">
              Ton guide est pr&ecirc;t. Clique sur le bouton ci-dessous pour le t&eacute;l&eacute;charger<br>
              Aucun compte requis.
            </p>
          </td>
        </tr>

        <!-- Bouton -->
        <tr>
          <td style="padding:36px 48px;text-align:center;">
            <a href="${product.pdf}"
               style="display:inline-block;background:#FCDE5A;color:#1a1740;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;padding:16px 40px;border-radius:10px;text-decoration:none;">
              T&eacute;l&eacute;charger mon guide
            </a>
            <p style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.25);margin:16px 0 0;line-height:1.6;">
              Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur&nbsp;:<br>
              <span style="color:rgba(255,255,255,0.4);">${product.pdf}</span>
            </p>
          </td>
        </tr>

        <!-- Separateur -->
        <tr>
          <td style="padding:0 48px;">
            <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:28px 48px 40px;text-align:center;">
            <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.35);line-height:1.75;margin:0;">
              Pour toute question ou retour, contacte-nous&nbsp;:<br>
              <a href="mailto:noe@promptalent.fr" style="color:#FCDE5A;text-decoration:none;font-weight:600;">noe@promptalent.fr</a>
            </p>
            <p style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.18);margin:16px 0 0;">
              PrompTalent &middot; Donnez du talent &agrave; votre IA &#9889;
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`,
      });

      console.log('Email envoye a:', email);
    } else {
      console.error('Produit non trouve:', productName);
    }
  }

  return res.status(200).json({ received: true });
};
