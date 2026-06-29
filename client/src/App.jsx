import { useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import './App.css';

const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const qualityPresets = {
  stable: {
    label: 'Stable 720p 30fps',
    video: { width: 1280, height: 720, frameRate: 30 },
  },
  balanced: {
    label: 'Balanced 1080p 30fps',
    video: { width: 1920, height: 1080, frameRate: 30 },
  },
  motion: {
    label: 'Motion 1080p 60fps',
    video: { width: 1920, height: 1080, frameRate: 60 },
  },
  sharp: {
    label: 'Sharp 1440p 30fps',
    video: { width: 2560, height: 1440, frameRate: 30 },
  },
};

function makeRoomName() {
  return `movie-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [roomName, setRoomName] = useState(makeRoomName());
  const [userName, setUserName] = useState(`friend-${Math.random().toString(36).slice(2, 5)}`);
  const [role, setRole] = useState('host');
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('Not connected');
  const [isSharing, setIsSharing] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [quality, setQuality] = useState('balanced');

  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const inviteText = useMemo(() => {
    return `${window.location.origin}?room=${encodeURIComponent(roomName)}&role=viewer`;
  }, [roomName]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const roleParam = params.get('role');

    if (roomParam) {
      setRoomName(roomParam);
    }

    if (roleParam === 'viewer') {
      setRole('viewer');
    }
  }, []);

  async function connect() {
    setStatus('Getting room access...');

    const response = await fetch(`${serverUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, userName, role }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Could not get token.');
    }

    const { token, url } = await response.json();

    const nextRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    nextRoom.on(RoomEvent.TrackSubscribed, (track, publication) => {
      if (publication.source === Track.Source.ScreenShare && videoRef.current) {
        track.attach(videoRef.current);
      }

      if (publication.source === Track.Source.ScreenShareAudio && audioRef.current) {
        track.attach(audioRef.current);
        audioRef.current.play().catch(() => {});
      }
    });

    nextRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
    });

    nextRoom.on(RoomEvent.ParticipantConnected, () => {
      setViewerCount(nextRoom.remoteParticipants.size);
    });

    nextRoom.on(RoomEvent.ParticipantDisconnected, () => {
      setViewerCount(nextRoom.remoteParticipants.size);
    });

    await nextRoom.connect(url, token);
    setRoom(nextRoom);
    setViewerCount(nextRoom.remoteParticipants.size);
    setStatus(`Connected as ${role}`);
  }

  async function startShare() {
  if (!room) return;

  const selectedQuality = qualityPresets[quality];

  setStatus('Choose a tab, window, or screen...');
  await room.localParticipant.setScreenShareEnabled(true, {
    audio: true,
    video: selectedQuality.video,
  });

  setIsSharing(true);
  setStatus(`Screen sharing: ${selectedQuality.label}`);
  }

  async function stopShare() {
    if (!room) return;

    await room.localParticipant.setScreenShareEnabled(false);
    setIsSharing(false);
    setStatus('Connected');
  }

  async function disconnect() {
    await room?.disconnect();
    setRoom(null);
    setIsSharing(false);
    setViewerCount(0);
    setStatus('Not connected');
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteText);
    setStatus('Invite copied');
  }

  return (
    <main className="shell">
      <section className="controls">
        <div>
          <p className="eyebrow">Watch Party</p>
          <h1>Screen Share Room</h1>
        </div>

        <label>
          Room name
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} disabled={!!room} />
        </label>

        <label>
          Your name
          <input value={userName} onChange={(event) => setUserName(event.target.value)} disabled={!!room} />
        </label>

        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value)} disabled={!!room}>
            <option value="host">Host</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>

        <label>
          Quality
          <select value={quality} onChange={(event) => setQuality(event.target.value)} disabled={!!room}>
            <option value="stable">Stable 720p 30fps</option>
            <option value="balanced">Balanced 1080p 30fps</option>
            <option value="motion">Motion 1080p 60fps</option>
            <option value="sharp">Sharp 1440p 30fps</option>
          </select>
        </label>

        <div className="buttons">
          {!room ? (
            <button onClick={connect}>Join Room</button>
          ) : (
            <button className="secondary" onClick={disconnect}>Leave</button>
          )}

          {room && role === 'host' && !isSharing && (
            <button onClick={startShare}>Share Screen</button>
          )}

          {room && role === 'host' && isSharing && (
            <button className="danger" onClick={stopShare}>Stop Sharing</button>
          )}
        </div>

        <button className="linkButton" onClick={copyInvite}>
          Copy Viewer Invite
        </button>

        <div className="status">
          <span>{status}</span>
          <span>{viewerCount} viewer{viewerCount === 1 ? '' : 's'}</span>
        </div>
      </section>

      <section className="stage">
        <video ref={videoRef} autoPlay playsInline controls />
        <audio ref={audioRef} autoPlay />
        <p>When the host shares, the screen appears here.</p>
      </section>
    </main>
  );
}