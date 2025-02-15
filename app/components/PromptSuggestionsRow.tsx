import PromptSuggestionButton from "./PromptSuggestionButton"

const PromptSuggestionsRow = ({ onPromptClick }) => {
  const prompts = [
    "Who won the 2024 Formula 1 World Championship?",
    "What were the standings at the end of the 2023 season?",
    "How does tire strategy affect race outcomes in Formula 1?",
    "Can you explain the role of aerodynamics in Formula 1 car design?",
  ]
  return (
    <div className="prompt-suggestions-row">
      {prompts.map((prompt, index) => (
        <PromptSuggestionButton
          key={`suggestion-${index}`}
          text={prompt}
          onClick={() => onPromptClick(prompt)}
        />
      ))}
    </div>
  )
}

export default PromptSuggestionsRow
