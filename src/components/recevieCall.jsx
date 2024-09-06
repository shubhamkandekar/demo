import React, { useState, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('https://driverse.onrender.com'); // Replace with your server URL

function ReceiverPage() {
  const [myId, setMyId] = useState('');
  const [callerId, setCallerId] = useState('');
  const [inCall, setInCall] = useState(false);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  socket.on('incomingCall', ({ callerId }) => {
    setCallerId(callerId);
  });

  const acceptCall = () => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      localStreamRef.current.srcObject = stream;

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('ice-candidate', { candidate: event.candidate, to: callerId });
        }
      };

      peerConnection.ontrack = event => {
        const remoteStream = new MediaStream();
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
        document.getElementById('remote-audio').srcObject = remoteStream;
      };

      socket.emit('acceptCall', { callerId });

      socket.on('offer', ({ offer }) => {
        peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        peerConnection.createAnswer().then(answer => {
          peerConnection.setLocalDescription(answer);
          socket.emit('answer', { answer, to: callerId });
        });
      });
    });
  };

  socket.on('ice-candidate', ({ candidate }) => {
    peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
  });

  return (
    <div>
      <h1>Receiver Page</h1>
      <input
        type="text"
        placeholder="Enter your ID"
        value={myId}
        onChange={(e) => setMyId(e.target.value)}
      />
      <button onClick={() => socket.emit('join', { userId: myId })}>Join</button>

      {callerId && <h2>Incoming call from {callerId}</h2>}

      <button onClick={acceptCall} disabled={inCall}>Accept Call</button>

      <audio id="remote-audio" autoPlay></audio>
      <audio ref={localStreamRef} autoPlay muted></audio>

      <button onClick={() => peerConnectionRef.current.close()}>End Call</button>
    </div>
  );
}

export default ReceiverPage;
