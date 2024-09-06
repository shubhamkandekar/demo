import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const socket = io("https://driverse.onrender.com"); // Replace with your server URL

let peerConnection;

const config = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

function App() {
  const [userId, setUserId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [callStatus, setCallStatus] = useState(""); // idle, calling, receiving, inCall
  const [callerId, setCallerId] = useState("");
  const [inCall, setInCall] = useState(false);
  const callerTuneRef = useRef(null);
  const ringToneRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  useEffect(() => {
    // Set up socket listeners for signaling
    socket.on("incomingCall", ({ callerId }) => {
      console.log(`Incoming call from: ${callerId}`);
      setCallerId(callerId);  // Ensure callerId is set correctly
      setCallStatus("receiving");
      ringToneRef.current.play();
    });

    socket.on("callAccepted", () => {
      setCallStatus("inCall");
      ringToneRef.current.pause();
      if (callerTuneRef.current) callerTuneRef.current.pause();  // Ensure callerTuneRef is defined and paused
      setInCall(true);
      startVoiceTransmission();
    });

    socket.on("callRejected", () => {
      setCallStatus("idle");
      ringToneRef.current.pause();
      if (callerTuneRef.current) callerTuneRef.current.pause();  // Ensure callerTuneRef is defined and paused
    });

    socket.on("playCallerTune", () => {
      setCallStatus("calling");
      if (callerTuneRef.current) callerTuneRef.current.play();  // Ensure callerTuneRef is defined and played
    });

    socket.on("stopCallerTune", () => {
      if (callerTuneRef.current) callerTuneRef.current.pause();  // Ensure callerTuneRef is defined and paused
    });

    socket.on("callEnded", () => {
      ringToneRef.current.pause();
      setCallStatus("idle");
      setInCall(false);
      endVoiceTransmission();
    });

    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("iceCandidate", handleIceCandidate);
  }, []);

  const handleJoin = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current.srcObject = stream;

      socket.emit("join", { userId });
      console.log(`User ${userId} joined`);
    } catch (error) {
      console.error("Error accessing audio stream:", error);
    }
  };

  const handleCall = async () => {
    try {
      const stream = localStreamRef.current.srcObject;
      if (!stream) {
        console.error("Local stream not initialized.");
        return;
      }
  
      peerConnection = new RTCPeerConnection(config);
      stream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, stream));
  
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", {
            candidate: event.candidate,
            receiverId,
          });
        }
      };
  
      peerConnection.ontrack = (event) => {
        remoteStreamRef.current.srcObject = event.streams[0];
      };
  
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
  
      // Emit the call event with the callerId
      socket.emit("call", { callerId: userId, receiverId, offer });
      setCallStatus("calling");
    } catch (error) {
      console.error("Error starting call:", error);
    }
  };
  

  const handleAcceptCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current.srcObject = stream;
  
      peerConnection = new RTCPeerConnection(config);
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
  
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", { candidate: event.candidate, callerId });
        }
      };
  
      peerConnection.ontrack = (event) => {
        remoteStreamRef.current.srcObject = event.streams[0];
      };
  
      // Emit the accept call event with receiverId
      socket.emit("acceptCall", { receiverId: callerId });
      setCallStatus("inCall");
      ringToneRef.current.pause();
      if (callerTuneRef.current) callerTuneRef.current.pause();  // Ensure callerTuneRef is defined and paused
      setInCall(true);
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  };

  const handleOffer = async ({ offer, callerId }) => {
    try {
      peerConnection = new RTCPeerConnection(config);

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", { candidate: event.candidate, callerId });
        }
      };

      peerConnection.ontrack = (event) => {
        remoteStreamRef.current.srcObject = event.streams[0];
      };

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current.srcObject = stream;
      stream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, stream));

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("answer", { answer, callerId });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  };

  const handleAnswer = async ({ answer }) => {
    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  };

  const handleIceCandidate = async ({ candidate }) => {
    try {
      if (candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error("Error adding ice candidate:", error);
    }
  };

  const handleEndCall = () => {
    socket.emit("endCall", { receiverId, callerId: userId });
    setCallStatus("idle");
    setInCall(false);
    endVoiceTransmission();
  };

  const endVoiceTransmission = () => {
    const localStream = localStreamRef.current?.srcObject;
    const remoteStream = remoteStreamRef.current?.srcObject;

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStreamRef.current.srcObject = null;
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current.srcObject = null;
    }
  };

  // New: Caller ends the call
  const handleCallerEndCall = () => {
    socket.emit("endCall", { receiverId });
    setCallStatus("idle");
    if (callerTuneRef.current) callerTuneRef.current.pause();  // Ensure callerTuneRef is defined and paused
    setInCall(false);
    endVoiceTransmission();
  };

  const startVoiceTransmission = () => {
    if (!peerConnection || !localStreamRef.current) {
      console.error("Peer connection or local stream not initialized.");
      return;
    }

    // Add tracks from the local stream to the peer connection
    localStreamRef.current.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStreamRef.current);
    });

    // Optional: Handle ICE candidates if not already handled
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("iceCandidate", { candidate: event.candidate, receiverId });
      }
    };

    // Optional: Handle remote tracks
    peerConnection.ontrack = (event) => {
      remoteStreamRef.current.srcObject = event.streams[0];
    };
  };

  return (
    <div>
      <h1>Voice Call</h1>

      <audio ref={callerTuneRef} src="/caller_tune.mp3" loop />
      <audio ref={ringToneRef} src="/ringing_tone.mp3" loop />
      <audio ref={localStreamRef} autoPlay />
      <audio ref={remoteStreamRef} autoPlay />
      <div>
        <label>Your User ID:</label>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} />
        <button onClick={handleJoin}>Join</button>
      </div>
      <div>
        <label>Receiver ID:</label>
        <input value={receiverId} onChange={(e) => setReceiverId(e.target.value)} />
        <button onClick={handleCall}>Call</button>
        {callStatus === "receiving" && <button onClick={handleAcceptCall}>Accept Call</button>}
        {callStatus === "inCall" && <button onClick={handleEndCall}>End Call</button>}
        {callStatus === "calling" && <button onClick={handleCallerEndCall}>End Call</button>}
      </div>
      <div>
        <h2>Status: {callStatus}</h2>
      </div>
    </div>
  );
}

export default App;
