import { useState, useRef, useEffect } from "react";
import "./Genie.scss";

const Genie = ({ isOpen, onClose }) => {

  const [messages, setMessages] = useState([
    { role: "genie", text: "Hello 👋 I’m Genie." }
  ]);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages(prev => [...prev, { role: "user", text: input }]);
    setInput("");

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: "genie", text: "Mock response for now." }
      ]);
    }, 600);
  };

  return (
    <div className={`genie-panel ${isOpen ? "open" : ""}`}>

      <div className="genie-header">
        <span>Genie</span>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="genie-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message-row ${msg.role}`}>
            <div className="message-bubble">
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="genie-input-area">
        <input
          value={input}
          onChange={(e)=>setInput(e.target.value)}
          onKeyDown={(e)=>e.key==="Enter" && handleSend()}
          placeholder="Ask Genie..."
        />
        <button onClick={handleSend}>Send</button>
      </div>

    </div>
  );
};

export default Genie;
