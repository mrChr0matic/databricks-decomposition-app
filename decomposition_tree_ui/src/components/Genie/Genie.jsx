import { useState, useRef, useEffect } from "react";
import "./Genie.scss";
import { askGenie } from "../../api/api";
import { useTree } from "../../context/TreeContext";

const Genie = ({ isOpen, onClose }) => {

  const { kpi, selectedTable, path } = useTree();

  const [messages, setMessages] = useState([
    { role: "genie", text: "Hello 👋 I’m Genie." }
  ]);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const [conversationId, setConversationId] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;

    setMessages(prev => [
      ...prev,
      { role: "user", text: userMessage }
    ]);

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }
    try {
      const res = await askGenie({
        question: userMessage,
        table: "bi_taxi",
        kpi_metric: kpi,
        path,
        conversation_id: conversationId
      });

      if (res.conversation_id) {
        setConversationId(res.conversation_id);
      }

      setMessages(prev => [
        ...prev,
        { role: "genie", text: res.response }
      ]);

    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: "genie", text: "Error: " + err.message }
      ]);
    }
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
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);

            const el = textareaRef.current;
            el.style.height = "40px"; // reset first
            el.style.height = Math.min(el.scrollHeight, 250) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask Genie..."
        />
        <button onClick={handleSend}>Send</button>
      </div>

    </div>
  );
};

export default Genie;
