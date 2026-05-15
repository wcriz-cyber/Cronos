import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as GateApi from "gate-api";

// Initialize Firebase Admin if GOOGLE_APPLICATION_CREDENTIALS or similar is present,
// otherwise stub it to prevent crashing.
try {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
} catch (e) {
  console.log("Firebase Admin could not be initialized automatically. Please provide credentials if needed in production.");
}

const dbId = "ai-studio-cronostrading-1fd638cb-c327-4de0-8ab3-a85d1b2f1127";
const getDb = () => getFirestore(admin.app(), dbId);


const app = express();
app.use(express.json());
const PORT = 3000;

// API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/gateio/balances", async (req, res) => {
  const { apiKey, apiSecret } = req.body;
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: "Missing API credentials" });
  }

  try {
    const client = new GateApi.ApiClient();
    // Gate.io SDK explicitly uses 'apiv4' for authentication settings
    if (client.authentications['apiv4']) {
      client.authentications['apiv4'].apiKey = apiKey;
      client.authentications['apiv4'].apiSecret = apiSecret;
    } else {
      // Fallback if the structure is different in this version
      (client as any).setApiKeySecret(apiKey, apiSecret);
    }
    const api = new GateApi.SpotApi(client);
    
    console.log(`[API] Fetching balances for user...`);
    const { body } = await api.listSpotAccounts({ currency: "USDT" });
    console.log(`[API] Balances received:`, body.length > 0 ? 'Success' : 'Empty');
    
    if (body.length > 0) {
      res.json(body[0]);
    } else {
      res.json({ currency: "USDT", available: "0", locked: "0" });
    }
  } catch (error: any) {
    console.error("Gate.io API error [Balances]:", error);
    const msg = error.message || (error.response?.body?.label) || "Error desconocido en Gate.io";
    res.status(500).json({ error: msg });
  }
});

