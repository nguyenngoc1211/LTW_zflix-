import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Adjust the URL to match your backend server
const SOCKET_URL = 'http://localhost:3000/watch-party';

/**
 * WatchParty component
 * - Sync video playback among participants (already existing logic in backend socket)
 * - Real‑time chat
 * - Host transfer handling (listens to "host-changed")
 * - Voice & Camera via WebRTC (peer‑to‑peer streams)
 */
export default function WatchParty({ partyId, userId, username }) {
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const pcRef = useRef(null); // RTCPeerConnection
  const [chatMsg, setChatMsg] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState([]); // array of MediaStream
  const [isHost, setIsHost] = useState(false);
  const isRemoteAction = useRef(false);

  // ---------- Socket setup ----------
  useEffect(() => {
    const socket = io(SOCKET_URL, { autoConnect: false });
    socketRef.current = socket;
    socket.connect();
    socket.emit('join-party', { partyId });

    // playback sync from server
    socket.on('playback-sync', ({ currentPosition, isPlaying: remotePlaying }) => {
      if (!videoRef.current) return;
      isRemoteAction.current = true;
      videoRef.current.currentTime = currentPosition;
      remotePlaying ? videoRef.current.play() : videoRef.current.pause();
    });

    socket.on('party-joined', ({ username: uname }) => {
      setChatLog((log) => [...log, { system: true, text: `${uname} joined the party.` }]);
    });

    socket.on('party-left', ({ userId: uid, username: uname }) => {
      setChatLog((log) => [...log, { system: true, text: `${uname} left the party.` }]);
      // remove remote streams that belong to the left user (if we kept a map, here we just clear all – UI will re‑add later)
      setRemoteStreams((streams) => streams.filter((s) => s.id !== uid));
    });

    socket.on('new-chat', (msg) => {
      setChatLog((log) => [...log, msg]);
    });

    socket.on('host-changed', ({ newHostId }) => {
      setIsHost(newHostId === userId);
      setChatLog((log) => [...log, { system: true, text: `Host changed to ${newHostId}` }]);
    });

    // WebRTC signalling events
    socket.on('voice-offer', async ({ from, sdp }) => {
      await ensurePeerConnection();
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socket.emit('voice-answer', { partyId, to: from, sdp: pcRef.current.localDescription });
    });

    socket.on('voice-answer', async ({ sdp }) => {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on('video-offer', async ({ from, sdp }) => {
      await ensurePeerConnection();
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socket.emit('video-answer', { partyId, to: from, sdp: pcRef.current.localDescription });
    });

    socket.on('video-answer', async ({ sdp }) => {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { console.error(e); }
    });

    return () => {
      socket.emit('leave-party', { partyId });
      socket.disconnect();
      if (pcRef.current) pcRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  // ---------- Video element event handlers ----------
  const handlePlay = () => {
    if (isRemoteAction.current) { isRemoteAction.current = false; return; }
    socketRef.current.emit('sync-playback', { partyId, currentPosition: videoRef.current.currentTime, isPlaying: true });
  };

  const handlePause = () => {
    if (isRemoteAction.current) { isRemoteAction.current = false; return; }
    socketRef.current.emit('sync-playback', { partyId, currentPosition: videoRef.current.currentTime, isPlaying: false });
  };

  const handleSeeked = () => {
    if (isRemoteAction.current) { isRemoteAction.current = false; return; }
    socketRef.current.emit('sync-playback', { partyId, currentPosition: videoRef.current.currentTime, isPlaying: videoRef.current.paused === false });
  };

  // ---------- Chat ----------
  const sendChat = (e) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    const payload = { partyId, message: chatMsg.trim(), timestampInVideo: videoRef.current?.currentTime || 0 };
    socketRef.current.emit('chat-message', payload);
    setChatLog((log) => [...log, { userId, username, message: chatMsg.trim(), isSystemMessage: false }]);
    setChatMsg('');
  };

  // ---------- WebRTC helpers ----------
  async function ensurePeerConnection() {
    if (pcRef.current) return;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    // when we get remote tracks (audio or video)
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStreams((prev) => {
        // avoid duplicates
        if (prev.find((s) => s.id === stream.id)) return prev;
        return [...prev, stream];
      });
    };

    // forward ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit('ice-candidate', { partyId, candidate: e.candidate });
      }
    };
  }

  // ---------- Mic / Camera toggle ----------
  const toggleMic = async () => {
    if (!isHost) return alert('Only host can enable mic');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await ensurePeerConnection();
    stream.getAudioTracks().forEach((track) => pcRef.current.addTrack(track, stream));
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    socketRef.current.emit('voice-offer', { partyId, sdp: pcRef.current.localDescription });
  };

  const toggleCam = async () => {
    if (!isHost) return alert('Only host can enable camera');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    await ensurePeerConnection();
    stream.getVideoTracks().forEach((track) => pcRef.current.addTrack(track, stream));
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    socketRef.current.emit('video-offer', { partyId, sdp: pcRef.current.localDescription });
  };

  // ---------- Render ----------
  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      {/* Main video */}
      <div style={{ flex: 2 }}>
        <h2>Watch Party – Room {partyId}</h2>
        <video
          ref={videoRef}
          controls
          width="100%"
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeeked}
          src="/path/to/your/video.mp4" // TODO: replace with actual episode URL from backend
        />
        {/* Voice & Camera controls – available to all participants */}
        <div style={{ marginTop: '10px' }}>
          <button onClick={toggleMic}>🎤 Toggle Mic</button>
          <button onClick={toggleCam} style={{ marginLeft: '8px' }}>📹 Toggle Camera</button>
        </div>
        {/* Remote streams (audio/video) */}
        <div style={{ marginTop: '10px' }}>
          {remoteStreams.map((stream) => (
            <video key={stream.id} autoPlay playsInline muted={false} srcObject={stream} style={{ width: '200px', marginRight: '5px' }} />
          ))}
        </div>
      </div>

      {/* Chat sidebar */}
      <div style={{ flex: 1, borderLeft: '1px solid #ddd', paddingLeft: '15px' }}>
        <h3>Chat</h3>
        <div style={{ height: '300px', overflowY: 'auto', border: '1px solid #ccc', padding: '8px' }}>
          {chatLog.map((msg, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              {msg.system ? (
                <em style={{ color: '#555' }}>{msg.text}</em>
              ) : (
                <span><strong>{msg.username || msg.userId}:</strong> {msg.message || msg.text}</span>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={sendChat} style={{ marginTop: '8px', display: 'flex' }}>
          <input
            type="text"
            value={chatMsg}
            onChange={(e) => setChatMsg(e.target.value)}
            placeholder="Type a message..."
            style={{ flex: 1, padding: '6px' }}
          />
          <button type="submit" style={{ marginLeft: '4px' }}>Send</button>
        </form>
      </div>
    </div>
  );
}
