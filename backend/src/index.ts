import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import cardRoutes from './routes/cards.js';
import walletRoutes from './routes/wallet.js';
import adminRoutes from './routes/admin.js';
import kycRoutes from './routes/kyc.js';
import partnerRoutes from './routes/partner/index.js';
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true, mock: config.useMockWirex }));
app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/partner/v1', partnerRoutes);

import { store } from './data/store.js';

app.listen(config.port, '127.0.0.1', () => {
  store.loadUsers();
  console.log(`Server running at http://127.0.0.1:${config.port}`);
  console.log(`Wirex: ${config.useMockWirex ? 'MOCK' : 'LIVE'}`);
  console.log(`Users loaded: ${store.users.size}`);
});
