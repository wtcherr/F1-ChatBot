"use client"

import Image from "next/image"
import f1GPTLogo from "./assests/F1.png"

import { useChat } from "ai/react"
import { Message } from "ai"
import LoadingBubble from "./components/LoadingBubble"
import PromptSuggestionsRow from "./components/PromptSuggestionsRow"
import Bubble from "./components/Bubble"

const Home = () => {
  const {
    append,
    isLoading,
    messages,
    input,
    handleInputChange,
    handleSubmit,
  } = useChat()

  const noMessages = !messages || messages.length === 0

  const handlePromptClick = (promptText) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      content: promptText,
      role: "user",
    }
    append(msg)
  }
  return (
    <main>
      <Image src={f1GPTLogo} alt="F1 GPT Logo" width={500} />
      <section className="{noMessages ? '' : 'populated'}">
        {noMessages ? (
          <>
            <p className="starter-text">
              Welcome to the Formula One GPT Chatbot! Ask any questions about
              Formula One, from the latest race results to historical data and
              driver statistics. Our chatbot is designed to provide you with
              accurate and up-to-date information about the world of F1. Start
              chatting now about the thrilling world of Formula One!
            </p>
            <PromptSuggestionsRow onPromptClick={handlePromptClick} />
          </>
        ) : (
          <>
            {messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
            {isLoading && <LoadingBubble />}
          </>
        )}
      </section>
      <form onSubmit={handleSubmit}>
        <input
          className="question-box"
          onChange={handleInputChange}
          value={input}
          placeholder="Ask me something..."
        />
        <input type="submit" />
      </form>
    </main>
  )
}

export default Home
