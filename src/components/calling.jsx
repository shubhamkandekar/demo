import React, { useState, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('https://driverse.onrender.com'); // Replace with your server URL

function CallerPage() {
  const [myId, setMyId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [inCall, setInCall] = useState(false);
  const [joined, setJoined] = useState(false);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const joinCall = () => {
    if (myId) {
      socket.emit('join', { userId: myId });
      setJoined(true);
    }
  };

  const startCall = () => {
    if (!joined) {
      alert('Please join before starting a call.');
      return;
    }
    // Request access to audio
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      localStreamRef.current.srcObject = stream;

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      // Send local audio stream to peer
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { candidate: event.candidate, to: receiverId });
        }
      };

      peerConnection.ontrack = (event) => {
        const remoteStream = new MediaStream();
        event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
        document.getElementById('remote-audio').srcObject = remoteStream;
      };

      socket.emit('call', { receiverId });

      peerConnection.createOffer().then((offer) => {
        peerConnection.setLocalDescription(offer);
        socket.emit('offer', { offer, to: receiverId });
      });
    });
  };

  socket.on('answer', ({ answer }) => {
    peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    setInCall(true);
  });

  socket.on('ice-candidate', ({ candidate }) => {
    peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
  });

  return (
    <div>
      <h1>Caller Page</h1>

      <input
        type="text"
        placeholder="Enter your ID"
        value={myId}
        onChange={(e) => setMyId(e.target.value)}
      />
      <button onClick={joinCall} disabled={joined}>
        Join
      </button>

      <input
        type="text"
        placeholder="Enter receiver ID"
        value={receiverId}
        onChange={(e) => setReceiverId(e.target.value)}
        disabled={!joined}
      />
      <button onClick={startCall} disabled={!joined}>
        Start Call
      </button>

      <h2>Status: {inCall ? 'In Call' : 'Waiting...'}</h2>

      <audio id="remote-audio" autoPlay></audio>
      <audio ref={localStreamRef} autoPlay muted></audio>

      <button onClick={() => peerConnectionRef.current.close()}>End Call</button>
    </div>
  );
}

export default CallerPage;
