import  { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:8080'); // Replace <YOUR_LOCAL_IP> with your IP address

function App() {
  const [myUserId, setMyUserId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [status, setStatus] = useState('');
  const [inCall, setInCall] = useState(false);

  useEffect(() => {
    socket.on('incomingCall', ({ callerId }) => {
      setStatus(`Incoming call from ${callerId}`);
      setReceiverId(callerId); // Automatically set the caller as the receiver for accepting the call
    });

    socket.on('callAccepted', () => {
      setStatus("Call accepted by the other user.");
      setInCall(true);
    });

    socket.on('callEnded', () => {
      setStatus("Call ended.");
      setInCall(false);
    });

    socket.on('userUnavailable', () => {
      setStatus("User is unavailable.");
    });

    return () => {
      socket.off('incomingCall');
      socket.off('callAccepted');
      socket.off('callEnded');
      socket.off('userUnavailable');
    };
  }, []);

  const join = () => {
    if (!myUserId) {
      alert("Please enter your user ID");
      return;
    }
    socket.emit('join', { userId: myUserId });
    setStatus(`You have joined with ID: ${myUserId}`);
  };

  const makeCall = () => {
    if (!receiverId) {
      alert("Please enter the receiver's ID");
      return;
    }
    socket.emit('call', { receiverId });
    setStatus(`Calling ${receiverId}...`);
  };

  const acceptCall = () => {
    socket.emit('acceptCall', { receiverId });
    setStatus("Call accepted.");
    setInCall(true);
  };

  const endCall = () => {
    socket.emit('endCall', { receiverId });
    setStatus("Call ended.");
    setInCall(false);
  };

  return (
    <div>
      <h2>Voice Call Testing</h2>

      {/* Input for user ID */}
      <label>Your ID:</label>
      <input
        type="text"
        placeholder="Enter your ID"
        value={myUserId}
        onChange={(e) => setMyUserId(e.target.value)}
      />
      <button onClick={join}>Join</button>

      <br /><br />

      {/* Input for receiver ID */}
      <label>Receiver ID:</label>
      <input
        type="text"
        placeholder="Enter the receiver's ID"
        value={receiverId}
        onChange={(e) => setReceiverId(e.target.value)}
      />
      <button onClick={makeCall} disabled={inCall}>Call</button>

      <br /><br />

      {/* Buttons to accept and end call */}
      <button onClick={acceptCall} style={{ display: status.includes('Incoming') ? 'block' : 'none' }}>Accept Call</button>
      <button onClick={endCall} disabled={!inCall}>End Call</button>

      <br /><br />

      {/* Displaying status */}
      <div>{status}</div>
    </div>
  );
}

export default App;
