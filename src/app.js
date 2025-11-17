import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { apiLimiter, authLimiter } from './middlewares/rateLimiter.js';
import securityHeaders from './middlewares/securityHeaders.js';
import corsOptions from './config/cors.js';
import errorHandler from './middlewares/errorHandler.js';
import adminRoutes from './routes/adminRoute.js';
import express from "express"
import leadRoutes from './routes/leadRoute.js';
import quotationRoutes from './routes/quotationRoute.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoute.js';
import reportRoutes from './routes/reportRoute.js';
import fileRoutes from './routes/fileRoute.js';
import productRoutes from './routes/productRoute.js';
const app = express();

app.use(securityHeaders);

app.use(cors(corsOptions));

app.use(cookieParser());

app.use(morgan('combined'));

app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb'
}));

app.use(apiLimiter);

app.use('/api/admin', adminRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/products', productRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true,
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

app.use(errorHandler);

export default app;