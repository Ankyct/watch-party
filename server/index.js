import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { AccessToken } from 'livekit-server-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/token', async (req, res) => {
  const { roomName, userName, role } = req.body;

  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return res.status(500).json({ error: 'LiveKit environment values are missing.' });
  }

  if (!roomName || !userName) {
    return res.status(400).json({ error: 'roomName and userName are required.' });
  }

  const isHost = role === 'host';

  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: userName,
      name: userName,
    }
  );

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canSubscribe: true,
    canPublish: isHost,
    canPublishData: true,
  });

  res.json({
    token: await token.toJwt(),
    url: process.env.LIVEKIT_URL,
  });
});

app.listen(port, () => {
  console.log(`Token server running on http://localhost:${port}`);
});