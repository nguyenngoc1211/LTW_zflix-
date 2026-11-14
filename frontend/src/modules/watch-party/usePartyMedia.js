import { useCallback, useEffect, useRef, useState } from "react";
import { getPartySocket } from "../../services/socket.js";

const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const loadIceServers = () => {
  const configured = import.meta.env.VITE_WEBRTC_ICE_SERVERS;
  if (!configured) return DEFAULT_ICE_SERVERS;
  try {
    const parsed = JSON.parse(configured);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ICE_SERVERS;
  } catch {
    console.warn("VITE_WEBRTC_ICE_SERVERS is not valid JSON; using public STUN servers.");
    return DEFAULT_ICE_SERVERS;
  }
};

const cloneStream = (stream) => new MediaStream(stream?.getTracks() || []);

export const usePartyMedia = ({ partyId, enabled }) => {
  const peersRef = useRef(new Map());
  const localStreamRef = useRef(new MediaStream());
  const mediaStateRef = useRef({ audioEnabled: false, videoEnabled: false });

  const [localStream, setLocalStream] = useState(() => new MediaStream());
  const [remotePeers, setRemotePeers] = useState([]);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [mediaError, setMediaError] = useState("");

  const updateRemotePeer = useCallback((peerId, changes) => {
    setRemotePeers((current) => {
      const index = current.findIndex((peer) => peer.peerId === peerId);
      if (index === -1) {
        return [...current, { peerId, audioEnabled: false, videoEnabled: false, ...changes }];
      }
      return current.map((peer, peerIndex) => (
        peerIndex === index ? { ...peer, ...changes } : peer
      ));
    });
  }, []);

  const removePeer = useCallback((peerId) => {
    const entry = peersRef.current.get(peerId);
    entry?.pc.close();
    peersRef.current.delete(peerId);
    setRemotePeers((current) => current.filter((peer) => peer.peerId !== peerId));
  }, []);

  const emitSignal = useCallback((eventName, payload) => {
    const socket = getPartySocket();
    if (socket.connected) socket.emit(eventName, { partyId, ...payload });
  }, [partyId]);

  const createPeerConnection = useCallback((peerInfo) => {
    if (!peerInfo?.peerId) return null;
    const existing = peersRef.current.get(peerInfo.peerId);
    if (existing) {
      updateRemotePeer(peerInfo.peerId, peerInfo);
      return existing;
    }

    const socket = getPartySocket();
    const pc = new RTCPeerConnection({ iceServers: loadIceServers() });
    const remoteStream = new MediaStream();
    const entry = {
      pc,
      remoteStream,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      polite: String(socket.id || "") > String(peerInfo.peerId),
    };

    const audioTransceiver = pc.addTransceiver("audio", { direction: "recvonly" });
    const videoTransceiver = pc.addTransceiver("video", { direction: "recvonly" });
    const localAudio = localStreamRef.current.getAudioTracks()[0];
    const localVideo = localStreamRef.current.getVideoTracks()[0];
    if (localAudio) {
      audioTransceiver.sender.replaceTrack(localAudio);
      audioTransceiver.direction = "sendrecv";
    }
    if (localVideo) {
      videoTransceiver.sender.replaceTrack(localVideo);
      videoTransceiver.direction = "sendrecv";
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        emitSignal("webrtc-ice-candidate", { to: peerInfo.peerId, candidate });
      }
    };

    pc.ontrack = ({ track }) => {
      if (!remoteStream.getTracks().some((item) => item.id === track.id)) {
        remoteStream.addTrack(track);
      }
      updateRemotePeer(peerInfo.peerId, { stream: remoteStream });
      track.onended = () => {
        remoteStream.removeTrack(track);
        updateRemotePeer(peerInfo.peerId, { stream: remoteStream });
      };
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) removePeer(peerInfo.peerId);
    };

    peersRef.current.set(peerInfo.peerId, entry);
    updateRemotePeer(peerInfo.peerId, { ...peerInfo, stream: remoteStream });
    return entry;
  }, [emitSignal, removePeer, updateRemotePeer]);

  const negotiate = useCallback(async (peerId) => {
    const entry = peersRef.current.get(peerId);
    if (!entry || entry.pc.signalingState === "closed") return;
    try {
      entry.makingOffer = true;
      await entry.pc.setLocalDescription();
      emitSignal("webrtc-offer", { to: peerId, description: entry.pc.localDescription });
    } catch (error) {
      console.error("WebRTC offer failed:", error);
    } finally {
      entry.makingOffer = false;
    }
  }, [emitSignal]);

  const syncTrackToPeers = useCallback(async (kind, track) => {
    const negotiations = [];
    for (const [peerId, entry] of peersRef.current) {
      const transceiver = entry.pc.getTransceivers().find(
        (item) => item.receiver.track?.kind === kind,
      );
      if (!transceiver) continue;
      await transceiver.sender.replaceTrack(track || null);
      transceiver.direction = track ? "sendrecv" : "recvonly";
      negotiations.push(negotiate(peerId));
    }
    await Promise.allSettled(negotiations);
  }, [negotiate]);

  const broadcastMediaState = useCallback((nextState) => {
    mediaStateRef.current = nextState;
    getPartySocket().emit("media-state", { partyId, ...nextState });
  }, [partyId]);

  const toggleMedia = useCallback(async (kind) => {
    const isAudio = kind === "audio";
    const currentlyEnabled = isAudio
      ? mediaStateRef.current.audioEnabled
      : mediaStateRef.current.videoEnabled;

    setMediaError("");
    if (currentlyEnabled) {
      const tracks = isAudio
        ? localStreamRef.current.getAudioTracks()
        : localStreamRef.current.getVideoTracks();
      tracks.forEach((track) => {
        track.stop();
        localStreamRef.current.removeTrack(track);
      });
      await syncTrackToPeers(kind, null);
      const nextState = {
        ...mediaStateRef.current,
        [isAudio ? "audioEnabled" : "videoEnabled"]: false,
      };
      broadcastMediaState(nextState);
      if (isAudio) setMicEnabled(false);
      else setCameraEnabled(false);
      setLocalStream(cloneStream(localStreamRef.current));
      return;
    }

    try {
      const captured = await navigator.mediaDevices.getUserMedia(
        isAudio ? { audio: true } : { video: true },
      );
      const track = isAudio ? captured.getAudioTracks()[0] : captured.getVideoTracks()[0];
      if (!track) throw new Error("Thiết bị không cung cấp luồng media.");
      localStreamRef.current.addTrack(track);
      track.onended = () => {
        if (mediaStateRef.current[isAudio ? "audioEnabled" : "videoEnabled"]) {
          toggleMedia(kind);
        }
      };
      await syncTrackToPeers(kind, track);
      const nextState = {
        ...mediaStateRef.current,
        [isAudio ? "audioEnabled" : "videoEnabled"]: true,
      };
      broadcastMediaState(nextState);
      if (isAudio) setMicEnabled(true);
      else setCameraEnabled(true);
      setLocalStream(cloneStream(localStreamRef.current));
    } catch (error) {
      const label = isAudio ? "micro" : "camera";
      setMediaError(`Không thể mở ${label}. Hãy cho phép trình duyệt truy cập thiết bị.`);
      console.error(`Unable to enable ${kind}:`, error);
    }
  }, [broadcastMediaState, syncTrackToPeers]);

  useEffect(() => {
    if (!enabled || !partyId) return undefined;
    const socket = getPartySocket();
    const peerConnections = peersRef.current;

    const handlePeerList = async ({ peers = {} } = {}) => {
      const peerList = Array.isArray(peers) ? peers : [];
      socket.emit("media-state", { partyId, ...mediaStateRef.current });
      for (const peer of peerList) {
        createPeerConnection(peer);
        await negotiate(peer.peerId);
      }
    };

    const handlePeerJoined = (peer) => createPeerConnection(peer);
    const handlePeerLeft = ({ peerId }) => removePeer(peerId);
    const handleMediaState = ({ peerId, audioEnabled, videoEnabled }) => {
      updateRemotePeer(peerId, { audioEnabled, videoEnabled });
    };

    const handleDescription = async ({ from, userId, username, description }) => {
      if (!from || !description) return;
      const entry = createPeerConnection({ peerId: from, userId, username });
      if (!entry) return;
      const readyForOffer = !entry.makingOffer
        && (entry.pc.signalingState === "stable" || entry.isSettingRemoteAnswerPending);
      const offerCollision = description.type === "offer" && !readyForOffer;
      entry.ignoreOffer = !entry.polite && offerCollision;
      if (entry.ignoreOffer) return;

      try {
        entry.isSettingRemoteAnswerPending = description.type === "answer";
        await entry.pc.setRemoteDescription(description);
        entry.isSettingRemoteAnswerPending = false;
        if (description.type === "offer") {
          await entry.pc.setLocalDescription();
          emitSignal("webrtc-answer", { to: from, description: entry.pc.localDescription });
        }
      } catch (error) {
        console.error("WebRTC description failed:", error);
      }
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      const entry = peersRef.current.get(from);
      if (!entry || !candidate) return;
      try {
        await entry.pc.addIceCandidate(candidate);
      } catch (error) {
        if (!entry.ignoreOffer) console.error("WebRTC ICE candidate failed:", error);
      }
    };

    socket.on("media-peers", handlePeerList);
    socket.on("media-peer-joined", handlePeerJoined);
    socket.on("media-peer-left", handlePeerLeft);
    socket.on("media-state", handleMediaState);
    socket.on("webrtc-offer", handleDescription);
    socket.on("webrtc-answer", handleDescription);
    socket.on("webrtc-ice-candidate", handleIceCandidate);

    return () => {
      socket.off("media-peers", handlePeerList);
      socket.off("media-peer-joined", handlePeerJoined);
      socket.off("media-peer-left", handlePeerLeft);
      socket.off("media-state", handleMediaState);
      socket.off("webrtc-offer", handleDescription);
      socket.off("webrtc-answer", handleDescription);
      socket.off("webrtc-ice-candidate", handleIceCandidate);
      for (const entry of peerConnections.values()) entry.pc.close();
      peerConnections.clear();
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = new MediaStream();
    };
  }, [createPeerConnection, emitSignal, enabled, negotiate, partyId, removePeer, updateRemotePeer]);

  return {
    localStream,
    remotePeers,
    micEnabled,
    cameraEnabled,
    mediaError,
    toggleMic: () => toggleMedia("audio"),
    toggleCamera: () => toggleMedia("video"),
  };
};
