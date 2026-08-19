import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import cardRoutes from './routes/cards.js';
import walletRoutes from './routes/wallet.js';
import adminRoutes from './routes/admin.js';
import partnerRoutes from './routes/partner/index.js';
import partnerPortalRoutes from './routes/partnerPortal.js';
import webhookRoutes from './routes/webhooks.js';
import sandboxRoutes from './routes/sandbox.js';
import kycRoutes from './routes/kyc.js';
import activityRoutes from './routes/activities.js';
import reportingRoutes from './routes/reporting.js';
import complianceRoutes from './routes/compliance.js';
import { store } from './data/store.js';
import { getWirexBaaSConfig } from './config.js';
import { brandStore } from './data/brandStore.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => {
    (req as typeof req & { rawBody?: string }).rawBody = buf.toString('utf8');
  },
}));

app.get('/health', (_, res) => {
  const w = getWirexBaaSConfig();
  res.json({
    ok: true,
    mock: config.useMockWirex,
    environment: w.environment,
    chainId: w.chainId,
    apiBase: w.apiBase,
  });
});
app.get('/api/health', (_, res) => {
  const w = getWirexBaaSConfig();
  res.json({ ok: true, environment: w.environment, mock: config.useMockWirex });
});
app.get('/api/brand', (_, res) => {
  res.json(brandStore.publicView());
});

app.get('/api/catalog', (_, res) => {
  const w = getWirexBaaSConfig();
  const brand = brandStore.get();
  res.json({
    product: brand.productName,
    environment: w.environment,
    mock: config.useMockWirex,
    features: {
      cardIssuance: ['POST /api/cards/virtual', 'POST /api/cards/plastic', 'POST /api/cards/:id/wallet-tokens'],
      userKyc: ['POST /api/auth/register', 'GET /api/kyc/verification-link', 'GET /api/kyc/status', 'POST /api/compliance/travel-rule/validate'],
      webhooks: ['POST /v2/webhooks/activities|cards|3ds|user'],
      settlementReporting: ['GET /api/activities', 'GET /api/reporting/statement', 'GET /api/reporting/reconciliation'],
      multiTenant: ['/api/partner/v1/*'],
      sandboxProduction: ['WIREX_ENV=sandbox|production', 'GET /health'],
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/partner/v1', partnerRoutes);
app.use('/api/partner-portal', partnerPortalRoutes);
app.use('/api/sandbox', sandboxRoutes);
app.use('/v2/webhooks', webhookRoutes);
app.use('/webhook', webhookRoutes);

app.listen(config.port, config.host, () => {
  store.loadUsers();
  console.log(`Server running at http://${config.host}:${config.port}`);
  console.log(`Wirex: ${config.useMockWirex ? 'MOCK' : 'LIVE'} env=${getWirexBaaSConfig().environment}`);
  console.log(`Users loaded: ${store.users.size}`);
});