app.get("/api/gateio/tickers", async (req, res) => {
  try {
    const response = await fetch("https://api.gateio.ws/api/v4/spot/tickers");
    if (!response.ok) throw new Error("Gate.io API error");
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/gateio/klines", async (req, res) => {
  const { pair, interval, limit } = req.query;
  try {
    const response = await fetch(`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${pair}&interval=${interval}&limit=${limit || 15}`);
    if (!response.ok) throw new Error("Gate.io API error");
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/gateio/etfs", async (req, res) => {
  try {
    // 1. Fetch currency pairs to get listing time (sell_start)
    const pairsRes = await fetch("https://api.gateio.ws/api/v4/spot/currency_pairs");
    if (!pairsRes.ok) throw new Error("Gate.io API error fetching pairs");
    const pairsData: any[] = await pairsRes.json();
    const pairsMap = new Map();
    pairsData.forEach(p => pairsMap.set(p.id, p));

    // 2. Fetch tickers for market data
    const tickerRes = await fetch("https://api.gateio.ws/api/v4/spot/tickers");
    if (!tickerRes.ok) throw new Error("Gate.io API error fetching tickers");
    const tickerData: any[] = await tickerRes.json();

    const now = Math.floor(Date.now() / 1000);
    const twoMonthsInSeconds = 60 * 24 * 60 * 60; // Approx 60 days

    // 3. Filter and process
    const etfPairs = tickerData.filter((t: any) => {
      if (!t.currency_pair.endsWith('_USDT')) return false;
      
      const isEtf = t.currency_pair.includes('3L') || 
                    t.currency_pair.includes('3S') || 
                    t.currency_pair.includes('5L') || 
                    t.currency_pair.includes('5S');
      if (!isEtf) return false;

      const metadata = pairsMap.get(t.currency_pair);
      if (!metadata) return false;

      // Filter by age (Min 2 months old)
      if (metadata.sell_start && (now - metadata.sell_start < twoMonthsInSeconds)) {
        return false;
      }

      return true;
    });

    // 4. Prioritize 5X over 3X for the same coin and direction
    // Grouping by BaseCoin + Direction (L/S)
    const grouped: Record<string, any> = {};

    etfPairs.forEach(etf => {
      const pair = etf.currency_pair; // e.g. SUI5L_USDT
      const base = pair.split('_')[0]; // e.g. SUI5L
      
      // Extract original coin and direction/leverage
      // Assuming format COIN[3/5][L/S]
      const match = base.match(/^(.+?)([35])([LS])$/i);
      if (!match) {
        // Fallback or skip if doesn't match standard ETF naming
        grouped[base] = etf;
        return;
      }

      const [_, coin, leverage, direction] = match;
      const key = `${coin.toUpperCase()}_${direction.toUpperCase()}`;
      const currentLeverage = parseInt(leverage);

      const existingEtf = grouped[key];
      let shouldReplace = !existingEtf;
      
      if (existingEtf) {
        const existingBase = existingEtf.currency_pair.split('_')[0];
        const existingMatch = existingBase.match(/[35]/);
        const existingLeverage = existingMatch ? parseInt(existingMatch[0]) : 0;
        if (currentLeverage > existingLeverage) {
          shouldReplace = true;
        }
      }

      if (shouldReplace) {
        grouped[key] = etf;
      }
    });

    const finalEtfs = Object.values(grouped);

    // 5. Sort by drop (biggest negative change first)
    const sorted = finalEtfs.sort((a: any, b: any) => parseFloat(a.change_percentage) - parseFloat(b.change_percentage));
    
    res.json(sorted);
  } catch (error: any) {
    console.error("ETF API Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/trading/gateio", async (req, res) => {
  const { action, slotId, pairs, userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const db = getDb();
    const userDoc = await db.doc(`users/${userId}`).get();
    const uData = userDoc.data();
    if (!uData?.gateIoApiKey || !uData?.gateIoApiSecret) {
      return res.status(400).json({ error: "User has no Gate.io credentials" });
    }

    const client = new GateApi.ApiClient();
    if (client.authentications['apiv4']) {
      client.authentications['apiv4'].apiKey = uData.gateIoApiKey;
      client.authentications['apiv4'].apiSecret = uData.gateIoApiSecret;
    } else {
      (client as any).setApiKeySecret(uData.gateIoApiKey, uData.gateIoApiSecret);
    }
    const spotApi = new GateApi.SpotApi(client);

    if (action === 'cancel_orders') {
      console.log(`[TRADING] Cancelling orders for ${userId} on ${pairs.join(', ')}`);
      for (const pair of pairs) {
        try {
          await spotApi.cancelOrders({ currencyPair: pair });
        } catch (e: any) {
          console.warn(`[TRADING] Cancel order failed for ${pair}:`, e.message);
        }
      }
      return res.json({ success: true, message: `Orders cancelled for ${pairs.join(', ')}` });
    }

    if (action === 'sell_all') {
      console.log(`[TRADING] Selling All for ${userId} on ${pairs.join(', ')}`);
      for (const pair of pairs) {
        try {
          await spotApi.cancelOrders({ currencyPair: pair });
          const baseCoin = pair.split('_')[0];
          const { body: accounts } = await spotApi.listSpotAccounts({ currency: baseCoin });
          if (accounts.length > 0 && parseFloat(accounts[0].available) > 0) {
            const amount = accounts[0].available;
            const order = new GateApi.Order();
            order.currencyPair = pair;
            order.side = GateApi.Order.Side.Sell;
            order.amount = amount;
            order.type = GateApi.Order.Type.Market;
            order.timeInForce = GateApi.Order.TimeInForce.Ioc;
            await spotApi.createOrder(order);
          }
        } catch (e: any) {
           console.error(`[TRADING] Sell failed for ${pair}:`, e.message);
        }
      }
      return res.json({ success: true, message: `Position sold for ${pairs.join(', ')}` });
    }

    res.json({ success: true, message: `Action ${action} executed for slot ${slotId}` });
  } catch (error: any) {
    console.error("Trading API error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Notifications
app.post("/api/notifications/push", async (req, res) => {
  const { fcmToken, title, body } = req.body;
  if (!fcmToken) {
    return res.status(400).json({ success: false, error: "No target FCM token provided" });
  }

  try {
    if (admin.apps.length > 0) {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
      });
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Firebase Admin not initialized" });
    }
  } catch (error) {
    console.error("Error sending push notification:", error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// --- BOT MOTOR ENGINE (24/7 Background Process) ---

async function runBotMotor() {
  try {
    const db = getDb();
    
    // 1. Get Global Configs
    const [botConfigSnap, premiumSnap] = await Promise.all([
      db.doc('global_settings/bot_config').get(),
      db.doc('global_settings/premium_etfs').get()
    ]);

    const botConfig = botConfigSnap.exists ? botConfigSnap.data() : { pauseAll: false, scanInterval: 10, autoReEntry: true };
    if (botConfig.pauseAll) return;

    const premiumETFs = premiumSnap.exists ? (premiumSnap.data()?.list || []) : [];

    // 2. Fetch all market prices (Tickers) once for this cycle
    const tickerRes = await fetch("https://api.gateio.ws/api/v4/spot/tickers");
    if (!tickerRes.ok) return;
    const tickersList = await tickerRes.json();
    const tickersMap = new Map();
    tickersList.forEach((t: any) => tickersMap.set(t.currency_pair, t));

    // 3. Batch process users (In a large app we would use chunks, but here it is fine)
    const usersSnap = await db.collection('users').get();
    
    for (const userDoc of usersSnap.docs) {
      const uData = userDoc.data();
      const uId = userDoc.id;
      
      // If user has no credentials, skip
      if (!uData.gateIoApiKey || !uData.gateIoApiSecret) continue;

      // Get their DCA config (personal or global)
      const [dcaSnap, globalDcaSnap] = await Promise.all([
        db.doc(`users/${uId}/config/dca`).get(),
        db.doc('global_settings/dca_strategy').get()
      ]);
      
      const dcaConfig = dcaSnap.exists ? dcaSnap.data() : (globalDcaSnap.exists ? globalDcaSnap.data() : null);
      if (!dcaConfig) {
        console.log(`[BOT] Skipping user ${uId} - No DCA config found (personal or global)`);
        continue;
      }

      // Get slots in Bot mode for this user
      const slotsSnap = await db.collection(`users/${uId}/slots`).where('mode', '==', 'Bot').get();
      
      for (const slotDoc of slotsSnap.docs) {
        const slot = slotDoc.data();
        const ticker = tickersMap.get(slot.pair);
        if (!ticker) continue;

        const currentPrice = parseFloat(ticker.last);
        const coinSymbol = slot.pair.split('_')[0].toUpperCase();
        const isPremium = premiumETFs.some((etf: string) => coinSymbol.includes(etf.toUpperCase()));
        const multiplier = (isPremium ? 3 : 1) * (slot.isDuplicated ? 2 : 1);

        let updated = false;
        let levels = [...slot.levels];
        
        // --- 1. Check DCA Purchases (Strictly Sequential) ---
        const pendingLevelIndex = levels.findIndex(l => l.status === 'Espera');
        if (pendingLevelIndex !== -1) {
          const lvl = levels[pendingLevelIndex];
          if (currentPrice <= lvl.price) {
            console.log(`[BOT] Executing sequential purchase for ${uId}: ${slot.pair} Lvl ${lvl.level}`);
            
            // Try Real Order
            try {
              const client = new GateApi.ApiClient();
              client.setApiKeySecret(uData.gateIoApiKey, uData.gateIoApiSecret);
              const spotApi = new GateApi.SpotApi(client);
              
              const order = new GateApi.Order();
              order.currencyPair = slot.pair;
              order.side = GateApi.Order.Side.Buy;
              order.amount = (lvl.baseAmount * multiplier / currentPrice).toString();
              order.type = GateApi.Order.Type.Market;
              order.timeInForce = GateApi.Order.TimeInForce.Ioc;
              
              await spotApi.createOrder(order);
              levels[pendingLevelIndex] = { ...lvl, status: 'Comprado' };
              updated = true;
            } catch (orderErr: any) {
              console.error(`[BOT] Order failed for ${uId} on ${slot.pair}:`, orderErr.message);
              // We don't mark as Comprado if order fails
            }
          }
        }

        // --- 2. Check Take Profit ---
        let invested = 0;
        let coins = 0;
        levels.forEach(lvl => {
          if (lvl.status === 'Comprado') {
            const amount = lvl.baseAmount * multiplier;
            invested += amount;
            coins += amount / lvl.price;
          }
        });

        if (invested > 0) {
          const avgPrice = invested / coins;
          const tpPercent = dcaConfig.takeProfit || 34;
          const targetPrice = avgPrice * (1 + tpPercent / 100);

          if (currentPrice >= targetPrice) {
            console.log(`[BOT] Take Profit triggered for ${uId} on ${slot.pair}!`);
            
            try {
              const client = new GateApi.ApiClient();
              client.setApiKeySecret(uData.gateIoApiKey, uData.gateIoApiSecret);
              const spotApi = new GateApi.SpotApi(client);

              // 1. Cancel remaining orders
              await spotApi.cancelOrders({ currencyPair: slot.pair });
              
              // 2. Market Sell All
              const baseCoin = slot.pair.split('_')[0];
              const { body: accounts } = await spotApi.listSpotAccounts({ currency: baseCoin });
              if (accounts.length > 0 && parseFloat(accounts[0].available) > 0) {
                const sellOrder = new GateApi.Order();
                sellOrder.currencyPair = slot.pair;
                sellOrder.side = GateApi.Order.Side.Sell;
                sellOrder.amount = accounts[0].available;
                sellOrder.type = GateApi.Order.Type.Market;
                sellOrder.timeInForce = GateApi.Order.TimeInForce.Ioc;
                await spotApi.createOrder(sellOrder);
              }

              const buyCount = levels.filter(l => l.status === 'Comprado').length;
              const currentOps = slot.operationsCount || 0;
              const newOps = currentOps + buyCount;

              if (botConfig.autoReEntry && newOps < 12) {
                const dcaStrategy = dcaConfig;
                let tempBase = currentPrice;
                const newLevels = dcaStrategy.dropsPercent.map((drop: number, idxNum: number) => {
                  if (idxNum > 0) tempBase = tempBase * (1 - drop / 100);
                  return {
                    level: idxNum + 1,
                    dropLabel: idxNum === 0 ? "Base" : `-${drop}%`,
                    price: tempBase,
                    baseAmount: dcaStrategy.amounts[idxNum],
                    status: idxNum === 0 ? 'Comprado' : 'Espera' // First level is bought at market on re-entry? 
                    // Actually, for consistency with initial slot creation, we might want to market buy the first level.
                  };
                });

                // Market Buy the new Base level for re-entry
                const baseLvl = newLevels[0];
                const reEntryOrder = new GateApi.Order();
                reEntryOrder.currencyPair = slot.pair;
                reEntryOrder.side = GateApi.Order.Side.Buy;
                reEntryOrder.amount = (baseLvl.baseAmount * multiplier / currentPrice).toString();
                reEntryOrder.type = GateApi.Order.Type.Market;
                reEntryOrder.timeInForce = GateApi.Order.TimeInForce.Ioc;
                await spotApi.createOrder(reEntryOrder);
                
                await slotDoc.ref.update({
                  basePrice: currentPrice,
                  levels: newLevels,
                  operationsCount: newOps,
                  updatedAt: Date.now()
                });
              } else {
                await slotDoc.ref.update({
                  mode: 'Manual',
                  operationsCount: newOps,
                  updatedAt: Date.now()
                });
              }
              updated = false; 
            } catch (tpErr: any) {
              console.error(`[BOT] TP failed for ${uId} on ${slot.pair}:`, tpErr.message);
            }
          }
        }

        if (updated) {
          await slotDoc.ref.update({ 
            levels, 
            change: ticker.change_percentage + '%',
            updatedAt: Date.now() 
          });
        }
      }
    }
  } catch (err) {
    console.error("Critical error in Bot Motor:", err);
  } finally {
    // Schedule next run
    const botConfigSnap = await getDb().doc('global_settings/bot_config').get();
    const interval = (botConfigSnap.data()?.scanInterval || 10) * 1000;
    setTimeout(runBotMotor, interval);
  }
}

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: process.cwd(),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Start the background process AFTER server is listening
    runBotMotor().catch(console.error);
  });
}

startServer();
